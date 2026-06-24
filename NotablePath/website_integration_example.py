"""
website_integration_example.py

A small script demonstrating how the website can:
- Calculate readiness score and category from three questions
- Build a website-style assessment record with `lead_service.build_website_assessment`
- Save the record to Supabase (if configured)
- Generate a Telegram deep link that pre-fills the bot via `lead_service.generate_telegram_deep_link`

Usage: `python website_integration_example.py`

This is an integration example only — adapt to your website stack (JS/Backend) as needed.
"""

import os
from lead_service import (
    build_website_assessment,
    create_supabase_client,
    save_assessment,
    generate_telegram_deep_link,
)


# Scoring rules from project spec
ARTICLE_SCORES = {
    "Yes": 30,
    "No": 15,
    "Unsure": 10,
}

COVERAGE_SCORES = {
    "Major Coverage": 40,
    "Some Coverage": 25,
    "Minimal Coverage": 5,
    "Not Sure": 5,
}

PROFILE_SCORES = {
    "Founder": 15,
    "Business": 15,
    "Author": 20,
    "Artist": 15,
    "Organization": 15,
    "Public Figure": 20,
    "Other": 10,
}


def calculate_readiness(article_status, coverage_status, profile_type):
    score = 0
    score += ARTICLE_SCORES.get(article_status, 0)
    score += COVERAGE_SCORES.get(coverage_status, 0)
    score += PROFILE_SCORES.get(profile_type, 0)

    if score <= 39:
        category = "Early Stage"
    elif score <= 69:
        category = "Requires Further Review"
    else:
        category = "Promising"

    return score, category


def main():
    # Example inputs — in a real website these come from the form fields
    article_status = "Yes"  # Q1
    coverage_status = "Some Coverage"  # Q2
    profile_type = "Founder"  # Q3

    score, category = calculate_readiness(article_status, coverage_status, profile_type)

    print(f"Calculated readiness score: {score}")
    print(f"Readiness category: {category}")

    # Build record compatible with existing `assessments` table
    record = build_website_assessment(
        profile_type=profile_type,
        readiness_category=category,
        readiness_score=score,
        article_status=article_status,
        coverage_status=coverage_status,
        source_url=None,
        page_source="website",
    )

    # Attempt to persist if Supabase is configured
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if url and key:
        client = create_supabase_client()
        resp = save_assessment(client, record)
        try:
            # Supabase response objects differ by client; print helpful info
            print("Saved record to Supabase.")
            print(resp.data if hasattr(resp, 'data') else resp)
        except Exception as e:
            print("Saved call returned, but could not pretty-print response:", e)
    else:
        print("SUPABASE_URL or SUPABASE_KEY not set — skipping save.")

    # Generate a Telegram deep link so the website CTA opens the bot with prefill
    bot_username = os.getenv("BOT_USERNAME") or os.getenv("BOT_TOKEN")
    # If BOT_USERNAME is not set but BOT_TOKEN is, the script won't be able to construct a proper t.me link.
    if bot_username and "@" not in bot_username and "token" not in bot_username.lower():
        deep_link = generate_telegram_deep_link(bot_username, profile_type, category, score)
        print("Telegram deep link:", deep_link)
    else:
        print("Set BOT_USERNAME (bot username without @) in env to generate a Telegram deep link.")


if __name__ == "__main__":
    main()
