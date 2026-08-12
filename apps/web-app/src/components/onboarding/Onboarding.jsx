import { useEffect, useRef, useState } from 'react';
import { saveOnboarding } from '../../services/api';
import './onboarding.css';

const STEPS = [
  { id: 'name', question: 'What do your friends call you?' },
  { id: 'roles', question: 'Which roles do you play in the newsroom?' },
  { id: 'interests', question: 'What kind of journalism do you care about?' },
];

const ROLES = [
  { id: 'reporter', label: 'Reporter', description: 'Research, interview and report stories.' },
  { id: 'editor', label: 'Editor', description: 'Shape stories and guide editorial quality.' },
  { id: 'student-journalist', label: 'Student journalist', description: 'Learn and practise newsroom craft.' },
  { id: 'copy-editor', label: 'Copy editor', description: 'Refine language, clarity and accuracy.' },
  { id: 'producer', label: 'Producer', description: 'Build broadcast and digital news coverage.' },
  { id: 'photojournalist', label: 'Photojournalist', description: 'Tell stories through images and video.' },
  { id: 'researcher', label: 'Researcher', description: 'Find evidence, context and source material.' },
  { id: 'newsroom-leader', label: 'Newsroom leader', description: 'Coordinate people and editorial direction.' },
];

const INTERESTS = [
  ['politics', 'Politics'],
  ['business', 'Business'],
  ['investigations', 'Investigations'],
  ['technology', 'Technology'],
  ['science', 'Science'],
  ['health', 'Health'],
  ['climate', 'Climate'],
  ['sports', 'Sports'],
  ['culture', 'Culture'],
  ['international', 'International'],
  ['local-affairs', 'Local affairs'],
  ['fact-checking', 'Fact-checking'],
];

export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState('forward');
  const [name, setName] = useState(user?.full_name ?? '');
  const [roles, setRoles] = useState(user?.newsroom_roles ?? []);
  const [interests, setInterests] = useState(user?.journalism_interests ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('questions');
  const headingRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  useEffect(() => () => {
    timersRef.current.forEach(window.clearTimeout);
  }, []);

  const moveTo = (nextStep, nextDirection) => {
    setDirection(nextDirection);
    setStep(nextStep);
    setError('');
  };

  const continueForward = () => {
    if (step === 0 && !name.trim()) return;
    if (step < STEPS.length - 1) {
      moveTo(step + 1, 'forward');
      return;
    }
    finish();
  };

  const skip = () => {
    if (step < STEPS.length - 1) {
      moveTo(step + 1, 'forward');
      return;
    }
    finish();
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const account = await saveOnboarding({
        full_name: name.trim() || null,
        newsroom_roles: roles,
        journalism_interests: interests,
      });
      setPhase('customizing');
      timersRef.current.push(window.setTimeout(() => setPhase('blank'), 3600));
      timersRef.current.push(window.setTimeout(() => {
        onComplete(account);
      }, 4000));
    } catch (err) {
      setError(err.message || 'We could not save your preferences. Please try again.');
      setSaving(false);
    }
  };

  const toggleRole = (roleId) => {
    setRoles((current) => current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId]);
  };

  const toggleInterest = (interestId) => {
    setInterests((current) => {
      if (current.includes(interestId)) return current.filter((id) => id !== interestId);
      if (current.length >= 8) return current;
      return [...current, interestId];
    });
  };

  if (phase !== 'questions') {
    return (
      <div className={`ob-completion ${phase === 'blank' ? 'ob-completion--blank' : ''}`}>
        {phase === 'customizing' && (
          <h1 className="ob-completion__text">
            Customizing your SinAi newsroom workspace
          </h1>
        )}
      </div>
    );
  }

  const current = STEPS[step];
  const continueDisabled = saving || (step === 0 && !name.trim());

  return (
    <div className="ob-root">
      <div className="ob-progress" aria-hidden="true">
        <div
          className="ob-progress__fill"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <main className="ob-main">
        <div
          key={current.id}
          className={`ob-question ob-question--${direction}`}
        >
          <h1 ref={headingRef} tabIndex={-1} className="ob-title">
            {current.question}
          </h1>

          {step === 0 && (
            <form onSubmit={(event) => { event.preventDefault(); continueForward(); }}>
              <label className="ob-sr-only" htmlFor="onboarding-name">Nickname</label>
              <input
                id="onboarding-name"
                className="ob-input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nickname"
                autoComplete="nickname"
                autoFocus
                maxLength={60}
              />
            </form>
          )}

          {step === 1 && (
            <div className="ob-role-grid" aria-label="Select all newsroom roles that apply">
              {ROLES.map((role) => {
                const selected = roles.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    className="ob-role"
                    aria-pressed={selected}
                    onClick={() => toggleRole(role.id)}
                  >
                    <span className="ob-role__copy">
                      <span className="ob-role__label">{role.label}</span>
                      <span className="ob-role__description">{role.description}</span>
                    </span>
                    <span className="ob-role__indicator" aria-hidden="true">✓</span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="ob-interests" aria-label="Select up to eight journalism interests">
              {INTERESTS.map(([id, label]) => {
                const selected = interests.includes(id);
                const unavailable = !selected && interests.length >= 8;
                return (
                  <button
                    key={id}
                    type="button"
                    className="ob-chip"
                    aria-pressed={selected}
                    aria-disabled={unavailable}
                    onClick={() => toggleInterest(id)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {error && <p className="ob-error" role="alert">{error}</p>}
        </div>
      </main>

      <footer className="ob-footer">
        <div className="ob-footer__inner">
          <button
            type="button"
            className="ob-button ob-button--back"
            disabled={step === 0 || saving}
            onClick={() => moveTo(step - 1, 'back')}
          >
            Back
          </button>

          <div className="ob-footer__right">
            <button
              type="button"
              className="ob-button ob-button--skip"
              disabled={saving}
              onClick={skip}
            >
              Skip
            </button>
            <button
              type="button"
              className="ob-button ob-button--primary"
              disabled={continueDisabled}
              onClick={continueForward}
            >
              {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Finish' : 'Continue'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
