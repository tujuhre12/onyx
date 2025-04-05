# YC Company Twitter Scraper

A script that scrapes YC company pages and extracts Twitter/X.com links.

## Requirements

- Python 3.7+
- Playwright

## Installation

1. Install the required packages:

   ```
   pip install -r requirements.txt
   ```

2. Install Playwright browsers:
   ```
   playwright install
   ```

## Usage

Run the script with default settings:

```
python scrape_yc_twitter.py
```

This will scrape the YC companies from recent batches (W23, S23, S24, F24, S22, W22) and save the Twitter links to `twitter_links.txt`.

### Custom URL and Output

```
python scrape_yc_twitter.py --url "https://www.ycombinator.com/companies?batch=W24" --output "w24_twitter.txt"
```

## How it works

1. Navigates to the specified YC companies page
2. Scrolls down to load all company cards
3. Extracts links to individual company pages
4. Visits each company page and extracts Twitter/X.com links
5. Saves the results to a text file
