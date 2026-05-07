# Agent Console

An AI Agent Control Console and Workbench. Make agent execution visible, controllable, auditable, and recoverable.

## Architecture

```
frontend/          # Next.js + React + TypeScript
backend/           # FastAPI + Python LangGraph
```

## Tech Stack

### Frontend
- **Framework**: Next.js 15 + React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query + Zustand
- **Real-time**: SSE + WebSocket

### Backend
- **Framework**: FastAPI
- **Agent Runtime**: Python + LangGraph
- **Database**: PostgreSQL + Redis
- **Observability**: OpenTelemetry-ready

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### Using Docker Compose

```bash
# Start all services
docker-compose up

# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your settings

# Run the server
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your settings

# Run the dev server
npm run dev
```

## Project Structure

```
Tui/
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   ├── components/       # React components
│   │   │   └── ui/           # shadcn/ui components
│   │   ├── lib/              # Utilities and API clients
│   │   │   ├── api/          # API client functions
│   │   │   └── realtime/     # SSE and WebSocket clients
│   │   ├── stores/           # Zustand state stores
│   │   └── types/            # TypeScript types
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   └── routes/       # Route handlers
│   │   ├── core/             # Core configuration
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   │   ├── events.py    # SSE event handling
│   │   │   └── audit.py     # Audit logging
│   │   ├── agent/            # Agent runtime
│   │   │   ├── runtime/     # Agent execution
│   │   │   └── tools/       # Tool definitions
│   │   ├── middleware/      # Custom middleware
│   │   └── main.py          # FastAPI application
│   ├── tests/
│   ├── pyproject.toml
│   └── requirements.txt
│
├── docs/                     # Project documentation
├── docker-compose.yml
└── README.md
```

## Core Features

- [x] Session management
- [x] Agent conversation with streaming
- [x] Run timeline
- [x] Tool call inspector
- [x] Human approval flow
- [x] File diff viewer
- [x] Structured logs
- [x] Audit logging
- [x] Real-time SSE events
- [x] WebSocket control

## MVP Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 1 | 2 weeks | Foundation - Next.js + FastAPI setup |
| Phase 2 | 2 weeks | Realtime runs - SSE streaming |
| Phase 3 | 2 weeks | Tool calls and approval |
| Phase 4 | 2 weeks | Files and logs |
| Phase 5 | 2 weeks | Production readiness |

**Total**: 10 weeks

## API Endpoints

### Sessions
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions/{id}` - Get session
- `GET /api/sessions/{id}/messages` - Get messages

### Runs
- `GET /api/runs` - List runs
- `POST /api/runs` - Create run
- `GET /api/runs/{id}` - Get run
- `POST /api/runs/{id}/cancel` - Cancel run
- `GET /api/runs/{id}/events` - SSE events stream

### Approvals
- `GET /api/approvals/pending` - List pending approvals
- `POST /api/approvals/{id}/approve` - Approve
- `POST /api/approvals/{id}/reject` - Reject
- `POST /api/approvals/{id}/edit` - Edit and approve

## License

MIT
