import sharp from 'sharp'
import { cleanShareText, escapeXml, wrapShareText } from './sharePreview'

export type ShareOgKind = 'site' | 'job' | 'candidate' | 'flat' | 'quiz'
export type ShareOgCard = { kind: ShareOgKind; title: string; description?: string }

const LABELS: Record<ShareOgKind, string> = {
  site: 'PORTFOLIO · SERVICES · TOOLS',
  job: 'JOB FINDER · VACANCY',
  candidate: 'HIRING BOARD · CANDIDATE',
  flat: 'FLAT FINDER · LISTING',
  quiz: 'QUIZZES · DISCOVER YOURSELF',
}

function svgText(value: unknown): string {
  return escapeXml(cleanShareText(value, 260).replace(/\p{Cc}+/gu, ''))
}

function textLines(lines: string[], y: number, lineHeight: number, className: string): string {
  return lines.map((line, index) => `<text x="76" y="${y + index * lineHeight}" class="${className}">${svgText(line)}</text>`).join('')
}

// Bundled Nitro artwork keeps social rendering independent of network fetches.
export function buildShareOgSvg(card: ShareOgCard, artwork: Uint8Array): string {
  const title = cleanShareText(card.title, 150) || 'WhitesLove'
  const description = cleanShareText(card.description, 210)
  const isHome = card.kind === 'site' && title === 'WhitesLove'
  const titleLines = wrapShareText(title, isHome ? 18 : 22, 3)
  const descriptionLines = description ? wrapShareText(description, 40, 3) : []
  const titleY = isHome ? 258 : 222
  const descriptionY = titleY + (titleLines.length - 1) * 60 + 58

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <clipPath id="card"><rect x="24" y="24" width="1152" height="582" rx="30"/></clipPath>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop stop-color="#080c22" stop-opacity=".96"/>
        <stop offset=".38" stop-color="#080c22" stop-opacity=".88"/>
        <stop offset=".58" stop-color="#080c22" stop-opacity=".2"/>
        <stop offset="1" stop-color="#080c22" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="#070c22"/>
    <g clip-path="url(#card)">
      <image x="24" y="24" width="1152" height="582" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${Buffer.from(artwork).toString('base64')}"/>
      <rect x="24" y="24" width="1152" height="582" fill="url(#shade)"/>
      <rect x="24" y="534" width="1152" height="72" fill="#060a1b" fill-opacity=".8"/>
      <path d="M24 534H1176" stroke="#48568b" stroke-opacity=".38"/>
    </g>
    <rect x="24" y="24" width="1152" height="582" rx="30" fill="none" stroke="#4d5c9a" stroke-opacity=".55"/>
    <style>
      text { font-family: 'DejaVu Sans', 'Arial', sans-serif; }
      .eyebrow { fill: #ef67a3; font-size: 18px; font-weight: 700; letter-spacing: 1.5px; }
      .title { fill: #fff; font-size: ${isHome ? 68 : 42}px; font-weight: 900; letter-spacing: -1.5px; }
      .description { fill: #c5c9db; font-size: 23px; }
      .brand { fill: #f36ba8; font-size: 20px; font-weight: 700; }
      .url { fill: #b2b8cf; font-size: 17px; letter-spacing: 1.5px; }
    </style>
    <rect x="76" y="86" width="58" height="44" rx="12" fill="#0d0f26" fill-opacity=".7" stroke="#f1499d" stroke-opacity=".76"/>
    <path d="m99 100-7 8 7 8m12-16 7 8-7 8" fill="none" stroke="#f565a5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="76" y="172" class="eyebrow">${LABELS[card.kind]}</text>
    ${textLines(titleLines, titleY, 60, 'title')}
    ${textLines(descriptionLines, descriptionY, 34, 'description')}
    <text x="76" y="579" class="brand">${card.kind === 'site' ? 'Marharyta Kubai · WhitesLove' : 'WhitesLove'}</text>
    <text x="1124" y="579" text-anchor="end" class="url">WHITESLOVE.ME</text>
  </svg>`
}

export async function renderShareOgPng(card: ShareOgCard, artwork: Uint8Array): Promise<Buffer> {
  return sharp(Buffer.from(buildShareOgSvg(card, artwork))).png({ compressionLevel: 9 }).toBuffer()
}
