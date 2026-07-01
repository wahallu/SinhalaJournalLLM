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
CATEGORY     = "International"
CATEGORY_URL = "https://www.itnnews.lk/world/"

OUTPUT_DIR    = "output"
OUTPUT_FILE   = "itn_international.jsonl"
PROGRESS_FILE = "itn_world_progress.json"

# ── VPS-SAFE crawl settings ──────────────────────────────────────────────────
PAGE_TIMEOUT       = 180_000
MAX_RETRY          = 4
RETRY_BASE_DELAY   = 5
BETWEEN_ARTICLES   = 2
BROWSER_RESTART_N  = 50
# ─────────────────────────────────────────────────────────────────────────────

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
    return {"last_page": 0, "total_articles": 0}


def save_progress(progress: dict):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def save_article(article_data: dict):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
    with open(filepath, "a", encoding="utf-8") as f:
        f.write(json.dumps(article_data, ensure_ascii=False) + "\n")


# =========================
# HTML EXTRACTION
# =========================
def extract_article_links(html: str) -> list[str]:
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
    soup = BeautifulSoup(html, "lxml")

    headline = ""
    h1 = soup.find("h1", class_=lambda c: c and "s-title" in c)
    if h1:
        headline = clean_text(h1.get_text())
    if not headline:
        h1 = soup.find("h1")
        headline = clean_text(h1.get_text()) if h1 else ""

    date = ""
    time_el = soup.find("time")
    if time_el:
        date = time_el.get("datetime", "") or clean_text(time_el.get_text())

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
            "--no-sandbox", "--disable-setuid-sandbox",
            "--disable-dev-shm-usage", "--disable-gpu",
            "--disable-gpu-compositing", "--disable-software-rasterizer",
            "--disable-extensions", "--disable-background-networking",
            "--disable-default-apps", "--no-first-run",
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
    crawler_holder, url, cfg, new_crawler_fn, kill_crawler_fn, label="",
):
    for attempt in range(1, MAX_RETRY + 1):
        if _shutdown:
            return None
        try:
            return await crawler_holder[0].arun(url=url, config=cfg)
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
    articles_since_restart = 0

    crawler_holder = [await _new_crawler_async()]
    run_cfg = make_run_cfg(timeout=PAGE_TIMEOUT)

    try:
        page_num = resume_page
        while True:
            if _shutdown:
                break

            listing_url = CATEGORY_URL if page_num == 1 else f"{CATEGORY_URL}page/{page_num}/"
            print(f"\n📄 Fetching listing page {page_num}: {listing_url}")

            res = await fetch_with_retry(
                crawler_holder, listing_url, run_cfg,
                _new_crawler_async, kill_crawler, f"page-{page_num}",
            )

            if not res or not res.html:
                print(f"   ⚠️  Page {page_num} returned no HTML — ending.")
                break

            article_links = extract_article_links(res.html)
            if not article_links:
                print(f"   🏁 No article links on page {page_num} — reached the end.")
                break

            print(f"   Found {len(article_links)} articles on page {page_num}")

            for idx, article_url in enumerate(article_links, 1):
                if _shutdown:
                    break

                if articles_since_restart >= BROWSER_RESTART_N:
                    print(f"🔄 Restarting browser (after {BROWSER_RESTART_N} articles) …")
                    await kill_crawler(crawler_holder[0])
                    await asyncio.sleep(3)
                    crawler_holder[0] = await _new_crawler_async()
                    articles_since_restart = 0
                    run_cfg = make_run_cfg(timeout=PAGE_TIMEOUT)

                art_res = await fetch_with_retry(
                    crawler_holder, article_url, run_cfg,
                    _new_crawler_async, kill_crawler, f"p{page_num}-art{idx}",
                )

                if not art_res or not art_res.html:
                    await asyncio.sleep(BETWEEN_ARTICLES)
                    continue

                headline, content, date = extract_article(art_res.html)

                if not headline or not content or len(content.split()) < 10:
                    await asyncio.sleep(BETWEEN_ARTICLES)
                    continue

                article_data = {
                    "Source":       SOURCE,
                    "Headline":     headline,
                    "News Content": content,
                    "URL":          article_url,
                    "Category":     CATEGORY,
                    "Date":         date,
                }

                save_article(article_data)
                total_articles += 1
                articles_since_restart += 1

                print(f"   ✅ [{CATEGORY}] {headline[:70]}")
                await asyncio.sleep(BETWEEN_ARTICLES)

            progress["last_page"] = page_num
            progress["total_articles"] = total_articles
            save_progress(progress)
            page_num += 1

    finally:
        await kill_crawler(crawler_holder[0])

        progress["total_articles"] = total_articles
        if _shutdown:
            progress["stopped_reason"] = "Interrupted by user or signal"
        else:
            progress["stopped_reason"] = "Completed all pages"
        progress["stopped_at"] = datetime.datetime.now().isoformat()
        save_progress(progress)

        print()
        print(f"🎉 DONE — ITN World News ({CATEGORY})")
        print(f"   Total articles : {total_articles}")
        print(f"   Progress file  : {PROGRESS_FILE}")
        print(f"   Output dir     : {OUTPUT_DIR}/")
        print("💡 Run the script again to resume from where you left off!")


if __name__ == "__main__":
    asyncio.run(main())
