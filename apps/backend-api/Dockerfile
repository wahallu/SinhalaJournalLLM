FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000

# WEB_CONCURRENCY worker processes per container (default 2). Inference is
# I/O-bound — the GPU box does the work — so each worker already overlaps many
# requests; more workers mostly buys CPU headroom for JSON, gzip and the
# grammar rule validator. Scale out with more containers behind
# infra/loadbalancer rather than pushing this high.
#
# --proxy-headers so request.client reflects the load balancer's
# X-Forwarded-For hop; rate limiting reads the header itself and needs
# TRUSTED_PROXY_COUNT to match the real proxy chain (see core/rate_limit.py).
ENV WEB_CONCURRENCY=2
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY} --proxy-headers --forwarded-allow-ips='*' --timeout-keep-alive 30"]
