FROM python:3.13-slim AS base

LABEL org.opencontainers.image.title="Nabby" \
      org.opencontainers.image.description="Self-hosted web UI for yt-dlp" \
      org.opencontainers.image.source="https://github.com/NJPTeam/nabby" \
      org.opencontainers.image.licenses="MIT"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system nabby \
 && useradd  --system --gid nabby --home /app --shell /usr/sbin/nologin nabby

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY --chown=nabby:nabby app.py ./
COPY --chown=nabby:nabby templates/ ./templates/
COPY --chown=nabby:nabby static/    ./static/

RUN mkdir -p /app/downloads && chown nabby:nabby /app/downloads
VOLUME ["/app/downloads"]

USER nabby
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5000/',timeout=3).status==200 else 1)" || exit 1

CMD ["gunicorn", "--workers", "2", "--threads", "4", "--worker-class", "gthread", \
     "--bind", "0.0.0.0:5000", "--timeout", "3600", "--graceful-timeout", "30", \
     "--access-logfile", "-", "--error-logfile", "-", "app:app"]
