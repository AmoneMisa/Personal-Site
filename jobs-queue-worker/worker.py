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

HIRING_REFRESH_SECONDS = max(60, int(os.environ.get("HIRING_QUEUE_REFRESH_SECONDS", "1800")))
HIRING_BACKFILL_SECONDS = max(60, int(os.environ.get("HIRING_QUEUE_BACKFILL_SECONDS", "300")))
DISPATCH_TICK_SECONDS = max(5, int(os.environ.get("QUEUE_DISPATCH_TICK_SECONDS", "10")))
# Kill switch for the CV channel dispatch, so a misbehaving hiring queue can be
# stopped with an env change and a restart instead of a rebuild. Consumers stay
# registered either way; this only stops new work being queued.
HIRING_QUEUE_ENABLED = os.environ.get("HIRING_QUEUE_ENABLED", "on").strip().lower() != "off"

MAIN_QUEUE = "crawl.jobs.source"
RETRY_QUEUE = "crawl.jobs.source.retry"
DEAD_QUEUE = "crawl.jobs.source.dead"
# CV channels ride their own queue set: a Telegram backlog (one MTProto worker,
# one channel at a time) must not stall the vacancy sources behind it.
HIRING_QUEUE = "crawl.hiring.channel"
HIRING_RETRY_QUEUE = "crawl.hiring.channel.retry"
HIRING_DEAD_QUEUE = "crawl.hiring.channel.dead"
SOURCES = ["remotive", "remoteok", "arbeitnow", "themuse", "jobicy", "adzuna", "jooble", "rss", "companies", "devkg", "ishgo", "itjobsuz", "telegram", "olx"]


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
    channel.queue_declare(HIRING_QUEUE, durable=True)
    channel.queue_declare(HIRING_RETRY_QUEUE, durable=True, arguments={"x-message-ttl": 60000, "x-dead-letter-exchange": "", "x-dead-letter-routing-key": HIRING_QUEUE})
    channel.queue_declare(HIRING_DEAD_QUEUE, durable=True)


def frontend_request(path, payload=None, method="POST"):
    if len(QUEUE_INTERNAL_KEY) < 16:
        raise RuntimeError("QUEUE_INTERNAL_KEY must be at least 16 characters")
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{FRONTEND_URL}{path}",
        method=method,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "jobs-rabbit-worker/2.0", "X-Queue-Key": QUEUE_INTERNAL_KEY},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))


def hiring_source_sets():
    """Regular and unfinished-backfill sources straight from the app."""
    data = frontend_request("/internal/hiring-channels", method="GET")
    handles = [str(handle) for handle in (data.get("handles") or []) if handle]
    backfill = [str(handle) for handle in (data.get("backfillHandles") or []) if handle]
    return handles, backfill


def publish(channel, queue, payload, attempt=0):
    channel.basic_publish(
        exchange="",
        routing_key=queue,
        body=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        properties=pika.BasicProperties(delivery_mode=2, content_type="application/json", headers={"attempt": attempt}),
        mandatory=True,
    )


def dispatch_forever():
    jobs_due_at = 0.0
    hiring_due_at = 0.0
    backfill_due_at = 0.0
    while True:
        now = time.monotonic()
        hiring_is_due = HIRING_QUEUE_ENABLED and (now >= hiring_due_at or now >= backfill_due_at)
        if now < jobs_due_at and not hiring_is_due:
            time.sleep(DISPATCH_TICK_SECONDS)
            continue
        try:
            connection = connect()
            channel = connection.channel()
            channel.confirm_delivery()
            declare(channel)
            if now >= jobs_due_at:
                for source in SOURCES:
                    publish(channel, MAIN_QUEUE, {"type": "jobs.refresh.source", "source": source, "queuedAt": int(time.time())})
                print(f"[jobs:queue:dispatcher] queued {len(SOURCES)} source tasks", flush=True)
                jobs_due_at = now + REFRESH_SECONDS

            # CV channels run on their own cadence, and a failure to read the
            # handle list must not cost us the vacancy dispatch above.
            if HIRING_QUEUE_ENABLED and (now >= hiring_due_at or now >= backfill_due_at):
                try:
                    handles, backfill_handles = hiring_source_sets()
                    if now >= hiring_due_at:
                        for handle in handles:
                            publish(channel, HIRING_QUEUE, {"type": "hiring.refresh.channel", "handle": handle, "queuedAt": int(time.time())})
                        print(f"[hiring:queue:dispatcher] queued {len(handles)} regular source tasks", flush=True)
                        hiring_due_at = now + HIRING_REFRESH_SECONDS
                        backfill_due_at = now + HIRING_BACKFILL_SECONDS
                    elif now >= backfill_due_at:
                        queue_state = channel.queue_declare(queue=HIRING_QUEUE, passive=True)
                        pending = int(queue_state.method.message_count)
                        if pending == 0:
                            for handle in backfill_handles:
                                publish(channel, HIRING_QUEUE, {"type": "hiring.refresh.channel", "handle": handle, "queuedAt": int(time.time())})
                            print(f"[hiring:queue:dispatcher] queued {len(backfill_handles)} backfill source tasks", flush=True)
                        else:
                            print(f"[hiring:queue:dispatcher] backfill sweep skipped; queue has {pending} pending tasks", flush=True)
                        backfill_due_at = now + HIRING_BACKFILL_SECONDS
                except Exception as exc:
                    print(f"[hiring:queue:dispatcher] error: {exc}", flush=True)
                    if now >= hiring_due_at:
                        hiring_due_at = now + 60
                    if now >= backfill_due_at:
                        backfill_due_at = now + 60

            connection.close()
        except Exception as exc:
            print(f"[jobs:queue:dispatcher] error: {exc}", flush=True)
        time.sleep(DISPATCH_TICK_SECONDS)


def execute_task(payload):
    source = str(payload.get("source") or "")
    if payload.get("type") != "jobs.refresh.source" or source not in SOURCES:
        raise ValueError("unsupported job source task")
    return frontend_request("/internal/jobs-refresh-source", {"source": source})


def execute_hiring_task(payload):
    handle = str(payload.get("handle") or "")
    if payload.get("type") != "hiring.refresh.channel" or not handle:
        raise ValueError("unsupported hiring channel task")
    return frontend_request("/internal/hiring-refresh-channel", {"handle": handle})


def consumer(label, runner, retry_queue, dead_queue, describe):
    """One ack/retry policy for both queues; only the task body differs."""

    def on_message(ch, method, properties, body):
        try:
            payload = json.loads(body.decode("utf-8"))
            result = runner(payload)
            ch.basic_ack(method.delivery_tag)
            print(f"[{label}] completed {describe(payload)} stored={result.get('stored', result.get('fetched', 0))}", flush=True)
        except Exception as exc:
            attempt = int((properties.headers or {}).get("attempt", 0)) + 1
            try:
                payload = json.loads(body.decode("utf-8"))
            except Exception:
                payload = {"raw": body.decode("utf-8", errors="replace")}
            target = retry_queue if attempt < MAX_ATTEMPTS else dead_queue
            publish(ch, target, payload, attempt=attempt)
            ch.basic_ack(method.delivery_tag)
            print(f"[{label}] failed attempt={attempt} target={target}: {exc}", flush=True)

    return on_message


def worker_forever():
    while True:
        try:
            connection = connect()
            channel = connection.channel()
            declare(channel)
            channel.basic_qos(prefetch_count=PREFETCH)

            channel.basic_consume(
                MAIN_QUEUE,
                on_message_callback=consumer(
                    "jobs:queue:worker", execute_task, RETRY_QUEUE, DEAD_QUEUE,
                    lambda payload: f"source={payload.get('source')}",
                ),
            )
            channel.basic_consume(
                HIRING_QUEUE,
                on_message_callback=consumer(
                    "hiring:queue:worker", execute_hiring_task, HIRING_RETRY_QUEUE, HIRING_DEAD_QUEUE,
                    lambda payload: f"channel=@{payload.get('handle')}",
                ),
            )
            print("[jobs:queue:worker] consuming source + hiring channel tasks", flush=True)
            channel.start_consuming()
        except Exception as exc:
            print(f"[jobs:queue:worker] connection error: {exc}", flush=True)
            time.sleep(5)


if __name__ == "__main__":
    dispatch_forever() if MODE == "dispatcher" else worker_forever()
