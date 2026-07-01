"""
Style rewriting service.
Currently uses rule-based dummy rewrites.
Will be replaced with fine-tuned LLM inference.
"""

def rewrite_style(text: str, tone: str = "formal") -> str:
    """
    Rewrite text in a specific tone.
    """
    clean_text = text.strip()
    
    if tone == "formal":
        return f"[SinAI formal]: ගෞරවනීය ස්වරූපයෙන් නැවත ලියන ලදි: {clean_text}"
    elif tone == "journalistic":
        return f"[SinAI journalistic]: ප්‍රවෘත්තිමය ශෛලියෙන් නැවත ලියන ලදි: {clean_text}"
    elif tone == "casual":
        return f"[SinAI casual]: සාමාන්‍ය කතාබස් ස්වරූපයෙන් නැවත ලියන ලදි: {clean_text}"
    else:
        return f"[SinAI {tone}]: {clean_text}"