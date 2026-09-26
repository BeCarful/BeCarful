FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir . \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser
EXPOSE 8080

CMD ["uvicorn", "cv_module.api.app:app", "--host", "0.0.0.0", "--port", "8080"]

FROM runtime AS test
USER root
COPY tests ./tests
RUN pip install --no-cache-dir ".[dev]"
USER appuser
CMD ["pytest", "--cov=cv_module", "--cov-report=term-missing"]

