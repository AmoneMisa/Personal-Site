# Jobs source architecture rules

This file adds mandatory rules for job/vacancy source adapters under `server/utils/`.
It inherits the repository-level `AGENTS.md` rules.

## Paginated vacancy sources MUST use the shared crawler

When adding or changing a paginated vacancy/job-board source, do **not** create a local crawler, pagination loop, fan-out scheduler, concurrency pool, retry policy, timeout policy, durable cursor, or arbitrary per-source item cap.

Use the shared crawler in:

```text
server/utils/cyclicJobBoardCrawler.ts
```

For ordinary page-number pagination use:

```text
crawlStandardJobBoard(...)
```

For an upstream API that exposes an opaque cursor use:

```text
crawlStandardCursorJobBoard(...)
```

The standard crawler policy owns the common values for pages-per-run, maximum traversal range, inter-request delay, request timeout, durable cursor state, page-1 refresh, historical-page rotation, repeated-page termination, and retry/resume behavior.

A source adapter may describe only source-specific facts needed to access and parse that source, for example:

```text
list URL
page/cursor parameter shape
source-specific response schema
source-specific DOM structure
job URL recognition
```

It must not silently replace shared crawler policy with values such as:

```text
FETCH_CONCURRENCY = 10
REQUEST_TIMEOUT_MS = 6000
MAX_PER_BOARD = 60
```

or equivalent local constants.

If an upstream contract genuinely requires an exception, document the reason next to the override and keep the exception as narrow as possible. "This source was easier to implement separately" is not a valid reason.

## Queue granularity

A registry containing many independent job boards must not fetch all boards from one adapter-level `Promise.all`, `Promise.allSettled`, worker pool, or custom fan-out.

Each independent board should be exposed as its own durable jobs-queue target whenever practical. The shared PostgreSQL jobs queue then owns scheduling, leases, retries and worker-level concurrency.

Expected flow:

```text
jobs queue target
    ↓
source adapter
    ↓
shared cyclic/cursor crawler
    ↓
source-specific parser
    ↓
normalization/enrichment
    ↓
persistent job store/search index
```

Do not build this instead:

```text
one broad queue task
    ↓
source adapter
    ↓
custom concurrency pool over dozens of sites
    ↓
custom timeout/item-limit rules
```

## Non-paginated APIs

A source API that returns its complete current result set in one request does not need fake pagination merely to satisfy this rule. It still must run through the normal jobs queue and normal normalization/persistence pipeline.

If the API later becomes paginated, migrate it to the shared crawler instead of adding a source-local loop.
