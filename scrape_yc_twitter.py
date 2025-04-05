#!/usr/bin/env python3
import argparse
import asyncio

from playwright.async_api import async_playwright


async def scrape_twitter_links(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False
        )  # Use non-headless for better scrolling
        page = await browser.new_page(viewport={"width": 1280, "height": 800})

        print(f"Navigating to main page: {url}")
        await page.goto(url)
        await page.wait_for_load_state("networkidle")

        # More aggressive scrolling to load all company cards
        company_links = set()  # Use a set for automatic deduplication
        no_new_links_count = 0

        print("Starting to scroll and collect company links...")

        # First, try scrolling to the very bottom
        await scroll_to_bottom(page)

        # Then collect all links
        prev_size = 0
        while True:
            # Get all company links
            elements = await page.query_selector_all('a[href^="/companies/"]')

            for element in elements:
                href = await element.get_attribute("href")
                if href and "/companies/" in href and "?" not in href:
                    company_url = f"https://www.ycombinator.com{href}"
                    company_links.add(company_url)

            current_size = len(company_links)
            print(f"Found {current_size} unique company links so far...")

            if current_size == prev_size:
                no_new_links_count += 1
                if no_new_links_count >= 3:
                    print("No new links found after multiple attempts, ending scroll.")
                    break
            else:
                no_new_links_count = 0

            prev_size = current_size

            # Try to click "Load More" button if it exists
            try:
                load_more = await page.query_selector('button:has-text("Load More")')
                if load_more:
                    await load_more.click()
                    print("Clicked 'Load More' button")
                    await page.wait_for_timeout(3000)
                    await scroll_to_bottom(page)
                    continue
            except Exception as e:
                print(f"Error clicking Load More: {str(e)}")

            # Scroll more
            try:
                await scroll_to_bottom(page)
            except Exception as e:
                print(f"Error scrolling: {str(e)}")
                break

        print(f"Found {len(company_links)} total unique company links after scrolling")

        # Visit each company page and extract Twitter links
        twitter_data = []

        for i, company_url in enumerate(sorted(company_links)):
            print(f"Processing company {i+1}/{len(company_links)}: {company_url}")
            try:
                await page.goto(company_url)
                await page.wait_for_load_state("networkidle")

                # Extract company name from URL
                company_name = company_url.split("/")[-1]

                # Find all links on the page
                all_links = await page.query_selector_all("a")
                twitter_links = []

                for link in all_links:
                    href = await link.get_attribute("href")
                    if href and ("twitter.com" in href or "x.com" in href):
                        twitter_links.append(href)

                if twitter_links:
                    for twitter_link in twitter_links:
                        twitter_data.append(f"{company_name}: {twitter_link}")
                else:
                    twitter_data.append(f"{company_name}: No Twitter/X link found")

            except Exception as e:
                print(f"Error processing {company_url}: {str(e)}")

        await browser.close()
        return twitter_data


async def scroll_to_bottom(page):
    """Aggressively scroll to the bottom of the page."""
    print("Scrolling to bottom...")

    # Get the current height of the page
    await page.evaluate("document.body.scrollHeight")

    # while True:
    # Scroll to bottom
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    await page.wait_for_timeout(2000)  # Wait for content to load

    # Check if we've reached the bottom
    await page.evaluate("document.body.scrollHeight")
    # if current_height == prev_height:
    #     break

    # Additional scrolls for extra measure
    for _ in range(3):
        await page.keyboard.press("End")
        await page.wait_for_timeout(500)


async def main():
    parser = argparse.ArgumentParser(
        description="Scrape Twitter links from YC company pages"
    )
    parser.add_argument(
        "--url",
        default="https://www.ycombinator.com/companies?batch=W23&batch=S23&batch=S24&batch=F24&batch=S22&batch=W22&query=San%20Francisco",
        help="URL to scrape (default: YC companies from recent batches)",
    )
    parser.add_argument(
        "--output",
        default="twitter_links.txt",
        help="Output file name (default: twitter_links.txt)",
    )
    parser.add_argument(
        "--headless", action="store_true", help="Run in headless mode (default: False)"
    )

    args = parser.parse_args()

    twitter_links = await scrape_twitter_links(args.url)

    # Save to file
    with open(args.output, "w") as f:
        f.write("\n".join(twitter_links))

    print(f"Saved {len(twitter_links)} results to {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
