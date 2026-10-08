FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y     build-essential     libpq-dev     libjpeg-dev     zlib1g-dev     libfreetype6-dev     liblcms2-dev     libwebp-dev     tcl8.6-dev     tk8.6-dev     && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

COPY docker/django/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
