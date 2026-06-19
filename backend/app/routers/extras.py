from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.requests import (
    ArchitectureDiagramRequest,
    CommitMessageRequest,
    ConvertLanguageRequest,
    GenerateDocsRequest,
    GenerateTestsRequest,
    InterviewQuestionsRequest,
    SecurityScanRequest,
)
from app.services.claude import complete_json, complete_text

router = APIRouter()

# ── Generate Tests ────────────────────────────────────────────────────────────

_TESTS_SYSTEM = (
    "You are a senior software engineer specializing in test-driven development. "
    "Generate comprehensive unit tests for the provided code. "
    "Respond ONLY with valid JSON (no markdown fences): "
    '{"language": string, "test_framework": string, "tests": string, "explanation": string}'
)


@router.post("/generate-tests")
async def generate_tests(body: GenerateTestsRequest):
    lang = f"\nLanguage: {body.language}" if body.language else ""
    user_msg = f"Generate unit tests for:{lang}\n\n```\n{body.code}\n```"
    result = await complete_json(_TESTS_SYSTEM, user_msg)
    return JSONResponse(result)


# ── Generate Docs ─────────────────────────────────────────────────────────────

_DOCS_SYSTEM = (
    "You are a technical writer and senior engineer. "
    "Generate thorough docstrings and README-style documentation for the provided code. "
    "Respond ONLY with valid JSON (no markdown fences): "
    '{"documented_code": string, "readme_section": string, "api_reference": string}'
)


@router.post("/generate-docs")
async def generate_docs(body: GenerateDocsRequest):
    lang = f"\nLanguage: {body.language}" if body.language else ""
    user_msg = f"Generate documentation for:{lang}\n\n```\n{body.code}\n```"
    result = await complete_json(_DOCS_SYSTEM, user_msg)
    return JSONResponse(result)


# ── Convert Language ──────────────────────────────────────────────────────────

_CONVERT_SYSTEM = (
    "You are an expert polyglot programmer. "
    "Translate the provided code from one programming language to another, "
    "preserving logic, structure, and idioms of the target language. "
    "Respond ONLY with valid JSON (no markdown fences): "
    '{"converted_code": string, "notes": string[], "caveats": string[]}'
)


@router.post("/convert-language")
async def convert_language(body: ConvertLanguageRequest):
    user_msg = (
        f"Convert the following {body.source_lang} code to {body.target_lang}:\n\n"
        f"```\n{body.code}\n```"
    )
    result = await complete_json(_CONVERT_SYSTEM, user_msg)
    return JSONResponse(result)


# ── Architecture Diagram ──────────────────────────────────────────────────────

_DIAGRAM_SYSTEM = (
    "You are a software architect. "
    "Analyze the provided code and produce a Mermaid.js diagram describing its structure and execution flow. "
    "Respond ONLY with valid JSON (no markdown fences): "
    '{"diagram": string, "diagram_type": string, "description": string}'
    "\nThe 'diagram' field must contain raw Mermaid syntax (no code fences)."
)


@router.post("/architecture-diagram")
async def architecture_diagram(body: ArchitectureDiagramRequest):
    lang = f"\nLanguage: {body.language}" if body.language else ""
    user_msg = f"Create a Mermaid diagram for:{lang}\n\n```\n{body.code}\n```"
    result = await complete_json(_DIAGRAM_SYSTEM, user_msg)
    return JSONResponse(result)


# ── Security Scan ─────────────────────────────────────────────────────────────

_SECURITY_SYSTEM = (
    "You are an application security engineer specializing in OWASP Top 10. "
    "Perform a thorough security analysis of the provided code. "
    "Respond ONLY with valid JSON (no markdown fences): "
    '{"risk_level": "critical"|"high"|"medium"|"low"|"none", '
    '"vulnerabilities": [{"title": string, "severity": string, "description": string, "line_hint": string, "remediation": string}], '
    '"secure_version": string, "summary": string}'
)


@router.post("/security-scan")
async def security_scan(body: SecurityScanRequest):
    lang = f"\nLanguage: {body.language}" if body.language else ""
    user_msg = f"Security scan for:{lang}\n\n```\n{body.code}\n```"
    result = await complete_json(_SECURITY_SYSTEM, user_msg)
    return JSONResponse(result)


# ── Interview Questions ───────────────────────────────────────────────────────

_INTERVIEW_SYSTEM = (
    "You are a senior engineering interviewer. "
    "Generate insightful interview questions based on the concepts in the provided code. "
    "Mix difficulty levels: beginner, intermediate, advanced. "
    "Respond ONLY with valid JSON (no markdown fences): "
    '{"questions": [{"question": string, "difficulty": "beginner"|"intermediate"|"advanced", "hint": string, "answer": string}]}'
)


@router.post("/interview-questions")
async def interview_questions(body: InterviewQuestionsRequest):
    lang = f"\nLanguage: {body.language}" if body.language else ""
    user_msg = f"Generate interview questions for:{lang}\n\n```\n{body.code}\n```"
    result = await complete_json(_INTERVIEW_SYSTEM, user_msg)
    return JSONResponse(result)


# ── Commit Message ────────────────────────────────────────────────────────────

_COMMIT_SYSTEM = (
    "You are a senior engineer who writes precise conventional commit messages. "
    "Given a git diff, generate a conventional commit message (type(scope): subject) "
    "with an optional body and footer. "
    "Respond ONLY with valid JSON (no markdown fences): "
    '{"commit_message": string, "type": string, "scope": string, "breaking_change": boolean, "explanation": string}'
)


@router.post("/commit-message")
async def commit_message(body: CommitMessageRequest):
    user_msg = f"Generate a commit message for this diff:\n\n```diff\n{body.diff}\n```"
    result = await complete_json(_COMMIT_SYSTEM, user_msg)
    return JSONResponse(result)
