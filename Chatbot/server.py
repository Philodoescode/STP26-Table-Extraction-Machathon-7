import os
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types


from knowledge import get_company_knowledge

load_dotenv()



print(os.getenv("GEMINI_API_KEY"))
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

class Message(BaseModel):
    role: str  # 'user' or 'model'
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]

@app.post("/chat")
async def chat_endpoint(body: ChatRequest):
    try:
        system_prompt = get_company_knowledge()
        full_instruction = f"{system_prompt}\n\nRespond only in Egyptian Arabic (Ammiya)."
        contents_for_gemini = []
        

        for msg in body.messages:
            role = "model" if msg.role in ["assistant", "model"] else "user"
            contents_for_gemini.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.content)]
                )
            )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents_for_gemini,
            config=types.GenerateContentConfig(
                system_instruction=full_instruction,
                temperature=0.7,
            )
        )

        return {"reply": response.text}

    except Exception as e:
        print(f"Detailed Error: {e}")
        return {"error_detail": str(e)}