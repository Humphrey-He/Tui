from fastapi import APIRouter
from .sessions import router as sessions_router
from .runs import router as runs_router
from .tool_calls import router as tool_calls_router, approval_router
from .auth import router as auth_router
from .projects import router as projects_router
from .audit import router as audit_router
from .logs import router as logs_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(sessions_router)
api_router.include_router(runs_router)
api_router.include_router(tool_calls_router)
api_router.include_router(approval_router)
api_router.include_router(audit_router)
api_router.include_router(logs_router)
