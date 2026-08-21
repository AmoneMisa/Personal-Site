import type { Job } from './jobTypes'
import { transliterationMappings } from './cyrillicTransliteration'

const ELASTICSEARCH_URL =
    (
        process.env.ELASTICSEARCH_URL
        || 'http://flat-finder-elasticsearch:9200'
    ).replace(/\/$/, '')

const JOBS_INDEX =
    process.env.JOBS_ELASTICSEARCH_INDEX
    || 'job-listings-v1'

const REQUEST_TIMEOUT_MS = 15_000
const BULK_SIZE = 500

function searchableText() {
    return {
        type: 'text',

        analyzer: 'job_text',

        fields: {
            latin: {
                type: 'text',
                analyzer: 'job_latin',
            },
        },
    }
}

function indexDefinition() {
    return {
        settings: {
            number_of_shards: 1,
            number_of_replicas: 0,

            analysis: {
                // Transliteration is a core `mapping` char filter rather than
                // icu_transform: analysis-icu cannot be installed on this host,
                // and an index definition referencing a missing analyzer fails
                // to create at all — which left this index nonexistent and job
                // search silently unranked. Shared with the candidate index so
                // both transliterate identically.
                char_filter: {
                    job_cyrillic: {
                        type: 'mapping',
                        mappings: transliterationMappings(),
                    },
                },

                filter: {
                    job_ascii: {
                        type: 'asciifolding',
                        preserve_original: true,
                    },
                },

                analyzer: {
                    job_text: {
                        type: 'custom',

                        tokenizer: 'standard',

                        filter: [
                            'lowercase',
                            'job_ascii',
                        ],
                    },

                    job_latin: {
                        type: 'custom',

                        char_filter: [
                            'job_cyrillic',
                        ],

                        tokenizer: 'standard',

                        filter: [
                            'lowercase',
                            'job_ascii',
                        ],
                    },
                },

                normalizer: {
                    job_keyword: {
                        type: 'custom',

                        filter: [
                            'lowercase',
                            'asciifolding',
                        ],
                    },
                },
            },
        },

        mappings: {
            dynamic: false,

            properties: {
                key: {
                    type: 'keyword',
                },

                id: {
                    type: 'keyword',
                },

                source: {
                    type: 'keyword',
                },

                country: {
                    type: 'keyword',
                },

                title:
                    searchableText(),

                company:
                    searchableText(),

                location:
                    searchableText(),

                city:
                    searchableText(),

                description:
                    searchableText(),

                tags:
                    searchableText(),

                skills:
                    searchableText(),

                niceToHave:
                    searchableText(),

                tools:
                    searchableText(),

                languages:
                    searchableText(),

                education:
                    searchableText(),

                schedule:
                    searchableText(),

                contractType:
                    searchableText(),

                applicationLanguage:
                    searchableText(),

                workMode: {
                    type: 'keyword',
                },

                relocation: {
                    type: 'keyword',
                },

                employmentKind: {
                    type: 'keyword',
                },

                seniority: {
                    type: 'keyword',
                },

                foreignerFriendly: {
                    type: 'boolean',
                },

                noExperience: {
                    type: 'boolean',
                },

                remote: {
                    type: 'boolean',
                },

                salaryUsd: {
                    type: 'double',
                },

                experienceMinYears: {
                    type: 'double',
                },

                experienceMaxYears: {
                    type: 'double',
                },

                postedAt: {
                    type: 'date',
                },

                syncToken: {
                    type: 'keyword',
                },
            },
        },
    }
}

async function request(
    path: string,
    options: RequestInit = {},
) {
    const response =
        await fetch(
            `${ELASTICSEARCH_URL}${path}`,
            {
                ...options,

                signal:
                    AbortSignal.timeout(
                        REQUEST_TIMEOUT_MS,
                    ),
            },
        )

    if (!response.ok) {
        const text =
            await response.text()
                .catch(() => '')

        throw new Error(
            `Elasticsearch ${response.status}: `
            + `${text.slice(0, 1000)}`,
        )
    }

    if (
        response.status === 204
        || options.method === 'HEAD'
    ) {
        return null
    }

    return response.json()
}

async function indexExists() {
    const response =
        await fetch(
            `${ELASTICSEARCH_URL}/${JOBS_INDEX}`,
            {
                method: 'HEAD',

                signal:
                    AbortSignal.timeout(
                        REQUEST_TIMEOUT_MS,
                    ),
            },
        )

    if (response.status === 404) {
        return false
    }

    if (!response.ok) {
        throw new Error(
            `Elasticsearch HEAD ${response.status}`,
        )
    }

    return true
}

export function jobSearchKey(
    job: Pick<Job, 'source' | 'id'>,
) {
    return [
        String(job.source)
            .toLowerCase(),

        String(job.id),
    ].join(':')
}

function textList(value: unknown): string[] {
    const out: string[] = []
    const visit = (item: unknown) => {
        if (item == null) return
        if (Array.isArray(item)) {
            item.forEach(visit)
            return
        }
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
            const text = String(item).trim()
            if (text) out.push(text)
            return
        }
        if (typeof item === 'object') Object.values(item as Record<string, unknown>).forEach(visit)
    }
    visit(value)
    return [...new Set(out)]
}

function searchDocument(
    job: Job,
    syncToken: string,
) {
    return {
        key:
            jobSearchKey(job),

        id:
            String(job.id),

        source:
        job.source,

        country:
            job.country ?? null,

        title:
            job.title ?? '',

        company:
            job.company ?? '',

        location:
            job.location ?? '',

        city:
            job.city ?? '',

        description:
            job.description ?? '',

        tags:
            textList(job.tags),

        skills:
            textList(job.skills),

        niceToHave:
            textList(job.niceToHave),

        tools:
            textList(job.tools),

        languages:
            (job.languages ?? [])
                .map(
                    (item) =>
                        [
                            item.language,
                            item.level,
                        ]
                            .filter(Boolean)
                            .join(' '),
                ),

        education:
            job.education ?? '',

        schedule:
            job.schedule ?? '',

        contractType:
            job.contractType ?? '',

        applicationLanguage:
            job.applicationLanguage ?? '',

        workMode:
            job.workMode ?? 'unknown',

        relocation:
            job.relocation ?? 'unknown',

        employmentKind:
            job.employmentKind ?? null,

        seniority:
            job.seniority ?? null,

        foreignerFriendly:
            job.foreignerFriendly ?? false,

        noExperience:
            job.noExperience ?? false,

        remote:
        job.remote,

        salaryUsd:
            job.salaryUsd ?? null,

        experienceMinYears:
            job.experienceMinYears ?? null,

        experienceMaxYears:
            job.experienceMaxYears ?? null,

        postedAt:
        job.postedAt,

        syncToken,
    }
}

// Analysis settings are fixed at creation time, so an index built from the old
// (icu_transform) definition keeps its analyzers even after this file changes.
// Warn loudly with the fix rather than silently serving a differently-analyzed
// index — and never delete it here, since that would drop data uninvited.
async function warnIfStaleAnalysis() {
    try {
        const settings = await request(`/${JOBS_INDEX}/_settings`, { method: 'GET' })
        const analysis = settings?.[JOBS_INDEX]?.settings?.index?.analysis
        if (analysis && !analysis.char_filter?.job_cyrillic) {
            console.warn(
                `[jobs:elasticsearch] ${JOBS_INDEX} was created with the old `
                + `analysis settings, so transliterated matching is inactive. `
                + `Recreate it (delete the index, or point `
                + `JOBS_ELASTICSEARCH_INDEX at a new name) and re-run the refresh.`,
            )
        }
    } catch {
        // Diagnostics only — never block indexing on this probe.
    }
}

export async function ensureJobsSearchIndex() {
    if (
        await indexExists()
    ) {
        await warnIfStaleAnalysis()
        return
    }

    await request(
        `/${JOBS_INDEX}`,
        {
            method: 'PUT',

            headers: {
                'Content-Type':
                    'application/json',
            },

            body:
                JSON.stringify(
                    indexDefinition(),
                ),
        },
    )

    console.log(
        `[jobs:elasticsearch] `
        + `created ${JOBS_INDEX}`,
    )
}

async function bulkIndex(
    jobs: Job[],
    syncToken: string,
) {
    if (!jobs.length) {
        return
    }

    const lines: string[] = []

    for (const job of jobs) {
        const key =
            jobSearchKey(job)

        lines.push(
            JSON.stringify({
                index: {
                    _index:
                    JOBS_INDEX,

                    _id:
                    key,
                },
            }),
        )

        lines.push(
            JSON.stringify(
                searchDocument(
                    job,
                    syncToken,
                ),
            ),
        )
    }

    const result: any =
        await request(
            '/_bulk',
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/x-ndjson',
                },

                body:
                    `${lines.join('\n')}\n`,
            },
        )

    if (result?.errors) {
        const failed =
            result.items
                ?.find(
                    (item: any) =>
                        item.index?.error,
                )

        throw new Error(
            `Elasticsearch bulk error: `
            + JSON.stringify(
                failed?.index?.error
                ?? failed
                ?? result,
            ),
        )
    }
}

export async function syncJobsSearchIndex(
    jobs: Job[],
) {
    await ensureJobsSearchIndex()

    const syncToken =
        `${Date.now()}-${Math.random().toString(36).slice(2)}`

    for (
        let offset = 0;
        offset < jobs.length;
        offset += BULK_SIZE
    ) {
        await bulkIndex(
            jobs.slice(
                offset,
                offset + BULK_SIZE,
            ),
            syncToken,
        )
    }

    await request(
        `/${JOBS_INDEX}/_delete_by_query?conflicts=proceed`,
        {
            method: 'POST',

            headers: {
                'Content-Type':
                    'application/json',
            },

            body:
                JSON.stringify({
                    query: {
                        bool: {
                            must_not: [
                                {
                                    term: {
                                        syncToken,
                                    },
                                },
                            ],
                        },
                    },
                }),
        },
    )
}
