import {
  buildCandidateShareMeta,
  buildFlatShareMeta,
  buildJobShareMeta,
  findSharedCandidate,
  findSharedFlat,
  findSharedJob,
} from '../utils/sharePreview'
import { renderShareOgPng, type ShareOgCard, type ShareOgKind } from '../utils/shareOgImage'

const FALLBACK: Record<ShareOgKind, ShareOgCard> = {
  site: {
    kind: 'site',
    title: 'WhitesLove',
    description: 'Frontend portfolio, useful services and search tools.',
  },
  job: {
    kind: 'job',
    title: 'Vacancy · Job Finder',
    description: 'Jobs with salary, location and skill details.',
  },
  candidate: {
    kind: 'candidate',
    title: 'Candidate · Hiring Board',
    description: 'Candidate profiles with experience, skills and location.',
  },
  flat: {
    kind: 'flat',
    title: 'Property listing · Flat Finder',
    description: 'Apartment and house listings with detailed filters.',
  },
}

function queryText(value: unknown, max = 512): string {
  return String(Array.isArray(value) ? value[0] : value || '').trim().slice(0, max)
}

function shareKind(value: unknown): ShareOgKind {
  const kind = queryText(value, 20)
  return kind === 'job' || kind === 'candidate' || kind === 'flat' ? kind : 'site'
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const kind = shareKind(query.kind)
  const id = queryText(query.id)
  const source = queryText(query.source, 80)
  const country = queryText(query.country, 8).toUpperCase()
  let card = FALLBACK[kind]

  if (kind === 'job' && id) {
    const job = await findSharedJob(id)
    if (job) {
      const meta = buildJobShareMeta(job, id)
      card = { kind, title: meta.title, description: meta.description }
    }
  } else if (kind === 'candidate' && id) {
    const candidate = await findSharedCandidate(id)
    if (candidate) {
      const meta = buildCandidateShareMeta(candidate, id, source, country)
      card = { kind, title: meta.title, description: meta.description }
    }
  } else if (kind === 'flat' && id) {
    const flat = await findSharedFlat(id, source, country)
    if (flat) {
      const meta = buildFlatShareMeta(flat, id, source, country)
      card = { kind, title: meta.title, description: meta.description }
    }
  }

  const png = await renderShareOgPng(card)
  setResponseHeader(event, 'Content-Type', 'image/png')
  setResponseHeader(event, 'Content-Length', String(png.length))
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400')
  return png
})
