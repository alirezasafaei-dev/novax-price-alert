FROM python:3.10-slim

WORKDIR /app

# Install uv for faster dependency management
RUN pip install uv

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies
RUN uv sync

# Copy source code
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY alembic.ini ./

# Expose port
EXPOSE 8000

# Default command for API
CMD ["uv", "run", "uvicorn", "novax_price_alert.api.main:app", "--host", "0.0.0.0", "--port", "8000"]