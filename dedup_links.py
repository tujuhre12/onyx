import csv

companies = {}

with open("twitter_links.txt", "r") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue

        parts = line.split(":", 1)
        if len(parts) != 2:
            continue

        company, url = parts
        url = url.strip()

        # Store only the first URL for each company
        if company not in companies:
            companies[company] = url

# Write to CSV
with open("company_links.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["Company", "Link"])
    for company, url in sorted(companies.items()):
        writer.writerow([company, url])

print(f"Deduped {len(companies)} companies to company_links.csv")
