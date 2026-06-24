import os
import logging

from dotenv import load_dotenv

load_dotenv()

from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton
)

from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State

from aiogram.fsm.storage.memory import MemoryStorage
from email_validator import validate_email, EmailNotValidError

from lead_service import (
    build_telegram_assessment,
    create_supabase_client,
    format_admin_message,
    openConsultationBooking,
    parse_website_payload,
    save_assessment,
)


# ========================
# CONFIG
# ========================

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_GROUP_ID = int(os.getenv("ADMIN_GROUP_ID", "3845665410"))

logging.basicConfig(level=logging.INFO)


# =========================
# SERVICES
# =========================

supabase = create_supabase_client()

bot = Bot(token=BOT_TOKEN)

dp = Dispatcher(storage=MemoryStorage())


# =========================
# STATES
# =========================

class Assessment(StatesGroup):

    request_type = State()

    profile_type = State()

    coverage = State()

    draft_status = State()

    goal = State()

    contact_type = State()

    contact_value = State()



# =========================
# KEYBOARDS
# =========================

def button(text, data):
    return InlineKeyboardButton(text=text, callback_data=data)


def menu_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [button("Start Assessment", "start_assessment")],
            [button("Learn About NotablePath", "about")],
            [button("Contact Consultant", "contact")],
        ]
    )


def request_keyboard():
    options = [
        "I want guidance for a new Wikipedia article",
        "I have a rejected draft",
        "I have an existing article",
        "I need source analysis",
        "I am not sure",
    ]
    return InlineKeyboardMarkup(
        inline_keyboard=[[button(option, option)] for option in options]
    )


def profile_keyboard():
    options = [
        "Founder",
        "Business",
        "Author",
        "Artist",
        "Organization",
        "Public Figure",
        "Other",
    ]
    return InlineKeyboardMarkup(
        inline_keyboard=[[button(option, option)] for option in options]
    )


def coverage_keyboard():
    options = [
        "Major Coverage",
        "Some Coverage",
        "Minimal Coverage",
        "Not Sure",
    ]
    return InlineKeyboardMarkup(
        inline_keyboard=[[button(option, option)] for option in options]
    )


def draft_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [button("Yes", "yes")],
            [button("No", "no")],
        ]
    )


def contact_method_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [button("Telegram", "telegram")],
            [button("Email", "email")],
        ]
    )



# =========================
# START
# =========================

@dp.message(CommandStart())
async def start(message: Message, state: FSMContext):
    args = ""
    await state.clear()

    if hasattr(message, "get_args"):
        try:
            args = message.get_args() or ""
        except Exception:
            args = ""

    if not args and message.text:
        parts = message.text.split(maxsplit=1)
        if len(parts) > 1:
            args = parts[1]

    prefill = parse_website_payload(args)
    if prefill:
        await state.update_data(
            prefill_profile_type=prefill.get("profile_type"),
            prefill_readiness_category=prefill.get("readiness_category"),
            prefill_readiness_score=prefill.get("readiness_score"),
            prefill_source="website",
        )

    await message.answer(
        """Welcome to NotablePath Assessment Assistant.

NotablePath helps individuals and organizations understand Wikipedia requirements through research, source analysis, and professional consultation.

Wikipedia is built on reliable information and editorial standards, not advertising.

Answer a few questions and we will help you understand your next steps.

By continuing, you agree that NotablePath may use your submitted information only to review your request and provide consultation assistance.""",
        reply_markup=menu_keyboard(),
    )



# =========================
# ASSESSMENT START
# =========================


@dp.callback_query(
    F.data=="start_assessment"
)
async def begin(
    callback: CallbackQuery,
    state:FSMContext
):

    await state.set_state(
        Assessment.request_type
    )


    await callback.message.answer(

        "What best describes your situation?",

        reply_markup=request_keyboard()

    )


    await callback.answer()



# =========================
# QUESTION 1
# =========================


@dp.callback_query(
    Assessment.request_type
)
async def request_type(

    callback: CallbackQuery,
    state:FSMContext

):

    await state.update_data(

        request_type=callback.data

    )

    data = await state.get_data()
    prefill_profile = data.get("prefill_profile_type")

    if prefill_profile:
        await state.update_data(profile_type=prefill_profile)
        await state.set_state(
            Assessment.coverage
        )
        await callback.message.answer(
            "Do you currently have independent media coverage?",
            reply_markup=coverage_keyboard()
        )
    else:
        await state.set_state(
            Assessment.profile_type
        )
        await callback.message.answer(
            "Who is the subject?",
            reply_markup=profile_keyboard()
        )



# =========================
# QUESTION 2
# =========================


@dp.callback_query(
    Assessment.profile_type
)
async def profile_type(

    callback: CallbackQuery,
    state: FSMContext

):

    await state.update_data(

        profile_type=callback.data

    )


    await state.set_state(

        Assessment.coverage

    )


    await callback.message.answer(

        "Do you currently have independent media coverage?",

        reply_markup=coverage_keyboard()

    )


    await callback.answer()



# =========================
# QUESTION 3
# =========================


@dp.callback_query(
    Assessment.coverage
)
async def coverage(

    callback:CallbackQuery,
    state:FSMContext

):

    await state.update_data(

        coverage=callback.data

    )


    await state.set_state(

        Assessment.draft_status

    )


    await callback.message.answer(

        "Have you previously submitted a Wikipedia draft?",

        reply_markup=draft_keyboard()

    )


    await callback.answer()



# =========================
# QUESTION 4
# =========================


@dp.callback_query(
    Assessment.draft_status
)
async def draft_status(

    callback:CallbackQuery,
    state:FSMContext

):

    await state.update_data(

        draft_status=callback.data

    )


    await state.set_state(

        Assessment.goal

    )


    await callback.message.answer(

        "What is your main goal?"

    )


    await callback.answer()



# =========================
# CONTACT
# =========================


@dp.callback_query(
    Assessment.contact_type
)
async def contact_type(

    callback:CallbackQuery,
    state:FSMContext

):

    await state.update_data(

        contact_type=callback.data

    )


    await state.set_state(

        Assessment.contact_value

    )


    await callback.message.answer(

        "Please provide your contact information."

    )

    await callback.answer()



# =========================
# QUESTION 5


@dp.message(
    Assessment.goal
)
async def goal(

    message:Message,
    state:FSMContext

):

    await state.update_data(

        goal=message.text

    )


    await state.set_state(

        Assessment.contact_type

    )


    await message.answer(

        "What is your preferred contact method?",

        reply_markup=contact_method_keyboard()

    )


# =========================
# SAVE LEAD
# =========================


@dp.message(
    Assessment.contact_value
)
async def finish(

    message:Message,
    state:FSMContext

):

    data = await state.get_data()


    contact = message.text



    if data["contact_type"]=="email":

        try:

            validate_email(contact)

        except EmailNotValidError:

            await message.answer(
                "Please provide a valid email address."
            )

            return



    user = message.from_user


    username = user.username if user.username else None
    full_name = getattr(user, "full_name", None) or f"{user.first_name or ''} {user.last_name or ''}".strip() or "Telegram User"
    record = build_telegram_assessment(
        telegram_id=user.id,
        username=username,
        full_name=full_name,
        request_type=data["request_type"],
        subject=data.get("profile_type", "Unknown"),
        goal=data["goal"],
        wiki_status=data.get("coverage", "Not Sure"),
        contact_type=data["contact_type"],
        contact_value=contact,
        draft_status=data.get("draft_status", "Unknown"),
        prefill_source=data.get("prefill_source"),
        readiness_score=data.get("prefill_readiness_score"),
        readiness_category=data.get("prefill_readiness_category"),
    )



    result = save_assessment(supabase, record)
    if result.error:
        logging.error("Failed to save Telegram assessment: %s", result.error)
        await message.answer(
            "There was an issue saving your assessment. Please try again later."
        )
        return


    admin_message = format_admin_message(record)

    await bot.send_message(

        ADMIN_GROUP_ID,

        admin_message

    )



    await message.answer(

"""Thank you for completing the assessment.

Your information has been received by NotablePath.

A consultant will review your request and provide guidance based on Wikipedia standards.""",

        reply_markup=InlineKeyboardMarkup(

            inline_keyboard=[

                [

                    InlineKeyboardButton(
                        "Book Consultation",
                        url=openConsultationBooking()
                    )

                ],

                [

                    button(
                        "Main Menu",
                        "about"
                    )

                ]

            ]

        )

    )


    await state.clear()



# =========================
# ABOUT
# =========================


@dp.callback_query(
    F.data=="about"
)
async def about(callback:CallbackQuery):

    await callback.message.answer(

"""NotablePath provides Wikipedia research, editing support, source analysis, and consultation.

Our approach focuses on understanding Wikipedia standards, reliable sources, and editorial requirements.

We do not guarantee approval or bypass Wikipedia policies."""

    )


# =========================
# CONTACT
# =========================


@dp.callback_query(
    F.data=="contact"
)
async def contact(callback:CallbackQuery):

    await callback.message.answer(

        "A consultant will be available to review your request.",

        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        "Book Consultation",
                        url=openConsultationBooking(),
                    )
                ]
            ]
        )

    )



@dp.errors()
async def handle_errors(update, exception):
    logging.exception("Update failed: %s", exception)


# =========================
# RUN
# =========================


async def main():

    print(
        "NotablePath Bot Started"
    )

    await dp.start_polling(
        bot
    )



if __name__=="__main__":

    import asyncio

    asyncio.run(
        main()
    )