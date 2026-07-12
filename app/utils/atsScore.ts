// Client-side ATS (Applicant Tracking System) match scoring.
// The CV never leaves the browser: text is extracted locally and matched against
// each vacancy. Matching is done over a canonical *skill* dictionary (not raw word
// frequency), so the score reflects real tech-skill overlap — e.g. Java, Spring,
// Docker, Kubernetes, AWS — instead of noise words from the title/company.

// Canonical skill label -> alias list (lowercase). Aliases are matched with a
// word-ish boundary so "java" doesn't match inside "javascript". Extend freely.
const SKILL_ALIASES: Record<string, string[]> = {
  Java: ['java'],
  JavaScript: ['javascript', 'js'],
  TypeScript: ['typescript'],
  Kotlin: ['kotlin'],
  Spring: ['spring', 'spring boot', 'springboot', 'spring framework', 'spring data', 'spring security', 'spring mvc'],
  Python: ['python'],
  Django: ['django'],
  Flask: ['flask'],
  FastAPI: ['fastapi'],
  Go: ['golang', 'go'],
  Rust: ['rust'],
  'C++': ['c++'],
  'C#': ['c#'],
  '.NET': ['.net', 'dotnet', 'asp.net'],
  PHP: ['php'],
  Laravel: ['laravel'],
  Ruby: ['ruby', 'ruby on rails', 'rails'],
  Scala: ['scala'],
  Swift: ['swift'],
  'Objective-C': ['objective-c', 'objective c'],
  Flutter: ['flutter'],
  Dart: ['dart'],
  React: ['react', 'react.js', 'reactjs'],
  'React Native': ['react native'],
  Vue: ['vue', 'vue.js', 'vuejs'],
  Nuxt: ['nuxt', 'nuxt.js'],
  'Next.js': ['next.js', 'nextjs'],
  Angular: ['angular'],
  Svelte: ['svelte'],
  'Node.js': ['node.js', 'nodejs', 'node'],
  HTML: ['html', 'html5'],
  CSS: ['css', 'css3'],
  Sass: ['sass', 'scss'],
  Tailwind: ['tailwind'],
  Redux: ['redux'],
  Webpack: ['webpack'],
  Vite: ['vite'],
  SQL: ['sql'],
  PostgreSQL: ['postgresql', 'postgres'],
  MySQL: ['mysql'],
  MariaDB: ['mariadb'],
  MongoDB: ['mongodb', 'mongo'],
  Redis: ['redis'],
  Elasticsearch: ['elasticsearch', 'opensearch'],
  ClickHouse: ['clickhouse'],
  GraphQL: ['graphql'],
  REST: ['rest api', 'restful', 'restful api'],
  gRPC: ['grpc'],
  Kafka: ['kafka'],
  RabbitMQ: ['rabbitmq'],
  Docker: ['docker'],
  Kubernetes: ['kubernetes', 'k8s'],
  Terraform: ['terraform'],
  Ansible: ['ansible'],
  AWS: ['aws', 'amazon web services'],
  GCP: ['gcp', 'google cloud'],
  Azure: ['azure'],
  'CI/CD': ['ci/cd', 'ci cd', 'cicd'],
  Git: ['git'],
  Linux: ['linux'],
  Nginx: ['nginx'],
  Tomcat: ['tomcat'],
  Microservices: ['microservices', 'micro services'],
  Jest: ['jest'],
  Cypress: ['cypress'],
  Playwright: ['playwright'],
  Selenium: ['selenium'],
  Pandas: ['pandas'],
  NumPy: ['numpy'],
  TensorFlow: ['tensorflow'],
  PyTorch: ['pytorch'],
  Spark: ['spark'],
  'Machine Learning': ['machine learning'],
  'Data Science': ['data science'],
  NLP: ['nlp'],
  DevOps: ['devops'],
  Figma: ['figma'],
  Jira: ['jira'],
  Agile: ['agile'],
  Scrum: ['scrum'],
}

// Pre-compile: alias (lowercase) -> canonical label, and a matcher per alias.
// Boundary excludes a-z, 0-9, and the skill-ish chars + # . so tokens like "c++",
// "c#", ".net" and "node.js" match exactly without bleeding into neighbours.
const ALIAS_TO_LABEL = new Map<string, string>()
const ALIAS_MATCHERS: { label: string; re: RegExp }[] = []
for (const [label, aliases] of Object.entries(SKILL_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_LABEL.set(alias, label)
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ALIAS_MATCHERS.push({ label, re: new RegExp(`(^|[^a-z0-9+#.])${esc}([^a-z0-9+#.]|$)`, 'i') })
  }
}

/** Canonical skills present in a block of free text. */
function extractSkills(text: string): Set<string> {
  const hay = ' ' + text.toLowerCase() + ' '
  const found = new Set<string>()
  for (const { label, re } of ALIAS_MATCHERS) {
    if (!found.has(label) && re.test(hay)) found.add(label)
  }
  return found
}

/** Map a pre-normalized skill string (e.g. from the server) to a canonical label. */
function canonical(skill: string): string | undefined {
  const s = skill.trim().toLowerCase()
  return ALIAS_TO_LABEL.get(s) ?? [...extractSkills(s)][0]
}

export interface CvProfile {
  skills: Set<string> // canonical skill labels found in the CV
  raw: string
}

export function buildCvProfile(cvText: string): CvProfile {
  return { skills: extractSkills(cvText), raw: cvText }
}

export interface AtsResult {
  score: number // 0..100
  matched: string[]
  missing: string[]
}

/**
 * Score a vacancy against a CV profile by canonical skill coverage.
 * required = skills asked for by the vacancy (server-normalized skills/niceToHave
 * plus any recognised in the title/tags/description). score = share the CV covers.
 */
export function scoreJob(profile: CvProfile, job: {
  title: string
  description?: string
  tags?: string[]
  skills?: string[]
  niceToHave?: string[]
}): AtsResult {
  const required = new Set<string>()
  for (const s of job.skills || []) { const c = canonical(s); if (c) required.add(c) }
  for (const s of job.niceToHave || []) { const c = canonical(s); if (c) required.add(c) }
  for (const s of extractSkills(`${job.title} ${(job.tags || []).join(' ')} ${job.description || ''}`)) {
    required.add(s)
  }

  if (required.size === 0) return { score: 0, matched: [], missing: [] }

  const matched: string[] = []
  const missing: string[] = []
  for (const skill of required) {
    if (profile.skills.has(skill)) matched.push(skill)
    else missing.push(skill)
  }

  const score = Math.round((matched.length / required.size) * 100)
  return { score, matched: matched.slice(0, 12), missing: missing.slice(0, 10) }
}

export function scoreColor(score: number): string {
  if (score >= 70) return '#34d399' // green
  if (score >= 45) return '#fbbf24' // amber
  return '#f87171' // red
}
