from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.prompts.system_prompt import CODE_ANALYZER_SYSTEM_PROMPT
from app.schemas.requests import AnalyzeRequest
from app.services.claude import stream_text

router = APIRouter()

_MODE_ADDENDUM = {
    "beginner": "\n\nIMPORTANT: The user is a beginner. Use very simple language, avoid jargon, add helpful analogies.",
    "senior": "\n\nIMPORTANT: The user is a senior engineer. Be concise, skip basics, focus on nuance, edge cases, and advanced optimizations.",
    "full": "",
}


@router.post("/analyze")
async def analyze_code(request: Request, body: AnalyzeRequest):
    lang_hint = f"\nLanguage hint: {body.language}" if body.language else ""
    mode_hint = _MODE_ADDENDUM[body.mode]
    system = CODE_ANALYZER_SYSTEM_PROMPT + mode_hint

    user_message = f"Analyze the following code:{lang_hint}\n\n```\n{body.code}\n```"

    async def event_stream():
        async for chunk in stream_text(system, user_message):
            yield chunk

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")
