# LinkedIn read-only source layer

Personal-Site owns LinkedIn vacancy parsing and can optionally own authenticated candidate discovery. Both paths are deliberately read-only.

## Vacancy source

`server/utils/linkedinSource.ts` uses LinkedIn's signed-out guest job surface for discovery and public job detail pages for enrichment.

Supported discovery controls:

- `LINKEDIN_LOCATIONS` — comma-separated explicit locations; otherwise the existing rotating regional coverage is used.
- `LINKEDIN_MAX_PAGES` — pages per location/pass, clamped to 1–8.
- `LINKEDIN_FRESHNESS_DAYS` — LinkedIn `f_TPR` freshness window, clamped to 1–30 days.
- `LINKEDIN_REMOTE_ONLY=on` — adds `f_WT=2`.
- `LINKEDIN_EASY_APPLY=on` — adds `f_AL=true`.
- `LINKEDIN_JOB_TYPES=F,C,P,T,I,V,O` — optional LinkedIn job-type codes passed as `f_JT`.
- `LINKEDIN_COMPANY_IDS=123,456` — optional company IDs passed as `f_C`.
- `LINKEDIN_DISTANCE=25` — optional distance filter.

Detail enrichment is bounded independently:

- `LINKEDIN_DETAILS_LIMIT_PER_CYCLE=64`
- `LINKEDIN_DETAIL_CONCURRENCY=6`
- `LINKEDIN_DETAIL_TIMEOUT_MS=10000`
- `LINKEDIN_PAGE_DELAY_MS=800`
- `LINKEDIN_PAGE_DELAY_BAND_MS=900`

The detail pass adds public description text, employment criteria, external apply URL when exposed, and salary when present. A failed detail request keeps the base card instead of failing the source.

`linkedinSourceHealth()` exposes in-process request, 429, parse-failure, empty-page and detail counters for diagnostics/logging.

## Candidate source

`server/hiring/sources/linkedinVoyager.ts` is an optional StaffSpy-inspired read-only transport for user-authorized LinkedIn sessions. It is disabled by default and is used only when all required session material is supplied.

Enable it with:

```env
HIRING_LINKEDIN_VOYAGER=on
HIRING_LINKEDIN_LI_AT=...
HIRING_LINKEDIN_JSESSIONID=...
```

or provide the complete cookie/header values explicitly:

```env
HIRING_LINKEDIN_VOYAGER=on
HIRING_LINKEDIN_COOKIE=li_at=...; JSESSIONID="ajax:..."
HIRING_LINKEDIN_CSRF_TOKEN=ajax:...
```

Optional tuning:

```env
HIRING_LINKEDIN_VOYAGER_TIMEOUT_MS=12000
HIRING_LINKEDIN_VOYAGER_CONCURRENCY=4
HIRING_LINKEDIN_PEOPLE_QUERY_ID=
HIRING_LINKEDIN_COMPANY_QUERY_ID=
HIRING_LINKEDIN_GEO_QUERY_ID=
HIRING_LINKEDIN_PROFILE_DECORATION_ID=
HIRING_LINKEDIN_COMPONENTS_QUERY_ID=
```

The query/decorations are configurable because LinkedIn changes Voyager query IDs independently of this repository.

The candidate transport currently performs only GET-style reads for:

- people search;
- company-name to company-ID resolution;
- geo-name to geo-URN resolution;
- profile top-card fields;
- skills;
- experience.

It does **not** implement connection invitations, messaging, blocking, profile mutation, recruiter-only contact bypasses, or hidden-contact extraction. Candidate contact remains the public LinkedIn profile URL unless the source text itself contains a public direct contact.

If Voyager is disabled/unconfigured, Personal-Site keeps the existing `HIRING_SOCIAL_API_URL` worker path. If Voyager is enabled but fails and the worker exists, the refresh falls back to that worker so the current production pipeline remains compatible.

`linkedinVoyagerHealth()` exposes in-process request, success, 429, auth-failure and parse-failure counters.

## Operational notes

Do not commit LinkedIn cookies or session tokens. They belong only in runtime secret configuration. A LinkedIn session may expire or be challenged; treat `400/401/403` as authentication/session-health failures and `429` as a throttling signal rather than trying to bypass it.

The repository tests assert that the Voyager transport remains opt-in and contains no account-mutation HTTP methods/endpoints.
