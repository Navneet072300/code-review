from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

load_dotenv()

from app.routers.analyze import router as analyze_router
from app.routers.extras import router as extras_router
from app.routers.github import router as github_router

limiter = Limiter(key_func=get_remote_address, default_limits=["20/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="AI Code Reviewer API",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Apply tighter rate limit to the expensive analyze endpoint
@app.middleware("http")
async def noop_middleware(request: Request, call_next):
    return await call_next(request)


app.include_router(analyze_router, prefix="/api")
app.include_router(extras_router, prefix="/api")
app.include_router(github_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
