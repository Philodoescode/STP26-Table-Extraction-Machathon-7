import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from google.genai.errors import APIError
from pydantic import BaseModel, field_validator

# Chatbot modules are at /app/Chatbot; PYTHONPATH=/app so they're importable as a package.
from Chatbot.knowledge import get_company_knowledge
from Chatbot.context_builder import get_job_context_markdown

router = APIRouter(prefix="/api/v1")
logger = logging.getLogger(__name__)

MAX_MESSAGES = 50
MAX_CONTENT_LENGTH = 4000

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=api_key)
    return _client


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
    job_id: Optional[str] = None

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        if not v:
            raise ValueError("messages list cannot be empty.")
        if len(v) > MAX_MESSAGES:
            raise ValueError(f"Too many messages. Max {MAX_MESSAGES}.")
        if v[-1].role not in ("user",):
            raise ValueError("The last message must be from the user.")
        return v


@router.post("/smithy/chat")
async def chat_endpoint(body: ChatRequest):
    try:
        client = _get_client()
        persona = get_company_knowledge()
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
                logger.info("Injected table context for job_id=%s (%d chars)", body.job_id, len(table_markdown))
            else:
                logger.info("No table context available for job_id=%s", body.job_id)

        system_parts.append(
            "\n\nRespond in the EXACT same language and dialect the user writes in. "
            "If the user writes in English, respond in English. "
            "If the user writes in Standard Arabic, respond in Standard Arabic. "
            "If the user writes in Egyptian Arabic (Ammiya), respond in Egyptian Arabic (Ammiya). "
            "Be helpful, concise, and friendly. "
            "If you don't know something, say so politely."
        )

        full_instruction = "".join(system_parts)

        contents_for_gemini = [
            types.Content(
                role="model" if msg.role in ("assistant", "model") else "user",
                parts=[types.Part.from_text(text=msg.content)],
            )
            for msg in body.messages
        ]

        logger.info("Sending %d messages to Gemini", len(contents_for_gemini))

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents_for_gemini,
            config=types.GenerateContentConfig(
                system_instruction=full_instruction,
                temperature=0.7,
                max_output_tokens=2048,
            ),
        )

        if not response.candidates:
            raise HTTPException(
                status_code=400,
                detail="The message was blocked by safety filters. Please rephrase.",
            )

        finish_reason = response.candidates[0].finish_reason
        if finish_reason and finish_reason.name not in ("STOP", "MAX_TOKENS"):
            raise HTTPException(
                status_code=400,
                detail=f"Response stopped unexpectedly: {finish_reason.name}",
            )

        reply_text = response.text
        if not reply_text or not reply_text.strip():
            raise HTTPException(status_code=502, detail="Received an empty response from the AI model.")

        return {"reply": reply_text.strip()}

    except HTTPException:
        raise

    except APIError as e:
        logger.error("Gemini API error: %s", e)
        if "429" in str(e) or getattr(e, "code", None) == 429:
            return {"reply": "We are having some trouble at the moment. Smithy will be back in no time 😊"}
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    except Exception as e:
        logger.exception("Unexpected error: %s", e)
        raise HTTPException(status_code=500, detail="An unexpected server error occurred.")
