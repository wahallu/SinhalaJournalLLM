"""
Pydantic schemas for the SinLLaMA Playground.

Unlike the four production tools, the playground talks to the merged base
model with every task adapter disabled — no style, no length, no persisted
history. It exists to let a client exercise the raw model through the
backend, without ever learning the inference server's address.
"""

from pydantic import BaseModel, Field


class PlaygroundRequest(BaseModel):
    """Input payload for a playground chat turn."""
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Sinhala or English prompt sent straight to the base model",
    )


class PlaygroundResponse(BaseModel):
    """Output payload from a playground chat turn."""
    response: str = Field(description="Base model's generated text")
    input_tokens: int | None = Field(default=None, description="Prompt length in tokens")
    output_tokens: int | None = Field(default=None, description="Generated length in tokens")
    max_cap_used: int | None = Field(default=None, description="Token cap applied to this generation")
