"""
Mawbima Scraper Configuration

Configuration specific to the Mawbima.lk dedicated scraper.
"""
from dataclasses import dataclass, field
from typing import List, Dict
import re


@dataclass
class MawbimaConfig:
    """Configuration for Mawbima scraper"""
    # Base URLs
    base_url: str = "https://mawbima.lk"
    sitemap_index_url: str = "https://mawbima.lk/sitemap_index.xml"
    category_sitemap_url: str = "https://mawbima.lk/category-sitemap.xml"
    
    # Request settings
    request_delay: float = 1.0  # Seconds between requests
    max_retries: int = 3
    timeout: int = 30
    
    # Concurrency
    max_threads: int = 5
    
    # User agent
    user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    
    # Output settings
    output_dir: str = "output"
    output_file: str = "mawbima_corpus.json"
    
    # Content filtering
    min_content_length: int = 100
    min_sinhala_percentage: float = 0.3  # 30%
    
    # Paths to exclude (non-article pages)
    excluded_paths: List[str] = field(default_factory=lambda: [
        "/category/",
        "/page/",
        "/author/",
        "/tag/",
        "/e-paper/",
    ])


# Sinhala Unicode block: U+0D80–U+0DFF
SINHALA_UNICODE_RANGE = r"\u0D80-\u0DFF"
SINHALA_PATTERN = re.compile(rf"[{SINHALA_UNICODE_RANGE}]")


# HTML selectors for Mawbima (WordPress Newspaper theme)
SELECTORS = {
    # Article content
    "title": ["h1.entry-title", "h1.tdb-title-text", "h1"],
    "content": ["div.td-post-content", "div.tdb-block-inner td-fix-index", ".entry-content", "article"],
    
    # Metadata
    "date": ["time.entry-date", "time", ".td-post-date time"],
    "category": [".td-category a", "a.entry-crumb", ".td-post-category a"],
    "author": [".td-post-author-name a", ".author a", "a[rel='author']"],
    
    # Tags
    "tags": [".td-post-source-tags a", ".td-tags a", ".td-post-tags a"],
    
    # Featured image
    "featured_image": [".td-post-featured-image img", ".entry-thumb"],
}


# Category mapping for unified corpus
# Maps Mawbima category slugs/names to unified categories
CATEGORY_MAPPING: Dict[str, str] = {
    # Sinhala category names
    "දේශීය": "local",
    "විදේශීය": "international",
    "ක්‍රීඩා": "sports",
    "වියාපාරික": "business",
    "විචිත්‍ර": "lifestyle",
    "තාක්ෂණ": "technology",
    "කතුවැකිය": "editorial",
    "කාටූන්": "editorial",
    "දේශපාලන සාකච්ඡා": "politics",
    "අද පුවත්": "local",
    "අද විශේෂාංග": "feature",
    "සරුබිම": "agriculture",
    "ඉරිදා පුවත්": "local",
    "ඉරිදා මව්බිම": "local",
    "කතුවැකිය ඉරිදා මව්බිම": "editorial",
    "අද මව්බිම": "local",
    "අද විශේෂාංග": "feature",
    
    # English category names
    "highlights": "local",
    "recent": "local",
    "exclusive": "feature",
    "cartoon": "editorial",
    "layout": "general",
    "provincial-news": "local",
    "e-paper": "general",
    
    # Regional
    "north": "local",
    "south": "local",
    "east": "local",
    "west": "local",
    
    # Tabloid sections
    "business": "business",
    "horoscope": "lifestyle",
    "her": "lifestyle",
    "bro": "lifestyle",
    "primary": "education",
    
    # Sunday supplements
    "breathe": "lifestyle",
    "heal": "health",
    "galaxy": "science",
    "play": "entertainment",
    "angels": "lifestyle",
    "mystery": "lifestyle",
    "myth": "lifestyle",
    "matrix": "technology",
}


# Political keywords in Sinhala for content-based classification
POLITICAL_KEYWORDS: List[str] = [
    # Government/State terms
    "ජනාධිපති",      # President
    "අගමැති",        # Prime Minister
    "අග්‍රාමාත්‍ය",    # Prime Minister (formal)
    "අමාත්‍ය",        # Minister
    "ඇමති",          # Minister (colloquial)
    "අමාත්‍යාංශ",     # Ministry
    "පාර්ලිමේන්තු",   # Parliament
    "මන්ත්‍රී",       # Member of Parliament
    "ආණ්ඩු",         # Government
    "රජය",           # Government/State
    "විපක්ෂ",        # Opposition
    "ආණ්ඩුව",        # Government
    
    # Political parties and elections
    "මැතිවරණ",       # Election
    "ඡන්ද",          # Vote/Voting
    "පක්ෂ",          # Party
    "ජනතා විමුක්ති", # JVP
    "පොදුජන",        # SLPP
    "එක්සත් ජාතික",  # UNP
    "සමගි ජන",       # SJB
    
    # Political actions
    "විරෝධතා",       # Protest
    "උද්ඝෝෂණ",       # Demonstration
    "ඉල්ලා අස්",     # Resignation
    "තේරී පත්",      # Elected
    "නීති යෝජනා",    # Bill/Legislation
    "පනත්",          # Act/Law
    
    # Government institutions
    "කැබිනට්",       # Cabinet
    "මහ බැංකු",      # Central Bank
    "ශ්‍රේෂ්ඨාධිකරණ", # Supreme Court
    "දේශපාලන",       # Political
    "දේශපාලනඥ",      # Politician
]


# Default configuration instance
DEFAULT_CONFIG = MawbimaConfig()
