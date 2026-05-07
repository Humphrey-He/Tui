"""Initial migration

Revision ID: 001_initial
Revises:
Create Date: 2026-05-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types
    run_status = postgresql.ENUM('pending', 'running', 'completed', 'failed', 'cancelled', name='runstatus')
    run_status.create(op.get_bind(), checkfirst=True)

    risk_level = postgresql.ENUM('low', 'medium', 'high', 'critical', name='risklevel')
    risk_level.create(op.get_bind(), checkfirst=True)

    tool_call_status = postgresql.ENUM('created', 'pending_approval', 'running', 'completed', 'failed', 'rejected', name='toolcallstatus')
    tool_call_status.create(op.get_bind(), checkfirst=True)

    approval_status = postgresql.ENUM('pending', 'resolved', name='approvalstatus')
    approval_status.create(op.get_bind(), checkfirst=True)

    approval_decision = postgresql.ENUM('approved', 'rejected', 'edited', name='approvaldecision')
    approval_decision.create(op.get_bind(), checkfirst=True)

    # Create users table
    op.create_table('users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create projects table
    op.create_table('projects',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create sessions table
    op.create_table('sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('last_run_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create runs table
    op.create_table('runs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'running', 'completed', 'failed', 'cancelled', name='runstatus'), nullable=False),
        sa.Column('started_by', sa.String(length=255), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('total_tokens', sa.Integer(), nullable=True),
        sa.Column('estimated_cost', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Update sessions with foreign key to runs
    op.create_foreign_key('sessions_last_run_id_fkey', 'sessions', 'runs', ['last_run_id'], ['id'])

    # Create messages table
    op.create_table('messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('run_id', sa.UUID(), nullable=True),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['runs.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create agent_steps table
    op.create_table('agent_steps',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('run_id', sa.UUID(), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('step_type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['runs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create tool_calls table
    op.create_table('tool_calls',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('run_id', sa.UUID(), nullable=False),
        sa.Column('step_id', sa.UUID(), nullable=True),
        sa.Column('tool_name', sa.String(length=255), nullable=False),
        sa.Column('arguments', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('result', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.Enum('created', 'pending_approval', 'running', 'completed', 'failed', 'rejected', name='toolcallstatus'), nullable=True),
        sa.Column('risk_level', sa.Enum('low', 'medium', 'high', 'critical', name='risklevel'), nullable=True),
        sa.Column('required_permission', sa.String(length=255), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['runs.id'], ),
        sa.ForeignKeyConstraint(['step_id'], ['agent_steps.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create approval_requests table
    op.create_table('approval_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('run_id', sa.UUID(), nullable=False),
        sa.Column('tool_call_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.Enum('pending', 'resolved', name='approvalstatus'), nullable=True),
        sa.Column('requested_action', sa.String(length=500), nullable=False),
        sa.Column('original_args', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('edited_args', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('decision', sa.Enum('approved', 'rejected', 'edited', name='approvaldecision'), nullable=True),
        sa.Column('decision_reason', sa.Text(), nullable=True),
        sa.Column('decided_by', sa.String(length=255), nullable=True),
        sa.Column('decided_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['runs.id'], ),
        sa.ForeignKeyConstraint(['tool_call_id'], ['tool_calls.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create file_diffs table
    op.create_table('file_diffs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('run_id', sa.UUID(), nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=False),
        sa.Column('change_type', sa.String(length=50), nullable=False),
        sa.Column('diff_content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['runs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('actor_id', sa.UUID(), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('target_type', sa.String(length=100), nullable=True),
        sa.Column('target_id', sa.String(length=255), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('file_diffs')
    op.drop_table('approval_requests')
    op.drop_table('tool_calls')
    op.drop_table('agent_steps')
    op.drop_table('messages')
    op.drop_constraint('sessions_last_run_id_fkey', 'sessions', type_='foreignkey')
    op.drop_table('runs')
    op.drop_table('sessions')
    op.drop_table('projects')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

    # Drop enum types
    op.execute('DROP TYPE IF EXISTS approvaldecision')
    op.execute('DROP TYPE IF EXISTS approvalstatus')
    op.execute('DROP TYPE IF EXISTS toolcallstatus')
    op.execute('DROP TYPE IF EXISTS risklevel')
    op.execute('DROP TYPE IF EXISTS runstatus')
