import os
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv

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

from supabase import create_client
from email_validator import validate_email, EmailNotValidError


# ========================
# CONFIG
# ========================

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

ADMIN_GROUP_ID = int(
    os.getenv("ADMIN_GROUP_ID", "3845665410")
)


logging.basicConfig(
    level=logging.INFO
)


# =========================
# SERVICES
# =========================

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


bot = Bot(
    token=BOT_TOKEN
)


dp = Dispatcher(
    storage=MemoryStorage()
)


# =========================
# STATES
# =========================

class Assessment(StatesGroup):

    request_type = State()

    subject = State()

    goal = State()

    wiki_status = State()

    contact_type = State()

    contact_value = State()



# =========================
# KEYBOARDS
# =========================

def button(text, data):

    return InlineKeyboardButton(
        text=text,
        callback_data=data
    )


def menu_keyboard():

    return InlineKeyboardMarkup(
        inline_keyboard=[

            [
                button(
                    "Start Assessment",
                    "start_assessment"
                )
            ],

            [
                button(
                    "Learn About NotablePath",
                    "about"
                )
            ],

            [
                button(
                    "Contact Consultant",
                    "contact"
                )
            ]

        ]
    )



def request_keyboard():

    options = [

        "I want to understand if I qualify for Wikipedia",

        "I need help improving an existing article",

        "I need research/source analysis",

        "I need guidance for a company or organization",

        "I need guidance for a personal profile",

        "I'm not sure yet"

    ]


    return InlineKeyboardMarkup(
        inline_keyboard=[

            [
                button(
                    option,
                    option
                )
            ]

            for option in options
        ]
    )



def goal_keyboard():

    options = [

        "Build knowledge presence",

        "Improve existing information",

        "Understand Wikipedia requirements",

        "Research my options",

        "Other"

    ]


    return InlineKeyboardMarkup(
        inline_keyboard=[

            [
                button(
                    x,
                    x
                )
            ]

            for x in options

        ]
    )



def wiki_keyboard():

    return InlineKeyboardMarkup(
        inline_keyboard=[

            [
                button(
                    "Yes, an existing article",
                    "existing"
                )
            ],

            [
                button(
                    "No article yet",
                    "none"
                )
            ],

            [
                button(
                    "Not sure",
                    "unknown"
                )
            ]

        ]
    )



def contact_keyboard():

    return InlineKeyboardMarkup(
        inline_keyboard=[

            [
                button(
                    "Telegram username",
                    "telegram"
                )
            ],

            [
                button(
                    "Email",
                    "email"
                )
            ],

            [
                button(
                    "Leave a message",
                    "message"
                )
            ]

        ]
    )



# =========================
# START
# =========================

@dp.message(CommandStart())
async def start(message: Message):

    await message.answer(

"""Welcome to NotablePath Assessment Assistant.

NotablePath helps individuals and organizations understand Wikipedia requirements through research, source analysis, and professional consultation.

Wikipedia is built on reliable information and editorial standards, not advertising.

Answer a few questions and we will help you understand your next steps.

By continuing, you agree that NotablePath may use your submitted information only to review your request and provide consultation assistance.""",

        reply_markup=menu_keyboard()

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

        "What type of Wikipedia assistance are you looking for?",

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


    await state.set_state(
        Assessment.subject
    )


    await callback.message.answer(

        "What is the subject/topic?\n\nExamples:\nPerson\nCompany\nOrganization\nBook\nArtist\nOther"

    )



# =========================
# QUESTION 2
# =========================


@dp.message(
    Assessment.subject
)
async def subject(

    message:Message,
    state:FSMContext

):

    await state.update_data(

        subject=message.text

    )


    await state.set_state(

        Assessment.goal

    )


    await message.answer(

        "What is your main goal?",

        reply_markup=goal_keyboard()

    )



# =========================
# QUESTION 3
# =========================


@dp.callback_query(
    Assessment.goal
)
async def goal(

    callback:CallbackQuery,
    state:FSMContext

):

    await state.update_data(

        goal=callback.data

    )


    await state.set_state(

        Assessment.wiki_status

    )


    await callback.message.answer(

        "Do you currently have Wikipedia coverage?",

        reply_markup=wiki_keyboard()

    )



# =========================
# QUESTION 4
# =========================


@dp.callback_query(
    Assessment.wiki_status
)
async def wiki_status(

    callback:CallbackQuery,
    state:FSMContext

):

    await state.update_data(

        wiki_status=callback.data

    )


    await state.set_state(

        Assessment.contact_type

    )


    await callback.message.answer(

        "Where can our consultant contact you?",

        reply_markup=contact_keyboard()

    )



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


    record = {


        "telegram_id":
        user.id,


        "username":
        user.username,


        "full_name":
        user.full_name,


        "request_type":
        data["request_type"],


        "subject":
        data["subject"],


        "goal":
        data["goal"],


        "wiki_status":
        data["wiki_status"],


        "contact_type":
        data["contact_type"],


        "contact_value":
        contact,


        "created_at":
        datetime.now(
            timezone.utc
        ).isoformat()

    }



    supabase.table(
        "assessments"
    ).insert(
        record
    ).execute()



    admin_message=f"""

New NotablePath Assessment


Name:
{user.full_name}


Contact:
{contact}


Request Type:
{data['request_type']}


Subject:
{data['subject']}


Goal:
{data['goal']}


Wikipedia Status:
{data['wiki_status']}


Date:
{datetime.now().strftime('%Y-%m-%d %H:%M')}

"""


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

                    button(
                        "Contact Consultant",
                        "contact"
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

        "A consultant will be available to review your request."

    )



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