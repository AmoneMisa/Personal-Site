import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCvProfile, scoreColor, scoreJob } from '../app/utils/atsScore.ts'

const REFERENCE_DATE = new Date('2026-08-23T12:00:00Z')

const middleFrontendCv = `
PROFILE
Frontend developer with over 5 years of hands-on experience in e-commerce and marketplace projects.
Currently, I'm looking for a Middle Frontend Developer position. Ready for relocation; remote work is preferable.

SKILLS
JavaScript, TypeScript, Vue, React, Node.js, Python, FastAPI, SQL, Docker

WORK EXPERIENCE
BPC | Remote
Frontend Developer
2021-06 - PRESENT
Development and support of marketplace frontend features.
Implementation and maintenance of UI using Freemarker templates.

ITSUA | Kharkiv
Junior Frontend Developer
2020-05 - 2021-05
Development of a Vue-based application for Shopify.

EDUCATION
2019 - 2020
Master's degree — Civil law
2015 - 2019
Bachelor's degree — Institute of Criminal Investigation and Forensics

ADDITIONAL INFORMATION
Citizenship: Ukraine
`

const robloxPrincipalJob = {
  title: 'Principal Frontend Software Engineer, Connections',
  country: 'US',
  location: 'San Mateo, CA, United States',
  tags: ['Hybrid', 'Lead', '8+ years'],
  experienceMinYears: 8,
  description: `
Why Connections? As a Principal Software Engineer on the Connections team, your work will power the Roblox ecosystem.
You will own critical features used by millions of users daily while developing new zero-to-one features.
You Will: Architect scalable, long-term solutions. Collaborate across the company to translate ambitious business goals into a concrete, multi-year technical roadmap. Serve as a technical leader, setting engineering standards and mentoring other engineers.
You Have: 8+ years of experience in software development with web or app technologies (React, TypeScript, JavaScript). Proven track record building and launching complex, consumer-facing features. Bachelor's degree or higher in Computer Science or a related field.
This role is based at Roblox HQ in San Mateo, CA (no remote option).
For US based roles only, the Company may not be able to employ candidates for this role who have United States work authorization related to certain U.S. visa categories, or support future H-1B sponsorship at this time.
  `,
  skills: ['React', 'TypeScript', 'JavaScript'],
}

test('principal Roblox-style role is not inflated by three matching framework keywords', () => {
  const profile = buildCvProfile(middleFrontendCv, REFERENCE_DATE)
  const result = scoreJob(profile, robloxPrincipalJob)

  assert.equal(profile.seniority, 'middle')
  // Education date ranges must not be counted as employment.
  assert.ok((profile.experienceYears ?? 0) > 6 && (profile.experienceYears ?? 0) < 7)
  assert.equal(profile.requiresUsSponsorship, true)

  assert.equal(result.eligible, false)
  assert.ok(result.blockers.some((blocker) => blocker.code === 'visa_sponsorship'))
  assert.ok(result.score < 50, `expected a red score, got ${result.score}`)
  assert.ok(result.fitScore >= 20 && result.fitScore <= 45, `unexpected professional fit: ${result.fitScore}`)
  assert.ok(result.missing.some((item) => /8\+ years/i.test(item)))
  assert.ok(result.missing.some((item) => /Principal seniority/i.test(item)))
  assert.ok(result.missing.some((item) => /Computer Science/i.test(item)))
  assert.ok(result.missing.some((item) => /Technical leadership/i.test(item)))
})

test('skills demonstrated in work experience carry more weight than skills-list-only mentions', () => {
  const job = {
    title: 'Frontend Developer',
    description: 'Requirements: Strong hands-on experience with React, TypeScript and JavaScript.',
    skills: ['React', 'TypeScript', 'JavaScript'],
  }
  const skillsOnly = buildCvProfile(`
PROFILE
Frontend Developer
SKILLS
React, TypeScript, JavaScript
`, REFERENCE_DATE)
  const demonstrated = buildCvProfile(`
PROFILE
Frontend Developer
WORK EXPERIENCE
2023-01 - PRESENT
Built and maintained React applications with TypeScript and JavaScript for production users.
SKILLS
React, TypeScript, JavaScript
`, REFERENCE_DATE)

  assert.ok(scoreJob(demonstrated, job).score > scoreJob(skillsOnly, job).score)
})

test('existing US work authorization prevents a false sponsorship blocker', () => {
  const profile = buildCvProfile(`${middleFrontendCv}\nAuthorized to work in the United States without sponsorship.`, REFERENCE_DATE)
  const result = scoreJob(profile, robloxPrincipalJob)

  assert.equal(profile.requiresUsSponsorship, false)
  assert.equal(result.blockers.some((blocker) => blocker.code === 'visa_sponsorship'), false)
})

test('score colors reserve green for 75% and above', () => {
  assert.equal(scoreColor(75), '#34d399')
  assert.equal(scoreColor(74), '#fbbf24')
  assert.equal(scoreColor(50), '#fbbf24')
  assert.equal(scoreColor(49), '#f87171')
})
