import asyncio
import json
import re
import os
import signal
import datetime
from bs4 import BeautifulSoup
from crawl4ai import AsyncWebCrawler
from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig

# =========================
# CONFIG
# =========================
SOURCE       = "itn_news"
CATEGORY_URL = "https://www.itnnews.lk/local/"

OUTPUT_DIR    = "output"
PROGRESS_FILE = "itn_local_progress.json"

# ── VPS-SAFE crawl settings ──────────────────────────────────────────────────
PAGE_TIMEOUT       = 180_000   # 3 min
MAX_RETRY          = 4
RETRY_BASE_DELAY   = 5
BETWEEN_ARTICLES   = 2
BROWSER_RESTART_N  = 50
# ─────────────────────────────────────────────────────────────────────────────

# =========================
# CATEGORY KEYWORDS (Politics detection for local news)
# =========================
POLITICS_STRONG = [
    "අමාත්ය", "අමාත්යවරයා", "අමාත්යංශ",
    "ජනාධිපති", "අගමැති",
    "පාර්ලිමේන්තුව", "මන්ත්රී", "මන්ත්රීවරයා",
    "රජය", "ආණ්ඩුව", "විරෝධී පක්ෂය", "පක්ෂය",
    "ජනපති", "පාලනය", "රජයේ",
    "මැතිවරණය", "ඡන්දය", "පාර්ලිමේන්තු",
    "ආණ්ඩුක්රම ව්යවස්ථාව", "රනිල්",
    "ප්රාදේශීය සභා", "පක්ෂයේ", "මහලේකම්",
    "දේශපාලනය", "දේශපාලනයට", "මැතිවරණ", "ආණ්ඩු",
    "මහින්ද රාජපක්ෂ", "ජනාධිපති",
]

POLITICS_WEAK = [
    "තීරණය", "ප්රකාශ", "චෝදනා", "නියෝග",
    "සම්මත", "රැස්වීම", "පත්", "පාලන", "විරෝධතා",
]

# Output file names
OUTPUT_FILES = {
    "Politics": "itn_local_politics.jsonl",
    "General":  "itn_local_general.jsonl",
}

# Graceful shutdown flag
_shutdown = False

def _handle_signal(sig, frame):
    global _shutdown
    print("\n⚠️  Interrupt received — will stop after the current article and save progress.")
    _shutdown = True

signal.signal(signal.SIGINT,  _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)


# =========================
# TEXT UTILITIES
# =========================
def normalize(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"[^\u0D80-\u0DFFa-zA-Z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.lower().strip()


def count_matches(text, keywords):
    text = normalize(text)
    count = 0
    for kw in keywords:
        kw = normalize(kw)
        if f" {kw} " in f" {text} ":
            count += 1
    return count


def categorize(headline: str, content: str) -> str:
    h = normalize(headline)
    c = normalize(content)

    politics_score = (
        2 * count_matches(h, POLITICS_STRONG) +
        1 * count_matches(c, POLITICS_STRONG) +
        0.5 * count_matches(h, POLITICS_WEAK)
    )

    if politics_score >= 2:
        return "Politics"
    return "General"


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\xa0", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# =========================
# PROGRESS TRACKING
# =========================
def load_progress() -> dict:
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "last_page":      0,
        "total_articles":  0,
        "counts":          {"Politics": 0, "General": 0},
    }


def save_progress(progress: dict):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def save_article(article_data: dict, category: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, OUTPUT_FILES[category])
    with open(filepath, "a", encoding="utf-8") as f:
        f.write(json.dumps(article_data, ensure_ascii=False) + "\n")


# =========================
# HTML EXTRACTION
# =========================
def extract_article_links(html: str) -> list[str]:
    """Extract article URLs from a category listing page."""
    soup = BeautifulSoup(html, "lxml")
    links = []
    seen = set()
    for a in soup.find_all("a", class_="p-url"):
        href = a.get("href", "").strip()
        if href and href not in seen:
            seen.add(href)
            links.append(href)
    return links


def extract_article(html: str):
    """Extract headline, body, and date from an article page."""
    soup = BeautifulSoup(html, "lxml")

    # HEADLINE
    headline = ""
    h1 = soup.find("h1", class_=lambda c: c and "s-title" in c)
    if h1:
        headline = clean_text(h1.get_text())
    if not headline:
        h1 = soup.find("h1")
        headline = clean_text(h1.get_text()) if h1 else ""

    # DATE
    date = ""
    time_el = soup.find("time")
    if time_el:
        date = time_el.get("datetime", "") or clean_text(time_el.get_text())

    # BODY
    body = ""
    content_div = soup.find("div", class_=lambda c: c and "entry-content" in c)
    if content_div:
        paragraphs = content_div.find_all("p")
        if paragraphs:
            body = " ".join([clean_text(p.get_text()) for p in paragraphs if clean_text(p.get_text())])
        else:
            body = clean_text(content_div.get_text(separator=" "))

    return headline, body, date


# =========================
# BROWSER FACTORY
# =========================
def make_browser_cfg() -> BrowserConfig:
    return BrowserConfig(
        headless=True,
        text_mode=True,
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        extra_args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-gpu-compositing",
            "--disable-software-rasterizer",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-default-apps",
            "--no-first-run",
        ],
    )


def make_run_cfg(timeout: int = PAGE_TIMEOUT) -> CrawlerRunConfig:
    return CrawlerRunConfig(
        exclude_external_links=True,
        page_timeout=timeout,
        wait_until="domcontentloaded",
    )


# =========================
# FETCH WITH RETRY
# =========================
_BROWSER_CRASH_PHRASES = (
    "browser has been closed",
    "browser context has been closed",
    "target page, context or browser has been closed",
    "browsercontext.new_page",
    "browser.new_context",
)


async def fetch_with_retry(
    crawler_holder: list,
    url: str,
    cfg: CrawlerRunConfig,
    new_crawler_fn,
    kill_crawler_fn,
    label: str = "",
):
    for attempt in range(1, MAX_RETRY + 1):
        if _shutdown:
            return None
        try:
            result = await crawler_holder[0].arun(url=url, config=cfg)
            return result
        except Exception as e:
            wait = RETRY_BASE_DELAY * (2 ** (attempt - 1))
            short_err = str(e).splitlines()[0][:120]
            is_crash = any(p in short_err.lower() for p in _BROWSER_CRASH_PHRASES)

            if attempt < MAX_RETRY:
                if is_crash:
                    print(f"   💥 [{label}] Browser crash — restarting …")
                    await kill_crawler_fn(crawler_holder[0])
                    await asyncio.sleep(3)
                    crawler_holder[0] = await new_crawler_fn()
                else:
                    print(f"   ⚠️  [{label}] Attempt {attempt}/{MAX_RETRY} failed — "
                          f"retrying in {wait}s. Error: {short_err}")
                    await asyncio.sleep(wait)
            else:
                print(f"   ❌  [{label}] All {MAX_RETRY} attempts failed — skipping. "
                      f"Error: {short_err}")
    return None


# =========================
# MAIN
# =========================
async def _new_crawler_async():
    crawler = AsyncWebCrawler(config=make_browser_cfg())
    await crawler.start()
    return crawler


async def kill_crawler(crawler):
    if crawler:
        await crawler.close()


async def main():
    global _shutdown

    progress = load_progress()
    resume_page = progress.get("last_page", 0) + 1
    total_articles = progress.get("total_articles", 0)
    counts = progress.get("counts", {"Politics": 0, "General": 0})
    articles_since_restart = 0

    crawler_holder = [await _new_crawler_async()]
    run_cfg = make_run_cfg(timeout=PAGE_TIMEOUT)

    try:
        page_num = resume_page
        while True:
            if _shutdown:
                break

            # ── Build listing URL ─────────────────────────────────────────
            if page_num == 1:
                listing_url = CATEGORY_URL
            else:
                listing_url = f"{CATEGORY_URL}page/{page_num}/"

            print(f"\n📄 Fetching listing page {page_num}: {listing_url}")

            res = await fetch_with_retry(
                crawler_holder, listing_url, run_cfg,
                new_crawler_fn=_new_crawler_async,
                kill_crawler_fn=kill_crawler,
                label=f"page-{page_num}",
            )

            if not res or not res.html:
                print(f"   ⚠️  Page {page_num} returned no HTML — ending.")
                break

            article_links = extract_article_links(res.html)
            if not article_links:
                print(f"   🏁 No article links found on page {page_num} — reached the end.")
                break

            print(f"   Found {len(article_links)} articles on page {page_num}")

            # ── Fetch each article ────────────────────────────────────────
            for idx, article_url in enumerate(article_links, 1):
                if _shutdown:
                    break

                # Periodic browser restart
                if articles_since_restart >= BROWSER_RESTART_N:
                    print(f"🔄 Restarting browser (after {BROWSER_RESTART_N} articles) …")
                    await kill_crawler(crawler_holder[0])
                    await asyncio.sleep(3)
                    crawler_holder[0] = await _new_crawler_async()
                    articles_since_restart = 0
                    run_cfg = make_run_cfg(timeout=PAGE_TIMEOUT)

                art_res = await fetch_with_retry(
                    crawler_holder, article_url, run_cfg,
                    new_crawler_fn=_new_crawler_async,
                    kill_crawler_fn=kill_crawler,
                    label=f"p{page_num}-art{idx}",
                )

                if not art_res or not art_res.html:
                    await asyncio.sleep(BETWEEN_ARTICLES)
                    continue

                headline, content, date = extract_article(art_res.html)

                if not headline or not content or len(content.split()) < 10:
                    await asyncio.sleep(BETWEEN_ARTICLES)
                    continue

                category = categorize(headline, content)

                article_data = {
                    "Source":       SOURCE,
                    "Headline":     headline,
                    "News Content": content,
                    "URL":          article_url,
                    "Category":     category,
                    "Date":         date,
                }

                save_article(article_data, category)

                total_articles += 1
                articles_since_restart += 1
                counts[category] = counts.get(category, 0) + 1

                print(f"   ✅ [{category}] {headline[:70]}")

                await asyncio.sleep(BETWEEN_ARTICLES)

            # ── Save progress after each page ─────────────────────────────
            progress["last_page"] = page_num
            progress["total_articles"] = total_articles
            progress["counts"] = counts
            save_progress(progress)

            page_num += 1

    finally:
        await kill_crawler(crawler_holder[0])

        progress["total_articles"] = total_articles
        progress["counts"] = counts
        if _shutdown:
            progress["stopped_reason"] = "Interrupted by user or signal"
        else:
            progress["stopped_reason"] = "Completed all pages"
        progress["stopped_at"] = datetime.datetime.now().isoformat()
        save_progress(progress)

        print()
        print(f"🎉 DONE — ITN Local News")
        print(f"   Total articles : {total_articles}")
        print(f"   Politics       : {counts.get('Politics', 0)}")
        print(f"   General        : {counts.get('General', 0)}")
        print(f"   Progress file  : {PROGRESS_FILE}")
        print(f"   Output dir     : {OUTPUT_DIR}/")
        print("💡 Run the script again to resume from where you left off!")


if __name__ == "__main__":
    asyncio.run(main())
