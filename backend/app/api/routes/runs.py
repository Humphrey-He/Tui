from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.core import get_db
from app.models import Run, Session, Message, RunStatus
from app.schemas import RunCreate, RunUpdate, RunResponse, RunListResponse
from app.agent.runtime import create_langgraph_agent

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=RunListResponse)
async def list_runs(
    session_id: Optional[UUID] = Query(None),
    status: Optional[RunStatus] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Run).order_by(Run.started_at.desc())

    if session_id:
        query = query.where(Run.session_id == session_id)
    if status:
        query = query.where(Run.status == status)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get runs
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    runs = result.scalars().all()

    return RunListResponse(runs=runs, total=total)


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("", response_model=RunResponse)
async def create_run(run_data: RunCreate, db: AsyncSession = Depends(get_db)):
    # Verify session exists and get project_id
    session_result = await db.execute(select(Session).where(Session.id == run_data.session_id))
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Create run
    run = Run(
        project_id=session.project_id,
        session_id=run_data.session_id,
        model=run_data.model or "gpt-4o",
        status=RunStatus.PENDING,
        started_by="user",  # TODO: Get from auth
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)

    # Save messages
    for msg in run_data.messages:
        message = Message(
            session_id=run_data.session_id,
            run_id=run.id,
            role=msg["role"],
            content=msg["content"],
        )
        db.add(message)

    await db.commit()
    await db.refresh(run)

    # Start the agent in the background
    agent = create_langgraph_agent(run.id)
    import asyncio
    asyncio.create_task(agent.execute())

    return run


@router.patch("/{run_id}", response_model=RunResponse)
async def update_run(
    run_id: UUID,
    run_data: RunUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run_data.status is not None:
        run.status = run_data.status
        if run_data.status == RunStatus.COMPLETED:
            run.completed_at = datetime.utcnow()
        elif run_data.status == RunStatus.CANCELLED:
            run.cancelled_at = datetime.utcnow()

    await db.flush()
    await db.refresh(run)
    return run


@router.post("/{run_id}/cancel", response_model=RunResponse)
async def cancel_run(run_id: UUID, db: AsyncSession = Depends(get_db)):
    from app.agent.runtime import cancel_runtime

    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.status not in [RunStatus.PENDING, RunStatus.RUNNING]:
        raise HTTPException(status_code=400, detail="Cannot cancel non-active run")

    run.status = RunStatus.CANCELLED
    run.cancelled_at = datetime.utcnow()
    await db.flush()
    await db.refresh(run)

    # Cancel the agent runtime
    await cancel_runtime(run_id)

    return run
