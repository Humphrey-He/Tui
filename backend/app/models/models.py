import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Integer, Float, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class RunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ToolCallStatus(str, enum.Enum):
    CREATED = "created"
    PENDING_APPROVAL = "pending_approval"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"


class ApprovalDecision(str, enum.Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    EDITED = "edited"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="owner")
    audit_logs = relationship("AuditLog", back_populates="actor")


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="projects")
    sessions = relationship("Session", back_populates="project")
    runs = relationship("Run", back_populates="project")
    audit_logs = relationship("AuditLog", back_populates="project")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="sessions")
    messages = relationship("Message", back_populates="session", order_by="Message.created_at")
    runs = relationship("Run", back_populates="session")


class Run(Base):
    __tablename__ = "runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    status = Column(SQLEnum(RunStatus), default=RunStatus.PENDING, nullable=False)
    started_by = Column(String(255), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    model = Column(String(100), default="gpt-4o")
    total_tokens = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)

    # Relationships
    project = relationship("Project", back_populates="runs")
    session = relationship("Session", back_populates="runs")
    messages = relationship("Message", back_populates="run")
    agent_steps = relationship("AgentStep", back_populates="run")
    tool_calls = relationship("ToolCall", back_populates="run")
    approval_requests = relationship("ApprovalRequest", back_populates="run")
    file_diffs = relationship("FileDiff", back_populates="run")
    logs = relationship("Log", back_populates="run")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=True)
    role = Column(String(50), nullable=False)  # user, assistant, system, tool
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("Session", back_populates="messages")
    run = relationship("Run", back_populates="messages")


class AgentStep(Base):
    __tablename__ = "agent_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    step_type = Column(String(50), nullable=False)  # message, tool_call, approval, error
    status = Column(String(50), default="started")  # started, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    run = relationship("Run", back_populates="agent_steps")
    tool_calls = relationship("ToolCall", back_populates="step")


class ToolCall(Base):
    __tablename__ = "tool_calls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False)
    step_id = Column(UUID(as_uuid=True), ForeignKey("agent_steps.id"), nullable=True)
    tool_name = Column(String(255), nullable=False)
    arguments = Column(JSON, nullable=False, default=dict)
    result = Column(JSON, nullable=True)
    status = Column(SQLEnum(ToolCallStatus), default=ToolCallStatus.CREATED)
    risk_level = Column(SQLEnum(RiskLevel), default=RiskLevel.LOW)
    required_permission = Column(String(255), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    run = relationship("Run", back_populates="tool_calls")
    step = relationship("AgentStep", back_populates="tool_calls")
    approval_request = relationship("ApprovalRequest", back_populates="tool_call", uselist=False)


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False)
    tool_call_id = Column(UUID(as_uuid=True), ForeignKey("tool_calls.id"), nullable=True)
    status = Column(SQLEnum(ApprovalStatus), default=ApprovalStatus.PENDING)
    requested_action = Column(String(500), nullable=False)
    original_args = Column(JSON, nullable=False, default=dict)
    edited_args = Column(JSON, nullable=True)
    decision = Column(SQLEnum(ApprovalDecision), nullable=True)
    decision_reason = Column(Text, nullable=True)
    decided_by = Column(String(255), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    run = relationship("Run", back_populates="approval_requests")
    tool_call = relationship("ToolCall", back_populates="approval_request")


class FileDiff(Base):
    __tablename__ = "file_diffs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False)
    file_path = Column(String(1000), nullable=False)
    change_type = Column(String(50), nullable=False)  # created, modified, deleted
    diff_content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    run = relationship("Run", back_populates="file_diffs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    target_type = Column(String(100), nullable=True)
    target_id = Column(String(255), nullable=True)
    metadata = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="audit_logs")
    actor = relationship("User", back_populates="audit_logs")


class Log(Base):
    __tablename__ = "logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False)
    level = Column(String(20), nullable=False, default="info")  # debug, info, warn, error
    message = Column(Text, nullable=False)
    metadata = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    run = relationship("Run", back_populates="logs")
