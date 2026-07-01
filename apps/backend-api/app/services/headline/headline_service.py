"""
Headline generation service.
Currently uses rule-based dummy generation.
Will be replaced with fine-tuned LLM inference.
"""

def generate_headline(text: str, count: int = 5) -> list[str]:
    """
    Generate multiple headline options from a text.
    """
    base_snippet = text.strip()[:50]
    if not base_snippet:
        base_snippet = "හිස් ලිපිය" # Placeholder for empty/short text in Sinhala
    
    # Generate variations of headlines
    templates = [
        f"SinAI | {base_snippet}...",
        f"ප්‍රවෘත්ති: {base_snippet} පිළිබඳ විශේෂ වාර්තාවක්",
        f"{base_snippet} - සවිස්තරාත්මක සමාලෝචනය",
        f"අද දවසේ ප්‍රධාන පුවත: {base_snippet}",
        f"{base_snippet} පිළිබඳව ඔබ දැනගත යුතු කරුණු",
        f"විශේෂ පුවත: {base_snippet}",
        f"{base_snippet} සම්බන්ධයෙන් නවතම තොරතුරු",
        f"SinAI විශ්ලේෂණය: {base_snippet}",
        f"පුවත් සාරාංශය: {base_snippet}",
        f"වාර්තාව: {base_snippet}"
    ]
    
    # Limit count to template length and return
    result_count = min(count, len(templates))
    return templates[:result_count]