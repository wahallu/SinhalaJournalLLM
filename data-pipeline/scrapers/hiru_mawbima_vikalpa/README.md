# Hiru News

## Activate virtual environment first
cd d:\SinhalaLLM\webscraper
.venv\Scripts\activate

## Basic usage - scrape all articles
python hirunews_scraper.py

## Limit to specific number of articles
python hirunews_scraper.py --max 100

## Custom delay between requests (default is 1 second)
python hirunews_scraper.py --max 50 --delay 0.5

## Limit number of sitemaps to parse (for faster testing)
python hirunews_scraper.py --sitemaps 2 --max 100

## Test sitemap parsing only
python hirunews_scraper.py --test-sitemap

## Test single article extraction
python hirunews_scraper.py --test-article "https://hirunews.lk/123456/article-slug"

## Custom output file
python hirunews_scraper.py --max 100 --output output/custom_file.json

# Custom poll interval (e.g., every 2 minutes)
python hirunews_scraper.py --watch-interval 120

# Disable watching entirely
python hirunews_scraper.py --no-watch

# Vikalpa

## Basic usage - scrape all articles
python vikalpa_scraper.py

## Limit to specific number of articles
python vikalpa_scraper.py --max 100

## Custom delay between requests
python vikalpa_scraper.py --max 50 --delay 0.5

## Custom output file
python vikalpa_scraper.py --max 100 --output output/custom_vikalpa.json

# Custom poll interval (every 2 minutes)
python vikalpa_scraper.py --watch-interval 120

# Disable watching
python vikalpa_scraper.py --no-watch

# Reset progress and start fresh
python vikalpa_scraper.py --reset