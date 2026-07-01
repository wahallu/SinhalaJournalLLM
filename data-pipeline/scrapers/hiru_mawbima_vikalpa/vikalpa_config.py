"""
Vikalpa Scraper Configuration

Configuration specific to the Vikalpa.org dedicated scraper.
"""
from dataclasses import dataclass, field
from typing import List, Dict
import re


@dataclass
class VikalpaConfig:
    """Configuration for Vikalpa scraper"""
    # Base URLs
    base_url: str = "https://www.vikalpa.org"
    sitemap_index_url: str = "https://www.vikalpa.org/sitemap-index-1.xml"
    authors_url: str = "https://www.vikalpa.org/authors"
    
    # Request settings
    request_delay: float = 1.0  # Seconds between requests
    max_retries: int = 3
    timeout: int = 30
    
    # User agent
    user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    
    # Output settings
    output_dir: str = "output"
    output_file: str = "vikalpa_corpus.json"
    
    # Content filtering
    min_content_length: int = 100
    min_sinhala_percentage: float = 0.3  # 30%


# Sinhala Unicode block: U+0D80–U+0DFF
SINHALA_UNICODE_RANGE = r"\u0D80-\u0DFF"
SINHALA_PATTERN = re.compile(rf"[{SINHALA_UNICODE_RANGE}]")


# HTML selectors for Vikalpa
SELECTORS = {
    # Article content
    "title": ["h1.entry-title", "h1", ".post-title"],
    "content": [".entry-content", "article", ".post-content"],
    "excerpt": [".entry-summary", ".excerpt", "p:first-of-type"],
    
    # Metadata
    "date": [".entry-date", "time", ".post-date"],
    "author": [".author", ".vcard", "a[rel='author']"],
    
    # Categories
    "cat_links": ".cat-links",
    "category_tag": "[rel='category tag']",
    
    # Navigation
    "pagination": [".nav-links", ".pagination", ".page-numbers"],
}


# Category mapping for unified corpus
CATEGORY_MAPPING: Dict[str, str] = {
    "poems": "creative_writing",
    "yarn": "creative_writing",
    "cartoons": "editorial",
    "puravasi-katha": "citizen_journalism",
    "featured-articles": "editorial",
    "news": "news",
    "media-freedom": "human_rights",
    "human-rights": "human_rights",
    "democracy": "political",
    "free-speech": "human_rights",
    "political": "political",
}


# Default configuration instance
DEFAULT_CONFIG = VikalpaConfig()
