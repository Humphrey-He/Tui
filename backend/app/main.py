from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette import EventSourceResponse
import json
import uuid
import asyncio

from app.core import get_settings, engine, async_session_maker
from app.core.database import Base
from app.api import api_router
from app.middleware import RequestLoggingMiddleware, CacheControlMiddleware
from app.services.events import get_run_emitter, event_store
from app.services.websocket import manager, control_handler, ControlMessage

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Store db session maker in app state
    app.state.db_session = async_session_maker

    yield

    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="Agent Console API",
    description="Backend API for Agent Console - AI Agent Control Console and Workbench",
    version="0.1.0",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(CacheControlMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import structlog
    logger = structlog.get_logger()
    logger.exception("Unhandled exception", error=str(exc))

    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) if settings.api_debug else "Internal server error"},
    )


# Include API router
app.include_router(api_router)


# SSE endpoint for run events
@app.get("/api/runs/{run_id}/events")
async def run_events(run_id: str, after_event_id: str = None):
    """SSE endpoint for streaming run events."""
    run_uuid = uuid.UUID(run_id)

    # Get existing events first
    existing_events = await event_store.get_events(run_uuid, after_event_id)

    async def event_generator():
        # Send existing events
        for event in existing_events:
            yield {"event": json.dumps(event)}

        # Stream new events
        emitter = get_run_emitter(run_uuid)
        async for event in emitter.stream_events():
            yield event

    return EventSourceResponse(event_generator())


# WebSocket endpoint for control
@app.websocket("/api/ws/control")
async def websocket_control(websocket: WebSocket):
    """WebSocket endpoint for bidirectional control."""
    client_id = str(uuid.uuid4())
    await manager.connect(websocket, client_id)

    try:
        # Send connected confirmation
        await websocket.send_json({
            "type": "connected",
            "client_id": client_id,
        })

        while True:
            # Receive message
            data = await websocket.receive_json()
            message = ControlMessage.from_dict(data)

            # Handle the message
            await control_handler.handle(message, websocket)

    except WebSocketDisconnect:
        await manager.disconnect(client_id)
    except Exception as e:
        import structlog
        logger = structlog.get_logger()
        logger.exception("WebSocket error", error=str(e))
        await manager.disconnect(client_id)


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}


@app.get("/")
async def root():
    return {
        "name": "Agent Console API",
        "version": "0.1.0",
        "docs": "/docs",
    }
