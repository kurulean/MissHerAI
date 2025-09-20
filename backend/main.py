# main.py
import os, json, uuid
from typing import List, Dict, Any, Union
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# --- Load env vars ---
load_dotenv()

# --- OpenAI Client ---
from openai import OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MODEL = "gpt-4o-mini"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- SESSION STORE ----------
SESSIONS: Dict[str, Dict[str, Any]] = {}
MAX_CONTEXT = 20

class StartPayload(BaseModel):
    text: str = ""
    images: List[str] = Field(default_factory=list)

class SendPayload(BaseModel):
    text: str = ""
    images: List[str] = Field(default_factory=list)

ANALYSIS_INSTRUCTIONS = """
You are analyzing past messages to build a texting persona.

Extract the sender’s texting style with EVIDENCE from the text. Be concrete and do not invent.
Return STRICT JSON with these keys (nothing else):

{
  "name": "<string or null>",
  "tone": "<3-8 words: e.g., dry, playful, flirty, blunt>",
  "favorite_phrases": ["<short phrases or slang they reuse>"],
  "emoji_usage": {
    "frequency": "<none | rare | sometimes | frequent>",
    "types": ["😂","🥲","❤️", "..."],
    "position": "<inline | end-of-message | both>",
    "notes": "<e.g., uses stickers/GIFs; avoids emojis entirely>"
  },
  "punctuation_style": {
    "periods": "<always | sometimes | never>",
    "exclamations": "<none | light | heavy>",
    "question_marks": "<none | light | heavy>",
    "ellipses": "<never | sometimes | heavy>",
    "commas": "<sparse | normal | heavy>",
    "quirks": ["double '??', '!!!', '...'", "no caps", "overuses commas"]
  },
  "capitalization": "<normal | all lower | Title Case | RANDOM Caps | switches>",
  "abbreviations": ["u","ur","idk","lmk","btw","tbh", "..."],
  "response_length": "<1-3 words | short | medium | long>",
  "formality": "<very casual | casual | neutral | formal>",
  "cursing": "<never | mild | frequent>",
  "pet_names": ["<e.g., babe, dude, bro>"],
  "quirks": ["<nonstandard spellings, drawn-out letters (soooo), keyboard smashes, etc.>"],
  "boundaries": "<hard lines they state (topics to avoid, time boundaries), or null>",
  "summary": "<2–3 sentences summarizing their style>",
  "opening_line": "<a natural first message they'd send, in their style>",
  "evidence_examples": ["<1–3 short quotes from the text supporting the above>"]
}

Rules:
- Use only what’s in the provided text/images—no guessing.
- If something is not present, use null or an empty list.
- Keep strings short. No explanations outside the JSON.
"""

def build_system_prompt(profile: dict) -> str:
    return (
        "You are the user's ex in a texting simulation.\n"
        f"Style profile (JSON): {json.dumps(profile, ensure_ascii=False)}\n"
        "Imitate this style exactly:\n"
        "- Match slang/abbreviations and emoji frequency (including NONE if they avoid emojis).\n"
        "- Match punctuation habits (periods, !!!, ??, ellipses) and capitalization (e.g., all lowercase).\n"
        "- Match response length—keep it as short as they usually write.\n"
        "- Keep tone and quirks (drawn-out letters, misspellings) consistent.\n"
        "Brevity: 1–2 short sentences max unless the user clearly asks for more.\n"
        "Do not reveal you are an AI. Avoid unsafe/explicit content.\n"
    )

def to_openai_messages(system_prompt: str, history: List[Dict[str, Any]]):
    msgs: List[Dict[str, Union[str, list]]] = [{"role": "system", "content": system_prompt}]
    msgs.extend(history[-MAX_CONTEXT:])
    return msgs

def build_multimodal_user_parts(text: str, images: List[str]):
    parts = []
    if text and text.strip():
        parts.append({"type": "text", "text": text.strip()})
    for url in images:
        parts.append({"type": "image_url", "image_url": {"url": url}})
    if not parts:
        raise HTTPException(400, "Provide text or images.")
    return parts

@app.get("/health")
def health():
    return {"status": "ok", "has_key": bool(os.getenv("OPENAI_API_KEY"))}

@app.post("/api/start")
def start_session(p: StartPayload):
    content_parts = [{"type": "text", "text": ANALYSIS_INSTRUCTIONS}]
    content_parts.extend(build_multimodal_user_parts(
        text=(f"Extra pasted text:\n{p.text}" if p.text else ""), images=p.images
    ))

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": content_parts}],
            temperature=0.6,
            max_tokens=500
        )
        raw = resp.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(500, f"OpenAI error: {e}")

    try:
        profile = json.loads(raw)
    except json.JSONDecodeError:
        profile = {"summary": raw, "opening_line": "Hey."}

    system_prompt = build_system_prompt(profile)
    opening = profile.get("opening_line", "Hey.")

    sid = str(uuid.uuid4())
    SESSIONS[sid] = {
        "system": system_prompt,
        "messages": [{"role": "assistant", "content": opening}],
        "profile": profile,
    }
    return {"session_id": sid, "opening": opening, "profile": profile}

@app.get("/api/session/{sid}/history")
def get_history(sid: str):
    sess = SESSIONS.get(sid)
    if not sess:
        raise HTTPException(404, "Session not found")
    return {"messages": sess["messages"], "profile": sess.get("profile")}

@app.post("/api/session/{sid}/send")
def send_message(sid: str, payload: SendPayload):
    sess = SESSIONS.get(sid)
    if not sess:
        raise HTTPException(404, "Session not found")

    user_parts = build_multimodal_user_parts(payload.text, payload.images)
    sess["messages"].append({"role": "user", "content": user_parts})

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=to_openai_messages(sess["system"], sess["messages"]),
            temperature=0.3,   # tighter style match
            max_tokens=70
        )
        reply = resp.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(500, f"OpenAI error: {e}")

    sess["messages"].append({"role": "assistant", "content": reply})
    return {"reply": reply}
