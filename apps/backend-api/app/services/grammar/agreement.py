"""Feature-based Sinhala agreement checks with mandatory animacy restraint."""

from __future__ import annotations

from dataclasses import dataclass

from app.services.grammar.morphology import predicate_features, pronoun_features
from app.services.grammar.rule_types import MorphFeatures


@dataclass(frozen=True)
class AgreementFinding:
    rule_id: str
    message: str
    is_exception: bool = False


def validate_agreement(
    subject: MorphFeatures,
    predicate: MorphFeatures,
) -> tuple[AgreementFinding, ...]:
    """Compare known features and never turn unknowns into guessed errors."""
    if (
        subject.number == "plural"
        and subject.animacy == "inanimate"
        and predicate.number == "singular"
    ):
        return (
            AgreementFinding(
                "AGR_INANIMATE_EXCEPTION_001",
                "Inanimate plural subjects may take a singular predicate; no mismatch was raised.",
                is_exception=True,
            ),
        )

    findings: list[AgreementFinding] = []
    if subject.person is not None and predicate.person is not None and subject.person != predicate.person:
        findings.append(AgreementFinding("AGR_PERSON_001", "Possible subject-predicate person mismatch."))
    if subject.number and predicate.number and subject.number != predicate.number:
        findings.append(AgreementFinding("AGR_NUMBER_001", "Possible subject-predicate number mismatch."))
    if subject.gender and predicate.gender and subject.gender != predicate.gender:
        findings.append(AgreementFinding("AGR_GENDER_001", "Possible subject-predicate gender mismatch."))
    return tuple(findings)


def infer_agreement(text: str) -> tuple[MorphFeatures, MorphFeatures] | None:
    """Infer only a leading reviewed pronoun plus a reviewed predicate form."""
    words = [word.strip(".,;:!?\"'“”‘’") for word in text.split() if word.strip()]
    if not words:
        return None
    subject = pronoun_features(words[0])
    predicate = predicate_features(words)
    if not subject or not predicate:
        return None
    return subject, predicate
