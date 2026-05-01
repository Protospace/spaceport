FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    libffi-dev \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN uv pip install --system "setuptools<69" wheel && \
    uv pip install --system --no-build-isolation -r requirements.txt

COPY . .

RUN test -f apiserver/secrets.py || cp apiserver/secrets.py.example apiserver/secrets.py
RUN mkdir -p data

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
