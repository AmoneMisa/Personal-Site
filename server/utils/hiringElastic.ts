// Elasticsearch index + search for candidate profiles.
//
// Mirrors the Job Finder's search architecture (server/utils/jobsElastic.ts) so
// both halves of the site behave the same way, with one deliberate difference:
// transliteration here is done with a core `mapping` char filter instead of
// `icu_transform`. The analysis-icu plugin cannot be installed on this host (its
// download 403s), and an index definition that needs a missing plugin fails to
// create at all — which would silently leave candidate search broken.
//
// Everything degrades gracefully: if Elasticsearch is unreachable the caller
// falls back to in-memory filtering, so the Hiring page never depends on it.

import type { CvProfile } from './hiringTypes'
import { transliterationMappings } from './cyrillicTransliteration'

const ELASTICSEARCH_URL = (
    process.env.ELASTICSEARCH_URL || 'http://flat-finder-elasticsearch:9200'
).replace(/\/$/, '')

const CANDIDATE_INDEX = process.env.HIRING_ELASTICSEARCH_INDEX || 'candidate-profiles-v1'
const REQUEST_TIMEOUT_MS = 10_000
const BULK_SIZE = 400

function searchableText() {
    return {
        type: 'text',
        analyzer: 'candidate_text',
        fields: { latin: { type: 'text', analyzer: 'candidate_latin' } },
    }
}

function indexDefinition() {
    return {
        settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
                char_filter: {
                    // Core replacement filter — no plugin required.
                    candidate_cyrillic: { type: 'mapping', mappings: transliterationMappings() },
                },
                filter: {
                    candidate_ascii: { type: 'asciifolding', preserve_original: true },
                    // Lets a 2-3 word query match a longer phrase.
                    candidate_shingle: { type: 'shingle', min_shingle_size: 2, max_shingle_size: 3 },
                },
                analyzer: {
                    candidate_text: {
                        type: 'custom',
                        tokenizer: 'standard',
                        filter: ['lowercase', 'candidate_ascii'],
                    },
                    candidate_latin: {
                        type: 'custom',
                        char_filter: ['candidate_cyrillic'],
                        tokenizer: 'standard',
                        filter: ['lowercase', 'candidate_ascii'],
                    },
                },
                normalizer: {
                    candidate_keyword: { type: 'custom', filter: ['lowercase', 'asciifolding'] },
                },
            },
        },
        mappings: {
            dynamic: false,
            properties: {
                id: { type: 'keyword' },
                source: { type: 'keyword' },
                country: { type: 'keyword' },
                city: { type: 'keyword', normalizer: 'candidate_keyword', fields: { text: searchableText() } },
                name: searchableText(),
                role: searchableText(),
                description: searchableText(),
                skills: { type: 'keyword', normalizer: 'candidate_keyword', fields: { text: searchableText() } },
                languages: { type: 'keyword', normalizer: 'candidate_keyword' },
                seniority: { type: 'keyword' },
                experienceYears: { type: 'float' },
                remote: { type: 'boolean' },
                salaryMin: { type: 'float' },
                salaryMax: { type: 'float' },
                createdAt: { type: 'date' },
                syncToken: { type: 'keyword' },
            },
        },
    }
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
    const response = await fetch(`${ELASTICSEARCH_URL}${path}`, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Elasticsearch ${response.status}: ${body.slice(0, 300)}`)
    }
    return response.status === 204 ? null : response.json()
}

// Cached availability probe: a down cluster must not add its timeout to every
// single page request.
let availableAt = 0
let available = false
export async function candidateSearchAvailable(): Promise<boolean> {
    if (Date.now() - availableAt < 30_000) return available
    availableAt = Date.now()
    try {
        await request('/', { method: 'GET' })
        available = true
    } catch {
        available = false
    }
    return available
}

export async function ensureCandidateIndex(): Promise<void> {
    try {
        await request(`/${CANDIDATE_INDEX}`, { method: 'HEAD' })
        return
    } catch {
        // Missing (or unreachable) — try to create it below.
    }
    await request(`/${CANDIDATE_INDEX}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(indexDefinition()),
    })
    console.log(`[hiring:elasticsearch] created ${CANDIDATE_INDEX}`)
}

function toDocument(profile: CvProfile, syncToken: string) {
    return {
        id: profile.id,
        source: profile.source,
        country: profile.country,
        city: profile.city || '',
        name: profile.name || '',
        role: profile.role || '',
        description: profile.description || '',
        skills: profile.skills || [],
        languages: profile.languages || [],
        seniority: profile.seniority || null,
        experienceYears: profile.experienceYears ?? null,
        remote: profile.remote ?? null,
        salaryMin: profile.salaryMin ?? null,
        salaryMax: profile.salaryMax ?? null,
        createdAt: profile.createdAt || null,
        syncToken,
    }
}

// Index the current profile set and drop anything left from an earlier sync, so
// withdrawn candidates disappear from search instead of lingering.
export async function syncCandidateIndex(profiles: CvProfile[]): Promise<number> {
    if (!profiles.length) return 0
    await ensureCandidateIndex()
    const syncToken = String(Date.now())

    for (let i = 0; i < profiles.length; i += BULK_SIZE) {
        const batch = profiles.slice(i, i + BULK_SIZE)
        const lines: string[] = []
        for (const profile of batch) {
            lines.push(JSON.stringify({ index: { _index: CANDIDATE_INDEX, _id: `${profile.source}:${profile.id}` } }))
            lines.push(JSON.stringify(toDocument(profile, syncToken)))
        }
        const result = await request('/_bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-ndjson' },
            body: `${lines.join('\n')}\n`,
        })
        if (result?.errors) {
            const failed = (result.items || []).find((item: any) => item.index?.error)
            throw new Error(`Elasticsearch bulk error: ${JSON.stringify(failed?.index?.error).slice(0, 300)}`)
        }
    }

    await request(`/${CANDIDATE_INDEX}/_delete_by_query?conflicts=proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: { bool: { must_not: { term: { syncToken } } } } }),
    }).catch(() => {})

    await request(`/${CANDIDATE_INDEX}/_refresh`, { method: 'POST' }).catch(() => {})
    return profiles.length
}

export interface CandidateSearchParams {
    query?: string
    countries?: string[]
    city?: string
    skills?: string[]
    seniority?: string
    languages?: string[]
    remote?: boolean
    experienceMin?: number
    sources?: string[]
    from?: number
    size?: number
}

// Returns ranked ids. The caller hydrates them from the store, so search stays
// the ranking layer and the store stays the source of truth for display.
export async function searchCandidates(
    params: CandidateSearchParams,
): Promise<{ total: number; hits: { id: string; score: number }[] } | null> {
    const filter: any[] = []
    if (params.countries?.length) filter.push({ terms: { country: params.countries } })
    if (params.sources?.length) filter.push({ terms: { source: params.sources } })
    if (params.seniority) filter.push({ term: { seniority: params.seniority } })
    if (params.remote != null) filter.push({ term: { remote: params.remote } })
    if (params.city) filter.push({ match: { 'city.text': { query: params.city, fuzziness: 'AUTO' } } })
    if (params.experienceMin) filter.push({ range: { experienceYears: { gte: params.experienceMin } } })
    // Every requested skill must be present (AND), matching the Job Finder.
    for (const skill of params.skills || []) filter.push({ term: { skills: skill } })
    for (const language of params.languages || []) filter.push({ term: { languages: language } })

    const text = (params.query || '').trim()
    const must = text
        ? [{
            bool: {
                should: [
                    // Exact-ish phrase on the strongest fields.
                    {
                        multi_match: {
                            query: text,
                            type: 'phrase',
                            fields: ['role^6', 'name^4', 'skills.text^4'],
                            boost: 3,
                        },
                    },
                    // Multi-word, typo tolerant.
                    {
                        multi_match: {
                            query: text,
                            type: 'best_fields',
                            fields: ['role^5', 'name^3', 'skills.text^4', 'city.text^2', 'description'],
                            fuzziness: 'AUTO',
                            operator: 'or',
                            minimum_should_match: '70%',
                        },
                    },
                    // Cross-script: matches the transliterated variants.
                    {
                        multi_match: {
                            query: text,
                            type: 'best_fields',
                            fields: ['role.latin^4', 'name.latin^3', 'skills.text.latin^3', 'description.latin'],
                            fuzziness: 'AUTO',
                            operator: 'or',
                            minimum_should_match: '70%',
                        },
                    },
                ],
                minimum_should_match: 1,
            },
        }]
        : []

    const body = {
        from: Math.max(0, params.from || 0),
        size: Math.min(100, Math.max(1, params.size || 20)),
        track_total_hits: true,
        query: { bool: { must, filter } },
        // Relevance first when searching; newest first when only browsing.
        sort: text ? ['_score', { createdAt: { order: 'desc', missing: '_last' } }] : [{ createdAt: { order: 'desc', missing: '_last' } }],
        _source: ['id', 'source'],
    }

    try {
        const result = await request(`/${CANDIDATE_INDEX}/_search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        return {
            total: result?.hits?.total?.value ?? 0,
            hits: (result?.hits?.hits || []).map((hit: any) => ({
                id: hit?._source?.id,
                score: hit?._score ?? 0,
            })).filter((hit: any) => hit.id),
        }
    } catch (error) {
        console.warn('[hiring:elasticsearch] search failed:', (error as Error).message)
        return null
    }
}
