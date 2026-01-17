# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Chat is a FastAPI-based web application that serves as a frontend for OpenAI-compatible APIs. It provides user authentication via JWT and proxies chat requests to a configurable upstream API.

## Development Commands

```bash
# Install dependencies (uses uv)
uv sync

# Run development server
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run without reload
uv run python main.py

# Docker
docker compose up --build
```

## Architecture

Single-file backend (`main.py`) with static frontend:

- **Backend**: FastAPI app handling authentication (`/api/login`, `/api/me`) and chat proxy (`/api/chat`, `/api/models`)
- **Frontend**: Static HTML/JS/CSS in `static/` served at root
- **Auth**: JWT tokens with 30-day expiry, users configured via `USERS` env var
- **Chat**: Proxies to upstream OpenAI-compatible API with streaming support via SSE

## Configuration

Environment variables (see `.env.example`):
- `API_BASE_URL`: Upstream API endpoint
- `API_KEY`: API key for upstream service
- `SECRET_KEY`: JWT signing key
- `USERS`: User credentials in format `user1:pass1,user2:pass2`
