"""
Vikalpa Dedicated Scraper

A specialized scraper for Vikalpa.org that efficiently extracts articles
using sitemap parsing, category discovery, and proper deduplication.

Features:
    - Saves discovered URLs to vikalpa_links.txt for reuse
    - Tracks scraped URLs to support resume on restart
    - Incremental JSON output (each article saved immediately)
    - Background thread polls sitemaps for new articles while scraping

Usage:
    from vikalpa_scraper import VikalpaScraper
    
    scraper = VikalpaScraper()
    articles = scraper.scrape_all(max_articles=100)
"""
import json
import os
import re
import time
import threading
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Dict, Optional, Set
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from vikalpa_config import (
    VikalpaConfig,
    DEFAULT_CONFIG,
    SELECTORS,
    CATEGORY_MAPPING,
    SINHALA_PATTERN,
)


@dataclass
class VikalpaArticle:
    """Represents a scraped Vikalpa article"""
    url: str
    article_id: int
    title: str
    content: str
    excerpt: str = ""
    categories: List[str] = field(default_factory=list)
    unified_categories: List[str] = field(default_factory=list)
    author: str = ""
    date_published: Optional[str] = None
    date_scraped: str = field(default_factory=lambda: datetime.now().isoformat())
    sinhala_percentage: float = 0.0
    word_count: int = 0


class SinhalaTextProcessor:
    """Processes and filters Sinhala text content"""
    
    @staticmethod
    def contains_sinhala(text: str) -> bool:
        """Check if text contains Sinhala characters"""
        return bool(SINHALA_PATTERN.search(text))
    
    @staticmethod
    def calculate_sinhala_percentage(text: str) -> float:
        """Calculate what percentage of the text is Sinhala"""
        if not text:
            return 0.0
        
        sinhala_chars = len(SINHALA_PATTERN.findall(text))
        total_chars = len(re.sub(r'\s', '', text))
        
        if total_chars == 0:
            return 0.0
        
        return sinhala_chars / total_chars
    
    @staticmethod
    def clean_text(text: str) -> str:
        """Clean and normalize text"""
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        return text


class NewArticleWatcher:
    """Background thread that polls sitemaps for new article URLs"""
    
    def __init__(self, scraper: 'VikalpaScraper', poll_interval: float = 300.0):
        """
        Args:
            scraper: The VikalpaScraper instance to use for config/headers
            poll_interval: Seconds between sitemap polls (default: 5 minutes)
        """
        self.scraper = scraper
        self.poll_interval = poll_interval
        
        self._known_urls: Set[str] = set()
        self._new_url_queue: deque = deque()
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.new_urls_found = 0
    
    def seed(self, known_urls: Set[str]) -> None:
        """Seed the watcher with already-known URLs so they aren't re-queued"""
        with self._lock:
            self._known_urls = set(known_urls)
    
    def start(self) -> None:
        """Start the background polling thread"""
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._poll_loop, daemon=True, name="VikalpaArticleWatcher")
        self._thread.start()
        print(f"  👁️ Article watcher started (polling every {self.poll_interval}s)")
    
    def stop(self) -> None:
        """Stop the background polling thread"""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=10)
        print(f"  👁️ Article watcher stopped ({self.new_urls_found} new URLs found total)")
    
    def drain_new_urls(self) -> List[str]:
        """Get and remove all newly discovered URLs from the queue (thread-safe)"""
        with self._lock:
            urls = list(self._new_url_queue)
            self._new_url_queue.clear()
            return urls
    
    def mark_known(self, url: str) -> None:
        """Mark a URL as known so it won't be queued again"""
        with self._lock:
            self._known_urls.add(url)
    
    def _poll_loop(self) -> None:
        """Background loop that periodically checks sitemaps for new URLs"""
        while not self._stop_event.is_set():
            # Wait for the poll interval (or until stopped)
            if self._stop_event.wait(timeout=self.poll_interval):
                break  # stop event was set
            
            try:
                self._check_for_new_urls()
            except Exception as e:
                print(f"  👁️ Watcher error: {e}")
    
    def _check_for_new_urls(self) -> None:
        """Fetch sitemaps and queue any new URLs"""
        # Use a separate session to avoid interfering with the main scraper
        session = requests.Session()
        session.headers.update(self.scraper.session.headers)
        
        try:
            # Fetch sitemap index
            response = session.get(
                self.scraper.config.sitemap_index_url,
                timeout=self.scraper.config.timeout
            )
            response.raise_for_status()
            
            root = ET.fromstring(response.content)
            ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            
            sitemap_urls = []
            for sitemap in root.findall('.//sm:sitemap/sm:loc', ns):
                sitemap_urls.append(sitemap.text)
            
            # Parse each sitemap for article URLs
            new_count = 0
            for sitemap_url in sitemap_urls:
                time.sleep(self.scraper.config.request_delay)
                resp = session.get(sitemap_url, timeout=self.scraper.config.timeout)
                if resp.status_code != 200:
                    continue
                
                try:
                    sroot = ET.fromstring(resp.content)
                    
                    urls_found = sroot.findall('.//sm:url/sm:loc', ns)
                    
                    if not urls_found:
                        urls_found = sroot.findall('.//url/loc')
                    
                    with self._lock:
                        for url_elem in urls_found:
                            url = url_elem.text
                            if (url
                                and url not in self._known_urls
                                and '/article/' in url
                                and '/category/' not in url
                                and '/author/' not in url
                                and '/date/' not in url):
                                self._known_urls.add(url)
                                self._new_url_queue.append(url)
                                new_count += 1
                
                except ET.ParseError:
                    continue
            
            if new_count > 0:
                self.new_urls_found += new_count
                print(f"\n  👁️ Watcher found {new_count} new article(s)! (queued for scraping)")
                
                # Also update the links file
                self.scraper._save_urls_to_file(self._known_urls)
        
        except Exception as e:
            print(f"  👁️ Watcher poll failed: {e}")
        finally:
            session.close()


class VikalpaScraper:
    """Main scraper class for Vikalpa.org"""
    
    def __init__(self, config: VikalpaConfig = None):
        self.config = config or DEFAULT_CONFIG
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': self.config.user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5,si;q=0.3',
        })
        self.text_processor = SinhalaTextProcessor()
        self.scraped_urls: Set[str] = set()
        self.discovered_categories: Set[str] = set()
        self.stats = {
            'urls_found': 0,
            'articles_scraped': 0,
            'articles_skipped': 0,
            'errors': 0,
        }
        
        # File paths for persistence
        self.links_file = os.path.join(self.config.output_dir, "vikalpa_links.txt")
        self.scraped_log_file = os.path.join(self.config.output_dir, "vikalpa_scraped.txt")
    
    def _make_request(self, url: str, retries: int = None) -> Optional[requests.Response]:
        """Make HTTP request with retries and rate limiting"""
        retries = retries or self.config.max_retries
        
        for attempt in range(retries):
            try:
                time.sleep(self.config.request_delay)
                response = self.session.get(url, timeout=self.config.timeout)
                response.raise_for_status()
                return response
            except requests.RequestException as e:
                print(f"  Request failed (attempt {attempt + 1}/{retries}): {e}")
                if attempt == retries - 1:
                    self.stats['errors'] += 1
                    return None
        return None
    
    # ─── URL Discovery & Persistence ───────────────────────────────────
    
    def _save_urls_to_file(self, urls: Set[str]) -> None:
        """Save discovered article URLs to vikalpa_links.txt"""
        os.makedirs(self.config.output_dir, exist_ok=True)
        with open(self.links_file, 'w', encoding='utf-8') as f:
            for url in sorted(urls):
                f.write(url + '\n')
        print(f"  💾 Saved {len(urls)} URLs to {self.links_file}")
    
    def _load_urls_from_file(self) -> Set[str]:
        """Load previously discovered URLs from vikalpa_links.txt"""
        urls = set()
        if os.path.exists(self.links_file):
            with open(self.links_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        urls.add(line)
            print(f"  📂 Loaded {len(urls)} URLs from {self.links_file}")
        return urls
    
    def _load_scraped_urls(self) -> Set[str]:
        """Load URLs that have already been scraped from the log file"""
        scraped = set()
        if os.path.exists(self.scraped_log_file):
            with open(self.scraped_log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        scraped.add(line)
            print(f"  📂 Found {len(scraped)} previously scraped URLs")
        return scraped
    
    def _mark_url_scraped(self, url: str) -> None:
        """Append a URL to the scraped log file"""
        os.makedirs(self.config.output_dir, exist_ok=True)
        with open(self.scraped_log_file, 'a', encoding='utf-8') as f:
            f.write(url + '\n')
    
    # ─── Sitemap Parsing ───────────────────────────────────────────────
    
    def get_article_urls_from_sitemap(self) -> Set[str]:
        """Parse sitemap index and extract all article URLs"""
        print("📍 Parsing sitemap index...")
        article_urls = set()
        
        response = self._make_request(self.config.sitemap_index_url)
        if not response:
            print("  ❌ Failed to fetch sitemap index")
            return article_urls
        
        try:
            root = ET.fromstring(response.content)
            ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            
            sitemap_urls = []
            for sitemap in root.findall('.//sm:sitemap/sm:loc', ns):
                sitemap_urls.append(sitemap.text)
            
            print(f"  Found {len(sitemap_urls)} sitemaps")
            
            for sitemap_url in sitemap_urls:
                print(f"  📄 Parsing: {sitemap_url}")
                sitemap_response = self._make_request(sitemap_url)
                if not sitemap_response:
                    continue
                
                sitemap_root = ET.fromstring(sitemap_response.content)
                for url_elem in sitemap_root.findall('.//sm:url/sm:loc', ns):
                    url = url_elem.text
                    if url and '/article/' in url and '/category/' not in url and '/author/' not in url and '/date/' not in url:
                        article_urls.add(url)
            
        except ET.ParseError as e:
            print(f"  ❌ XML parse error: {e}")
        
        self.stats['urls_found'] = len(article_urls)
        print(f"  ✅ Found {len(article_urls)} article URLs from sitemap")
        return article_urls
    
    def get_or_fetch_urls(self, force_refresh: bool = False) -> List[str]:
        """
        Get article URLs - loads from file if available, otherwise fetches from sitemap.
        
        Args:
            force_refresh: If True, always fetch from sitemap even if file exists
            
        Returns:
            List of article URLs sorted by article ID (oldest first)
        """
        if not force_refresh:
            cached_urls = self._load_urls_from_file()
            if cached_urls:
                self.stats['urls_found'] = len(cached_urls)
                return self._sort_urls_oldest_first(cached_urls)
        
        # Fetch fresh from sitemap
        urls = self.get_article_urls_from_sitemap()
        if urls:
            self._save_urls_to_file(urls)
        
        return self._sort_urls_oldest_first(urls)

    def _sort_urls_oldest_first(self, urls) -> List[str]:
        """Sort URLs by article ID ascending so oldest articles are scraped first"""
        def _sort_key(url: str) -> int:
            match = re.search(r'/article/(\d+)', url)
            return int(match.group(1)) if match else 0
        return sorted(urls, key=_sort_key)
    
    # ─── Category & Author Discovery ──────────────────────────────────
    
    def discover_categories(self, sample_urls: List[str] = None) -> Set[str]:
        """Discover categories from article pages"""
        print("📂 Discovering categories...")
        categories = set()
        
        if not sample_urls:
            article_urls = self.get_or_fetch_urls()[:10]
            sample_urls = article_urls
        
        for url in sample_urls:
            response = self._make_request(url)
            if not response:
                continue
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            cat_links = soup.select(SELECTORS['cat_links'])
            for cat_link in cat_links:
                for link in cat_link.find_all('a'):
                    href = link.get('href', '')
                    if '/category/' in href:
                        match = re.search(r'/category/(.+?)(?:/|$)', href)
                        if match:
                            categories.add(match.group(1))
            
            cat_tags = soup.select(SELECTORS['category_tag'])
            for tag in cat_tags:
                href = tag.get('href', '')
                if '/category/' in href:
                    match = re.search(r'/category/(.+?)(?:/|$)', href)
                    if match:
                        categories.add(match.group(1))
        
        self.discovered_categories = categories
        print(f"  ✅ Found {len(categories)} categories: {list(categories)[:5]}...")
        return categories
    
    def discover_authors(self) -> Dict[str, str]:
        """Discover authors from the authors page"""
        print("👤 Discovering authors...")
        authors = {}
        
        response = self._make_request(self.config.authors_url)
        if not response:
            print("  ❌ Failed to fetch authors page")
            return authors
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        for link in soup.find_all('a'):
            href = link.get('href', '')
            if '/article/author/' in href:
                author_name = link.get_text(strip=True)
                if author_name:
                    authors[author_name] = href
        
        print(f"  ✅ Found {len(authors)} authors")
        return authors
    
    # ─── Article Extraction ───────────────────────────────────────────
    
    def _extract_article_id(self, url: str) -> int:
        """Extract article ID from URL"""
        match = re.search(r'/article/(\d+)', url)
        return int(match.group(1)) if match else 0
    
    def _extract_categories(self, soup: BeautifulSoup) -> List[str]:
        """Extract categories from article page"""
        categories = []
        
        cat_links = soup.select(SELECTORS['cat_links'])
        for cat_link in cat_links:
            for link in cat_link.find_all('a'):
                cat_text = link.get_text(strip=True)
                if cat_text:
                    categories.append(cat_text)
        
        cat_tags = soup.select(SELECTORS['category_tag'])
        for tag in cat_tags:
            cat_text = tag.get_text(strip=True)
            if cat_text and cat_text not in categories:
                categories.append(cat_text)
        
        return categories
    
    def _get_unified_categories(self, categories: List[str]) -> List[str]:
        """Map categories to unified corpus categories"""
        unified = []
        for cat in categories:
            cat_lower = cat.lower().replace(' ', '-')
            if cat_lower in CATEGORY_MAPPING:
                unified_cat = CATEGORY_MAPPING[cat_lower]
                if unified_cat not in unified:
                    unified.append(unified_cat)
        return unified
    
    def scrape_article(self, url: str) -> Optional[VikalpaArticle]:
        """Scrape a single article"""
        if url in self.scraped_urls:
            return None
        
        response = self._make_request(url)
        if not response:
            return None
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract title
        title = ""
        for selector in SELECTORS['title']:
            title_elem = soup.select_one(selector)
            if title_elem:
                title = self.text_processor.clean_text(title_elem.get_text())
                break
        
        if not title:
            og_title = soup.find('meta', property='og:title')
            if og_title:
                title = og_title.get('content', '')
        
        # Extract content
        content = ""
        for selector in SELECTORS['content']:
            content_elem = soup.select_one(selector)
            if content_elem:
                for script in content_elem(['script', 'style', 'nav', 'aside']):
                    script.decompose()
                content = self.text_processor.clean_text(content_elem.get_text())
                break
        
        # Extract excerpt
        excerpt = ""
        for selector in SELECTORS['excerpt']:
            excerpt_elem = soup.select_one(selector)
            if excerpt_elem:
                excerpt = self.text_processor.clean_text(excerpt_elem.get_text())[:500]
                break
        
        # Extract date
        date_published = None
        for selector in SELECTORS['date']:
            date_elem = soup.select_one(selector)
            if date_elem:
                date_published = date_elem.get('datetime') or date_elem.get_text(strip=True)
                break
        
        # Extract author
        author = ""
        for selector in SELECTORS['author']:
            author_elem = soup.select_one(selector)
            if author_elem:
                author = self.text_processor.clean_text(author_elem.get_text())
                break
        
        # Extract categories
        categories = self._extract_categories(soup)
        unified_categories = self._get_unified_categories(categories)
        
        # Calculate Sinhala percentage
        sinhala_pct = self.text_processor.calculate_sinhala_percentage(content)
        
        # Filter by content quality
        if len(content) < self.config.min_content_length:
            self.stats['articles_skipped'] += 1
            return None
        
        if sinhala_pct < self.config.min_sinhala_percentage:
            self.stats['articles_skipped'] += 1
            return None
        
        # Mark as scraped
        self.scraped_urls.add(url)
        
        article = VikalpaArticle(
            url=url,
            article_id=self._extract_article_id(url),
            title=title,
            content=content,
            excerpt=excerpt,
            categories=categories,
            unified_categories=unified_categories,
            author=author,
            date_published=date_published,
            sinhala_percentage=round(sinhala_pct, 3),
            word_count=len(content.split()),
        )
        
        self.stats['articles_scraped'] += 1
        return article
    
    # ─── Output Handling ──────────────────────────────────────────────
    
    def _get_output_path(self, output_file: str = None) -> str:
        """Get the output file path"""
        return output_file or os.path.join(
            self.config.output_dir, 
            self.config.output_file
        )
    
    def _init_output_file(self, output_file: str) -> None:
        """Initialize the output file with an empty JSON array if it doesn't exist"""
        os.makedirs(os.path.dirname(output_file) if os.path.dirname(output_file) else '.', exist_ok=True)
        
        if not os.path.exists(output_file):
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write('[]')
    
    def _append_article(self, article: VikalpaArticle, output_file: str):
        """Append a single article to the JSON output file"""
        with open(output_file, 'r', encoding='utf-8') as f:
            articles_data = json.load(f)
        
        articles_data.append(asdict(article))
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(articles_data, f, ensure_ascii=False, indent=2)
    
    # ─── Main Scrape Loop ─────────────────────────────────────────────
    
    def _scrape_url_list(self, pending_urls: List[str], output_path: str,
                         label: str = "") -> List[VikalpaArticle]:
        """Scrape a list of URLs and save results. Returns scraped articles."""
        articles = []
        prefix = f"[{label}] " if label else ""
        
        for i, url in enumerate(pending_urls, 1):
            print(f"  {prefix}[{i}/{len(pending_urls)}] {url}")
            article = self.scrape_article(url)
            if article:
                articles.append(article)
                self._append_article(article, output_path)
                self._mark_url_scraped(url)
                title_preview = article.title[:50] + "..." if len(article.title) > 50 else article.title
                print(f"    ✅ [{self.stats['articles_scraped']} scraped] {title_preview}")
            else:
                self._mark_url_scraped(url)
                print(f"    ⏭️ Skipped")
        
        return articles
    
    def scrape_all(self, max_articles: int = None, urls: List[str] = None, 
                   output_file: str = None, force_refresh_urls: bool = False,
                   watch: bool = True,
                   watch_interval: float = 300.0) -> List[VikalpaArticle]:
        """
        Scrape all articles with resume support and live new-article watching.
        
        Steps:
            1. Load or fetch article URLs (cached in vikalpa_links.txt)
            1b. Merge with fresh sitemap URLs to catch new articles
            2. Load already-scraped URLs (from vikalpa_scraped.txt)
            3. Start background watcher thread to poll for new articles
            4. Scrape pending articles (oldest first)
            5. After initial batch, scrape any new URLs found by watcher
            6. Stop watcher
        
        Args:
            max_articles: Maximum total articles to scrape (including already scraped)
            urls: Override URLs to scrape (skips sitemap/file loading)
            output_file: Custom output file path
            force_refresh_urls: Force re-fetching URLs from sitemap
            watch: Enable background watching for new articles (default: True)
            watch_interval: Seconds between sitemap polls for new articles (default: 300)
        """
        print("\n🚀 Starting Vikalpa scraper...")
        print("=" * 60)
        
        # Step 1: Get all article URLs (from file or sitemap)
        if urls is None:
            all_urls = self.get_or_fetch_urls(force_refresh=force_refresh_urls)
            
            # Step 1b: Merge with fresh sitemap URLs to catch latest articles
            if not force_refresh_urls:
                print("\n🔄 Checking for new articles from sitemap...")
                cached_set = set(all_urls)
                fresh_urls = self.get_article_urls_from_sitemap()
                new_urls = fresh_urls - cached_set
                if new_urls:
                    print(f"  🆕 Found {len(new_urls)} new article URLs")
                    merged = cached_set | fresh_urls
                    self._save_urls_to_file(merged)
                    all_urls = self._sort_urls_oldest_first(merged)
                    self.stats['urls_found'] = len(all_urls)
                else:
                    print("  ✅ No new articles found")
        else:
            all_urls = list(urls)
            watch = False  # Don't watch when URLs are manually provided
        
        if max_articles:
            all_urls = all_urls[:max_articles]
        
        # Step 2: Load previously scraped URLs
        previously_scraped = self._load_scraped_urls()
        self.scraped_urls = previously_scraped.copy()
        
        # Step 3: Determine which URLs still need scraping
        pending_urls = [url for url in all_urls if url not in previously_scraped]
        
        print(f"\n📊 URL Summary:")
        print(f"  Total URLs:           {len(all_urls)}")
        print(f"  Already scraped:      {len(all_urls) - len(pending_urls)}")
        print(f"  Remaining to scrape:  {len(pending_urls)}")
        
        # Step 3b: Start background watcher
        watcher = None
        if watch:
            watcher = NewArticleWatcher(
                scraper=self,
                poll_interval=watch_interval,
            )
            # Seed with all known URLs (cached + scraped) so they aren't re-queued
            all_known = set(all_urls) | previously_scraped
            watcher.seed(all_known)
            watcher.start()
        
        if not pending_urls and not watch:
            print("\n✅ All articles have already been scraped! Nothing to do.")
            self._print_stats()
            return []
        
        # Step 4: Initialize output file (don't overwrite existing)
        output_path = self._get_output_path(output_file)
        self._init_output_file(output_path)
        print(f"\n💾 Output file: {output_path}")
        
        # Step 5: Scrape pending articles
        articles = []
        
        if pending_urls:
            print(f"\n📝 Scraping {len(pending_urls)} remaining articles...")
            batch = self._scrape_url_list(pending_urls, output_path)
            articles.extend(batch)
            
            # After initial batch, also mark these in watcher
            if watcher:
                for url in pending_urls:
                    watcher.mark_known(url)
        
        # Step 6: Drain any new URLs found by watcher during scraping
        if watcher:
            # Do a final drain after the initial batch
            new_from_watcher = watcher.drain_new_urls()
            if new_from_watcher:
                # Filter out already-scraped
                new_pending = [u for u in new_from_watcher if u not in self.scraped_urls]
                if new_pending:
                    new_pending = self._sort_urls_oldest_first(new_pending)
                    print(f"\n🆕 Scraping {len(new_pending)} new articles found by watcher...")
                    batch = self._scrape_url_list(new_pending, output_path, label="NEW")
                    articles.extend(batch)
            
            watcher.stop()
        
        self._print_stats()
        print(f"\n💾 {len(articles)} new articles saved to: {output_path}")
        return articles
    
    def _print_stats(self):
        """Print scraping statistics"""
        print("\n" + "=" * 60)
        print("📊 Scraping Statistics")
        print("=" * 60)
        print(f"  URLs found:        {self.stats['urls_found']}")
        print(f"  Articles scraped:  {self.stats['articles_scraped']}")
        print(f"  Articles skipped:  {self.stats['articles_skipped']}")
        print(f"  Errors:            {self.stats['errors']}")
        print("=" * 60)
    
    def save_results(self, articles: List[VikalpaArticle], output_file: str = None):
        """Save scraped articles to JSON file (full overwrite)"""
        output_file = output_file or os.path.join(
            self.config.output_dir, 
            self.config.output_file
        )
        
        os.makedirs(os.path.dirname(output_file) if os.path.dirname(output_file) else '.', exist_ok=True)
        
        articles_data = [asdict(article) for article in articles]
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(articles_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 Saved {len(articles)} articles to: {output_file}")
    
    def reset_progress(self):
        """Reset scraping progress (delete scraped log). URLs file is kept."""
        if os.path.exists(self.scraped_log_file):
            os.remove(self.scraped_log_file)
            print(f"🗑️ Deleted {self.scraped_log_file}")
        self.scraped_urls.clear()
        print("✅ Progress reset. URLs file preserved.")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Vikalpa News Scraper')
    parser.add_argument('--max', type=int, default=None, help='Maximum articles to scrape')
    parser.add_argument('--output', type=str, default=None, help='Output file path')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between requests (seconds)')
    parser.add_argument('--refresh-urls', action='store_true', help='Force re-fetch URLs from sitemap')
    parser.add_argument('--reset', action='store_true', help='Reset scraping progress and start over')
    parser.add_argument('--no-watch', action='store_true', help='Disable background watching for new articles')
    parser.add_argument('--watch-interval', type=float, default=300.0, help='Seconds between sitemap polls for new articles (default: 300)')
    args = parser.parse_args()
    
    # Configure
    config = VikalpaConfig(request_delay=args.delay)
    
    # Run scraper
    scraper = VikalpaScraper(config)
    
    if args.reset:
        scraper.reset_progress()
    
    scraper.scrape_all(
        max_articles=args.max, 
        output_file=args.output,
        force_refresh_urls=args.refresh_urls,
        watch=not args.no_watch,
        watch_interval=args.watch_interval,
    )


if __name__ == '__main__':
    main()
