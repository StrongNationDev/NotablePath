import json
import os
from datetime import datetime, timezone

from supabase import create_client


CALENDLY_URL = os.getenv(
    "CALENDLY_URL",
    "https://calendly.com/notablepath/30min"
)


PROFILE_SLUGS = {
    "founder": "Founder",
    "business": "Business",
    "author": "Author",
    "artist": "Artist",
    "organization": "Organization",
    "public_figure": "Public Figure",
    "other": "Other"
}

CATEGORY_SLUGS = {
    "early_stage": "Early Stage",
    "requires_further_review": "Requires Further Review",
    "promising": "Promising"
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def format_time(timestamp=None):
    if not timestamp:
        timestamp = datetime.now(timezone.utc)
    elif isinstance(timestamp, str):
        try:
            timestamp = datetime.fromisoformat(timestamp)
        except ValueError:
            return timestamp
    return timestamp.astimezone().strftime("%Y-%m-%d %H:%M")


def open_consultation_booking():
    return CALENDLY_URL


def openConsultationBooking():
    return open_consultation_booking()


def create_supabase_client():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    if not supabase_url:
        raise RuntimeError(
            "SUPABASE_URL is not set. Ensure .env is loaded and the variable is defined."
        )
    if not supabase_key:
        raise RuntimeError(
            "SUPABASE_KEY is not set. Ensure .env is loaded and the variable is defined."
        )
    return create_client(supabase_url, supabase_key)


def _serialize_metadata(metadata):
    return json.dumps(metadata, ensure_ascii=False)


def build_website_assessment(
    profile_type,
    readiness_category,
    readiness_score,
    article_status,
    coverage_status,
    source_url=None,
    page_source="website"
):
    metadata = {
        "readiness_score": readiness_score,
        "article_status": article_status,
        "coverage_status": coverage_status,
        "profile_type": profile_type,
        "timestamp": format_time(),
        "page_source": page_source,
        "source_url": source_url,
    }

    return {
        "telegram_id": 0,
        "username": None,
        "full_name": "Website Visitor",
        "request_type": profile_type,
        "subject": profile_type,
        "goal": "Wikipedia Readiness Assessment",
        "wiki_status": readiness_category,
        "contact_type": "website",
        "contact_value": None,
        "lead_status": "new",
        "consultant_notes": _serialize_metadata(metadata),
        "source": "website",
        "created_at": now_iso(),
    }


def build_telegram_assessment(
    telegram_id,
    username,
    full_name,
    request_type,
    subject,
    goal,
    wiki_status,
    contact_type,
    contact_value,
    draft_status,
    prefill_source=None,
    readiness_score=None,
    readiness_category=None,
):
    metadata = {
        "draft_status": draft_status,
        "prefill_source": prefill_source,
        "readiness_score": readiness_score,
        "readiness_category": readiness_category,
        "recorded_at": format_time()
    }

    return {
        "telegram_id": telegram_id,
        "username": username,
        "full_name": full_name,
        "request_type": request_type,
        "subject": subject,
        "goal": goal,
        "wiki_status": wiki_status,
        "contact_type": contact_type,
        "contact_value": contact_value,
        "lead_status": "new",
        "consultant_notes": _serialize_metadata(metadata),
        "source": "telegram",
        "created_at": now_iso(),
    }


def save_assessment(client, record):
    return client.table("assessments").insert(record).execute()


def parse_website_payload(payload):
    if not payload:
        return None

    payload = payload.strip()
    if payload.startswith("start="):
        payload = payload.split("=", 1)[1]

    if not payload.startswith("website_"):
        return None

    parts = payload.split("_")
    if len(parts) < 3:
        return None

    _, profile_slug, category_slug, *score_parts = parts
    profile_type = PROFILE_SLUGS.get(profile_slug)
    readiness_category = CATEGORY_SLUGS.get(category_slug)
    readiness_score = None

    if score_parts:
        score_candidate = score_parts[0]
        if score_candidate.isdigit():
            readiness_score = int(score_candidate)

    if not profile_type or not readiness_category:
        return None

    return {
        "profile_type": profile_type,
        "readiness_category": readiness_category,
        "readiness_score": readiness_score,
    }


def generate_telegram_deep_link(bot_username, profile_type, readiness_category, score=None):
    if not bot_username:
        raise ValueError("Bot username is required to build a Telegram deep link.")

    slug = profile_type.lower().replace(" ", "_")
    category_slug = readiness_category.lower().replace(" ", "_")
    tokens = ["website", slug, category_slug]
    if score is not None:
        tokens.append(str(score))

    payload = "_".join(tokens)
    return f"https://t.me/{bot_username}?start={payload}"


def format_admin_message(record):
    source = record.get("source")
    if source == "website":
        metadata = json.loads(record.get("consultant_notes", "{}"))
        return (
            "🚨 New Website Assessment\n\n"
            f"Readiness:\n{record.get('wiki_status', 'N/A')}\n\n"
            f"Score:\n{metadata.get('readiness_score', 'N/A')}\n\n"
            f"Profile:\n{record.get('request_type', 'N/A')}\n\n"
            f"Coverage:\n{metadata.get('coverage_status', 'N/A')}\n\n"
            "Source:\nWebsite\n\n"
            f"Time:\n{metadata.get('timestamp', format_time())}\n\n"
            "--------------------------------"
        )

    metadata = json.loads(record.get("consultant_notes", "{}"))
    contact_label = "Telegram" if record.get("contact_type") == "telegram" else record.get("contact_type", "Contact")
    username = record.get("username")
    if username and not username.startswith("@"):
        username = f"@{username}"

    return (
        "🚨 New Telegram Assessment\n\n"
        f"Name:\n{record.get('full_name', 'N/A')}\n\n"
        f"Username:\n{username or 'N/A'}\n\n"
        f"Request Type:\n{record.get('request_type', 'N/A')}\n\n"
        f"Subject:\n{record.get('subject', 'N/A')}\n\n"
        f"Coverage:\n{record.get('wiki_status', 'N/A')}\n\n"
        f"Draft Submitted:\n{metadata.get('draft_status', 'N/A')}\n\n"
        f"Goal:\n{record.get('goal', 'N/A')}\n\n"
        f"Contact:\n{record.get('contact_value', 'N/A')}\n\n"
        f"Source:\nTelegram\n\n"
        f"Time:\n{metadata.get('recorded_at', format_time())}\n\n"
        "--------------------------------"
    )
