from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.core import get_db
from app.models import Log
from pydantic import BaseModel

router = APIRouter(prefix="/logs", tags=["logs"])


class LogResponse(BaseModel):
    id: UUID
    run_id: UUID
    level: str
    message: str
    metadata: dict
    created_at: datetime

    class Config:
        from_attributes = True


class LogListResponse(BaseModel):
    logs: list[LogResponse]
    total: int


@router.get("", response_model=LogListResponse)
async def list_logs(
    run_id: Optional[UUID] = Query(None),
    level: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Log).order_by(Log.created_at.desc())

    if run_id:
        query = query.where(Log.run_id == run_id)
    if level:
        query = query.where(Log.level == level)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get logs
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    logs = result.scalars().all()

    return LogListResponse(logs=logs, total=total)
