FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN pip install --no-cache-dir uv==0.11.25
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
