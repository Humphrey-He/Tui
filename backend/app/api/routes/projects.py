from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.core import get_db
from app.models import Project, User
from app.schemas import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Project).order_by(Project.updated_at.desc())

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get projects
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    projects = result.scalars().all()

    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", response_model=ProjectResponse)
async def create_project(project_data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    # TODO: Get owner_id from auth
    # For now, get the first user or create a default one
    user_result = await db.execute(select(User).limit(1))
    user = user_result.scalar_one_or_none()

    if not user:
        # Create a default user if none exists
        from app.core.security import get_password_hash
        user = User(
            email="default@example.com",
            name="Default User",
            hashed_password=get_password_hash("default"),
        )
        db.add(user)
        await db.flush()

    project = Project(
        name=project_data.name,
        description=project_data.description,
        owner_id=user.id,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project_data.name is not None:
        project.name = project_data.name
    if project_data.description is not None:
        project.description = project_data.description

    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    return {"message": "Project deleted"}
