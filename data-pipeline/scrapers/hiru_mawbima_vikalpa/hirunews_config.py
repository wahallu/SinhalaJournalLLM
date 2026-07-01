"""
HiruNews Scraper Configuration

Configuration specific to the HiruNews.lk dedicated scraper.
"""
from dataclasses import dataclass, field
from typing import List, Dict
import re


@dataclass
class HiruNewsConfig:
    """Configuration for HiruNews scraper"""
    # Base URLs
    base_url: str = "https://hirunews.lk"
    sitemap_url: str = "https://hirunews.lk/sitemap.xml"
    sitemaps_base_url: str = "https://www.hirunews.lk/sitemaps"
    
    # Request settings
    request_delay: float = 1.0  # Seconds between requests
    max_retries: int = 3
    timeout: int = 30
    
    # User agent
    user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    
    # Output settings
    output_dir: str = "output"
    output_file: str = "hirunews_corpus.json"
    
    # Content filtering
    min_content_length: int = 100
    min_sinhala_percentage: float = 0.3  # 30%
    
    # Paths to exclude (English and Tamil)
    excluded_paths: List[str] = field(default_factory=lambda: ["/en/", "/tm/"])


# Sinhala Unicode block: U+0D80–U+0DFF
SINHALA_UNICODE_RANGE = r"\u0D80-\u0DFF"
SINHALA_PATTERN = re.compile(rf"[{SINHALA_UNICODE_RANGE}]")


# Categories available on HiruNews
CATEGORIES = ["Local", "World", "Entertainment", "Business", "Sports"]


# HTML selectors for HiruNews
SELECTORS = {
    # Article content
    "title": ["h1", ".news-title", ".article-title"],
    "content": [".description-content", ".article-content", ".news-content"],
    
    # Metadata
    "date": [".update-wrp-lg span:nth-child(2)", ".date", ".news-date", "time"],
    "category": [".update-category", ".category", ".news-category"],
    
    # Navigation
    "nav_items": ".nav-items",
}


# Category mapping for unified corpus
CATEGORY_MAPPING: Dict[str, str] = {
    "local": "local",
    "world": "international",
    "international": "international",
    "entertainment": "entertainment",
    "business": "business",
    "sports": "sports",
    "politics": "politics",
    "general": "general",
}


# Political keywords in Sinhala for content-based classification
# These keywords indicate political content in articles
POLITICAL_KEYWORDS: List[str] = [
    # Government/State terms (රජය, ආණ්ඩුව)
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
    "තමිල් ජාතික",   # TNA
    
    # Political actions
    "විරෝධතා",       # Protest
    "උද්ඝෝෂණ",       # Demonstration
    "ඉල්ලා අස්",     # Resignation
    "ධුරයෙන් පහ",    # Removal from position
    "තේරී පත්",      # Elected
    "නීති යෝජනා",    # Bill/Legislation
    "පනත්",          # Act/Law
    "අගවිනිසුරු",
    
    # Government institutions
    "කැබිනට්",       # Cabinet
    "මහ බැංකු",      # Central Bank
    "ශ්‍රේෂ්ඨාධිකරණ", # Supreme Court
    "අල්ලස් කොමි",   # Bribery Commission
    "මැතිවරණ කොමි",  # Election Commission
    
    # Political figures (generic terms)
    "දේශපාලන",       # Political
    "දේශපාලනඥ",      # Politician
    "සභාපති",        # Chairman
    "අගවිනිසුරු",
    
    # Government actions
    "බදු",           # Tax
    "අයවැය",         # Budget
    "ප්‍රතිපත්ති",   # Policy
    "රාජ්‍ය",        # State
    "ජාතික",         # National
]


# Default configuration instance
DEFAULT_CONFIG = HiruNewsConfig()
