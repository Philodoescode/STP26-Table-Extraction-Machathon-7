import os
import logging
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import APIError

from knowledge import get_company_knowledge
from context_builder import get_job_context_markdown

# ─── Setup ───────────────────────────────────────────────────────────────────
# Try to load .env from the Chatbot directory, or fallback to the root directory
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in your .env file!")

client = genai.Client(api_key=GEMINI_API_KEY)

MAX_MESSAGES = 50          # prevent context overflow
MAX_CONTENT_LENGTH = 4000  # chars per message

app = FastAPI(
    title="Smithy Chatbot API",
    version="3.0.0",
    description="TableSmith AI assistant powered by Gemini — analyses extracted table data"
)

# Allow frontend (React, etc.) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 🔒 Replace with your frontend URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ──────────────────────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("user", "model", "assistant"):
            raise ValueError(f"Invalid role '{v}'. Must be 'user', 'model', or 'assistant'.")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        if not v or not v.strip():
            raise ValueError("Message content cannot be empty.")
        if len(v) > MAX_CONTENT_LENGTH:
            raise ValueError(f"Message too long. Max {MAX_CONTENT_LENGTH} characters.")
        return v.strip()


class ChatRequest(BaseModel):
    messages: list[Message]
    job_id: Optional[str] = None  # If provided, table context is injected

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        if not v:
            raise ValueError("messages list cannot be empty.")
        if len(v) > MAX_MESSAGES:
            raise ValueError(f"Too many messages. Max {MAX_MESSAGES}.")
        # Must end with a user message
        if v[-1].role not in ("user",):
            raise ValueError("The last message must be from the user.")
        return v


# ─── Endpoints ───────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "ok", "version": "3.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/chat")
async def chat_endpoint(body: ChatRequest):
    try:
        persona = get_company_knowledge()

        # ── Build system instruction ──────────────────────────────────────────
        system_parts = [persona]

        if body.job_id:
            table_markdown = get_job_context_markdown(body.job_id)
            if table_markdown:
                system_parts.append(
                    "\n\n---\n\n"
                    "## Current Job Context\n\n"
                    "The user has just processed a document. Below are ALL the tables that were "
                    "extracted from it, formatted as Markdown. Use these as your primary source "
                    "of truth when answering any question about the data.\n\n"
                    "Rules for using table context:\n"
                    "- Answer questions about specific cells, rows, columns, or values directly from the tables.\n"
                    "- If the user asks to summarize, do so accurately from the data below.\n"
                    "- If something is unclear or missing from the tables, say so.\n"
                    "- Do NOT make up values that aren't in the tables.\n\n"
                    + table_markdown
                )
                logger.info(
                    f"Injected table context for job_id={body.job_id} "
                    f"({len(table_markdown)} chars)"
                )
            else:
                logger.info(
                    f"No table context available for job_id={body.job_id} "
                    "(job not done or not found)"
                )

        system_parts.append(
            "\n\nRespond in the EXACT same language and dialect the user writes in. "
            "If the user writes in English, respond in English. "
            "If the user writes in Standard Arabic, respond in Standard Arabic. "
            "If the user writes in Egyptian Arabic (Ammiya), respond in Egyptian Arabic (Ammiya). "
            "Be helpful, concise, and friendly. "
            "If you don't know something, say so politely."
        )

        full_instruction = "".join(system_parts)

        # ── Build message history ─────────────────────────────────────────────
        contents_for_gemini = []
        for msg in body.messages:
            role = "model" if msg.role in ("assistant", "model") else "user"
            contents_for_gemini.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.content)]
                )
            )

        logger.info(f"Sending {len(contents_for_gemini)} messages to Gemini")

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents_for_gemini,
            config=types.GenerateContentConfig(
                system_instruction=full_instruction,
                temperature=0.7,
                max_output_tokens=2048,
            )
        )

        # Edge case: safety filters blocked the response
        if not response.candidates:
            logger.warning("Gemini returned no candidates (likely safety filter)")
            raise HTTPException(
                status_code=400,
                detail="The message was blocked by safety filters. Please rephrase."
            )

        candidate = response.candidates[0]

        # Edge case: finish reason is not STOP
        finish_reason = candidate.finish_reason
        if finish_reason and finish_reason.name not in ("STOP", "MAX_TOKENS"):
            logger.warning(f"Unexpected finish reason: {finish_reason}")
            raise HTTPException(
                status_code=400,
                detail=f"Response stopped unexpectedly: {finish_reason.name}"
            )

        # Edge case: empty text in response
        reply_text = response.text
        if not reply_text or not reply_text.strip():
            raise HTTPException(
                status_code=502,
                detail="Received an empty response from the AI model."
            )

        return {"reply": reply_text.strip()}

    except HTTPException:
        raise  # Re-raise our own HTTP errors as-is

    except APIError as e:
        logger.error(f"Gemini API error: {e}")
        if "429" in str(e) or getattr(e, "code", None) == 429:
            return {"reply": "We are having some trouble at the moment. Smithy will be back in no time 😊"}
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred.")