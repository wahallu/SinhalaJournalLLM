"""
Summarization service.
Currently uses rule-based dummy summaries.
Will be replaced with fine-tuned LLM inference.
"""

def summarize_text(text: str, length: str = "medium") -> str:
    """
    Summarize long-form text.
    """
    clean_text = text.strip()
    
    if length == "short":
        snippet = clean_text[:80]
        return f"[SinAI සාරාංශය - කෙටි]: {snippet}..."
    elif length == "long":
        snippet = clean_text[:300]
        return f"[SinAI සාරාංශය - දීර්ඝ]: {snippet}...\n[අමතර තොරතුරු ඇතුළත් වේ]"
    else: # medium
        snippet = clean_text[:150]
        return f"[SinAI සාරාංශය - මාධ්‍යම]: {snippet}..."