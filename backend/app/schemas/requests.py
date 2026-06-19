from typing import Literal
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    language: str | None = None
    mode: Literal["full", "beginner", "senior"] = "full"


class GenerateTestsRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    language: str | None = None


class GenerateDocsRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    language: str | None = None


class ConvertLanguageRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    source_lang: str
    target_lang: str


class ArchitectureDiagramRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    language: str | None = None


class SecurityScanRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    language: str | None = None


class InterviewQuestionsRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    language: str | None = None


class CommitMessageRequest(BaseModel):
    diff: str = Field(..., min_length=1, max_length=100_000)


class GithubFetchRequest(BaseModel):
    url: str = Field(..., min_length=1)
