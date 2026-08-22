import json
import os
import socket
import time
import urllib.error
import urllib.request

FRONTEND_URL = os.environ.get("JOBS_FRONTEND_URL", "http://frontend:3000").rstrip("/")
QUEUE_INTERNAL_KEY = os.environ.get("QUEUE_INTERNAL_KEY", "")
MODE = os.environ.get("QUEUE_MODE", "worker").strip().lower()
DISPATCH_TICK_SECONDS = max(5, int(os.environ.get("QUEUE_DISPATCH_TICK_SECONDS", "10")))
POLL_SECONDS = max(0.2, float(os.environ.get("QUEUE_POLL_SECONDS", "1")))
ERROR_RETRY_SECONDS = max(1.0, float(os.environ.get("QUEUE_ERROR_RETRY_SECONDS", "5")))
EXECUTE_TIMEOUT_SECONDS = max(60, int(os.environ.get("QUEUE_EXECUTE_TIMEOUT_SECONDS", "180")))
WORKER_ID = os.environ.get("QUEUE_WORKER_ID") or f"{socket.gethostname()}:jobs"


def frontend_request(path, payload=None, method="POST", timeout=30):
    if len(QUEUE_INTERNAL_KEY) < 16:
        raise RuntimeError("QUEUE_INTERNAL_KEY must be at least 16 characters")

    data = None
    headers = {
        "X-Queue-Key": QUEUE_INTERNAL_KEY,
        "User-Agent": "jobs-postgres-worker/1.0",
    }
    if payload is not None:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        f"{FRONTEND_URL}{path}",
        method=method,
        data=data,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read().decode("utf-8")
            parsed = json.loads(body) if body else {}
            detail = parsed.get("statusMessage") or parsed.get("message") or parsed.get("error")
        except Exception:
            detail = None
        raise RuntimeError(f"HTTP {exc.code}: {detail or exc.reason}") from exc


def dispatch_forever():
    print("[jobs:queue:dispatcher] using PostgreSQL queue via frontend", flush=True)
    while True:
        try:
            result = frontend_request(
                "/internal/jobs-queue-dispatch",
                payload={},
                timeout=180,
            )
            queued = (
                int(result.get("jobsQueued") or 0)
                + int(result.get("hiringQueued") or 0)
                + int(result.get("backfillQueued") or 0)
            )
            if queued:
                print(
                    "[jobs:queue:dispatcher] queued "
                    f"jobs={result.get('jobsQueued', 0)} "
                    f"hiring={result.get('hiringQueued', 0)} "
                    f"backfill={result.get('backfillQueued', 0)}",
                    flush=True,
                )
        except Exception as exc:
            print(f"[jobs:queue:dispatcher] error: {exc}", flush=True)
        time.sleep(DISPATCH_TICK_SECONDS)


def execute_task(payload):
    task_type = str(payload.get("type") or "")
    if task_type == "jobs.refresh.source":
        source = str(payload.get("source") or "")
        if not source:
            raise ValueError("jobs task has no source")
        return frontend_request(
            "/internal/jobs-refresh-source",
            {"source": source},
            timeout=EXECUTE_TIMEOUT_SECONDS,
        )

    if task_type == "hiring.refresh.channel":
        handle = str(payload.get("handle") or "")
        if not handle:
            raise ValueError("hiring task has no handle")
        return frontend_request(
            "/internal/hiring-refresh-channel",
            {"handle": handle},
            timeout=EXECUTE_TIMEOUT_SECONDS,
        )

    raise ValueError(f"unsupported queue task type: {task_type or '<empty>'}")


def describe(payload):
    if payload.get("type") == "jobs.refresh.source":
        return f"source={payload.get('source')}"
    return f"channel=@{payload.get('handle')}"


def fail_task(task_id, lock_token, exc):
    return frontend_request(
        "/internal/jobs-queue-fail",
        {
            "id": task_id,
            "lockToken": lock_token,
            "error": str(exc),
        },
        timeout=30,
    )


def process_claim(task):
    task_id = str(task.get("id") or "")
    lock_token = str(task.get("lockToken") or "")
    payload = task.get("payload") or {}
    if not task_id or not lock_token:
        raise RuntimeError("claimed task is missing id or lock token")

    try:
        result = execute_task(payload)
        completion = frontend_request(
            "/internal/jobs-queue-complete",
            {
                "id": task_id,
                "lockToken": lock_token,
                "result": result,
            },
            timeout=30,
        )
        if not completion.get("completed"):
            raise RuntimeError(f"completion lost lease: {completion}")
        print(
            f"[jobs:queue:worker] completed {describe(payload)} "
            f"stored={result.get('stored', result.get('fetched', 0))}",
            flush=True,
        )
    except Exception as exc:
        try:
            outcome = fail_task(task_id, lock_token, exc)
            target = "dead" if outcome.get("dead") else "retry"
            retry_ms = outcome.get("retryMs")
            suffix = f" retryMs={retry_ms}" if retry_ms is not None else ""
        except Exception as fail_exc:
            target = "lease-expiry"
            suffix = f" failTransition={fail_exc}"
        print(
            f"[jobs:queue:worker] failed {describe(payload)} "
            f"attempt={task.get('attempts', '?')} target={target}{suffix}: {exc}",
            flush=True,
        )


def worker_forever():
    print(f"[jobs:queue:worker] polling PostgreSQL queue worker={WORKER_ID}", flush=True)
    while True:
        try:
            response = frontend_request(
                "/internal/jobs-queue-claim",
                {"workerId": WORKER_ID},
                timeout=30,
            )
            task = response.get("task")
            if not task:
                time.sleep(POLL_SECONDS)
                continue
            process_claim(task)
        except Exception as exc:
            print(f"[jobs:queue:worker] poll error: {exc}", flush=True)
            time.sleep(ERROR_RETRY_SECONDS)


if __name__ == "__main__":
    dispatch_forever() if MODE == "dispatcher" else worker_forever()
