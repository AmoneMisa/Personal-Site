// Client-side ATS (Applicant Tracking System) match scoring.
// The CV never leaves the browser: text is extracted locally and matched against
// each vacancy. The score mimics how keyword-based ATS filters rank a CV: it
// rewards coverage of the skills/keywords a vacancy asks for.

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'will', 'have', 'has',
  'that', 'this', 'from', 'was', 'were', 'they', 'their', 'them', 'but', 'not',
  'all', 'can', 'who', 'a', 'an', 'to', 'of', 'in', 'on', 'at', 'as', 'is',
  'be', 'we', 'or', 'by', 'it', 'if', 'so', 'do', 'up', 'out', 'per', 'via', 'etc',
  'job', 'work', 'team', 'role', 'company', 'experience', 'years', 'year', 'strong',
  'good', 'great', 'ability', 'looking', 'join', 'help', 'plus', 'must', 'skills',
  'знание', 'опыт', 'работа', 'команда', 'компания', 'разработка', 'умение',
])

// Known multi-word skills that should be matched as a phrase.
const PHRASES = [
  'machine learning', 'deep learning', 'data science', 'ci cd', 'ci/cd',
  'rest api', 'graphql', 'unit testing', 'test automation', 'design patterns',
  'react native', 'node js', 'next js', 'nuxt js', 'vue js', 'spring boot',
  'micro services', 'microservices', 'google cloud', 'project management',
  'product management', 'ci-cd', 'a b testing',
]

function normalize(text: string): string {
  return ' ' + text.toLowerCase().replace(/[^a-z0-9+#./\u0400-\u04FF ]+/g, ' ').replace(/\s+/g, ' ') + ' '
}

export function tokenize(text: string): string[] {
  const norm = normalize(text)
  const words = norm
    .split(' ')
    .map((w) => w.replace(/^[./]+|[./]+$/g, ''))
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
  const phrases = PHRASES.filter((p) => norm.includes(' ' + p + ' ')).map((p) => p.replace(/\s+/g, '-'))
  return [...words, ...phrases]
}

export interface CvProfile {
  tokens: Set<string>
  raw: string
}

export function buildCvProfile(cvText: string): CvProfile {
  return { tokens: new Set(tokenize(cvText)), raw: cvText }
}

export interface AtsResult {
  score: number // 0..100
  matched: string[]
  missing: string[]
}

/**
 * Score a vacancy against a CV profile.
 * - coverage: share of the vacancy's key terms present in the CV
 * - a small boost for title-term matches (titles carry the core requirement)
 */
export function scoreJob(profile: CvProfile, job: {
  title: string
  description?: string
  tags?: string[]
}): AtsResult {
  const jobText = `${job.title} ${job.title} ${(job.tags || []).join(' ')} ${job.description || ''}`
  const jobTokens = tokenize(jobText)

  // Weight terms by frequency in the vacancy; keep the most salient ones.
  const freq = new Map<string, number>()
  for (const t of jobTokens) freq.set(t, (freq.get(t) || 0) + 1)
  const keyTerms = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([t]) => t)

  if (keyTerms.length === 0) return { score: 0, matched: [], missing: [] }

  const matched: string[] = []
  const missing: string[] = []
  let weightHit = 0
  let weightTotal = 0
  for (const term of keyTerms) {
    const w = freq.get(term) || 1
    weightTotal += w
    if (profile.tokens.has(term)) {
      weightHit += w
      matched.push(term)
    } else {
      missing.push(term)
    }
  }

  const score = Math.round((weightHit / weightTotal) * 100)
  return {
    score,
    matched: matched.map(pretty).slice(0, 12),
    missing: missing.map(pretty).slice(0, 8),
  }
}

function pretty(term: string): string {
  return term.replace(/-/g, ' ')
}

export function scoreColor(score: number): string {
  if (score >= 70) return '#34d399' // green
  if (score >= 45) return '#fbbf24' // amber
  return '#f87171' // red
}
