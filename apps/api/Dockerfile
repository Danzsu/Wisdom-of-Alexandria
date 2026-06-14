FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml ./
COPY uv.lock* ./

# Install dependencies
RUN uv sync --no-dev

# Copy application code
COPY app/ ./app/

# Copy prompt templates (optional mount in compose, copy as fallback)
# Prompts are also mounted at /app/prompts via docker-compose volume

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
