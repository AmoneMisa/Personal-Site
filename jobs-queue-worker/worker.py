import json
import os
import time
import urllib.request

import pika

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "")
FRONTEND_URL = os.environ.get("JOBS_FRONTEND_URL", "http://frontend:3000").rstrip("/")
QUEUE_INTERNAL_KEY = os.environ.get("QUEUE_INTERNAL_KEY", "")
MODE = os.environ.get("QUEUE_MODE", "worker").strip().lower()
REFRESH_SECONDS = max(60, int(os.environ.get("QUEUE_REFRESH_SECONDS", "1800")))
PREFETCH = max(1, int(os.environ.get("QUEUE_PREFETCH", "1")))
MAX_ATTEMPTS = max(1, int(os.environ.get("QUEUE_MAX_ATTEMPTS", "5")))

MAIN_QUEUE = "crawl.jobs.source"
RETRY_QUEUE = "crawl.jobs.source.retry"
DEAD_QUEUE = "crawl.jobs.source.dead"
SOURCES = ["remotive", "remoteok", "arbeitnow", "themuse", "jobicy", "adzuna", "jooble", "rss", "companies", "devkg", "ishgo", "itjobsuz", "telegram", "linkedin", "olx"]


def connect():
    if not RABBITMQ_URL:
        raise RuntimeError("RABBITMQ_URL is not configured")
    params = pika.URLParameters(RABBITMQ_URL)
    params.heartbeat = 30
    params.blocked_connection_timeout = 60
    return pika.BlockingConnection(params)


def declare(channel):
    channel.queue_declare(MAIN_QUEUE, durable=True)
    channel.queue_declare(RETRY_QUEUE, durable=True, arguments={"x-message-ttl": 30000, "x-dead-letter-exchange": "", "x-dead-letter-routing-key": MAIN_QUEUE})
    channel.queue_declare(DEAD_QUEUE, durable=True)


def publish(channel, queue, payload, attempt=0):
    channel.basic_publish(
        exchange="",
        routing_key=queue,
        body=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        properties=pika.BasicProperties(delivery_mode=2, content_type="application/json", headers={"attempt": attempt}),
        mandatory=True,
    )


def dispatch_forever():
    while True:
        try:
            connection = connect()
            channel = connection.channel()
            channel.confirm_delivery()
            declare(channel)
            for source in SOURCES:
                publish(channel, MAIN_QUEUE, {"type": "jobs.refresh.source", "source": source, "queuedAt": int(time.time())})
            print(f"[jobs:queue:dispatcher] queued {len(SOURCES)} source tasks", flush=True)
            connection.close()
        except Exception as exc:
            print(f"[jobs:queue:dispatcher] error: {exc}", flush=True)
        time.sleep(REFRESH_SECONDS)


def execute_task(payload):
    source = str(payload.get("source") or "")
    if payload.get("type") != "jobs.refresh.source" or source not in SOURCES:
        raise ValueError("unsupported job source task")
    if len(QUEUE_INTERNAL_KEY) < 16:
        raise RuntimeError("QUEUE_INTERNAL_KEY must be at least 16 characters")

    request = urllib.request.Request(
        f"{FRONTEND_URL}/internal/jobs-refresh-source",
        method="POST",
        data=json.dumps({"source": source}).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "jobs-rabbit-worker/2.0", "X-Queue-Key": QUEUE_INTERNAL_KEY},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def worker_forever():
    while True:
        try:
            connection = connect()
            channel = connection.channel()
            declare(channel)
            channel.basic_qos(prefetch_count=PREFETCH)

            def on_message(ch, method, properties, body):
                try:
                    payload = json.loads(body.decode("utf-8"))
                    result = execute_task(payload)
                    ch.basic_ack(method.delivery_tag)
                    print(f"[jobs:queue:worker] completed source={payload.get('source')} fetched={result.get('fetched', 0)}", flush=True)
                except Exception as exc:
                    attempt = int((properties.headers or {}).get("attempt", 0)) + 1
                    try:
                        payload = json.loads(body.decode("utf-8"))
                    except Exception:
                        payload = {"raw": body.decode("utf-8", errors="replace")}
                    target = RETRY_QUEUE if attempt < MAX_ATTEMPTS else DEAD_QUEUE
                    publish(ch, target, payload, attempt=attempt)
                    ch.basic_ack(method.delivery_tag)
                    print(f"[jobs:queue:worker] failed attempt={attempt} target={target}: {exc}", flush=True)

            channel.basic_consume(MAIN_QUEUE, on_message_callback=on_message)
            print("[jobs:queue:worker] consuming source tasks", flush=True)
            channel.start_consuming()
        except Exception as exc:
            print(f"[jobs:queue:worker] connection error: {exc}", flush=True)
            time.sleep(5)


if __name__ == "__main__":
    dispatch_forever() if MODE == "dispatcher" else worker_forever()
