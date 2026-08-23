export interface HiringTelegramChannelDescriptor {
  handle: string
  enabled?: boolean
}

// Runtime-neutral discovery list for the worker. Fetch/parsing metadata remains
// in the Telegram adapter for now; this boundary only owns whether a handle is
// schedulable. Keep disabled audited channels here so discovery stays explicit.
const CHANNELS: HiringTelegramChannelDescriptor[] = [
  { handle: 'ISH_QIDIR' },
  { handle: 'myrabota_uz' },
  { handle: 'UzJobs' },
  { handle: 'uzb_vakansiya' },
  { handle: 'ishchi' },
  { handle: 'ishbor_olx_uz', enabled: false },
  { handle: 'ISH_QAYERDA' },
  { handle: 'UstozShogird' },
  { handle: 'TALIMDAN_ISH_TOPISH' },
  { handle: 'SAMARQAND_ISH', enabled: false },
  { handle: 'Fargona_ishlar' },
  { handle: 'Ishga_marhamat_andijon_elonlar', enabled: false },
  { handle: 'namanganishbor', enabled: false },
  { handle: 'buxoroda_ish', enabled: false },
  { handle: 'Xorazm_ish' },
  { handle: 'workitkz', enabled: false },
  { handle: 'jobslbish' },
  { handle: 'Cvflow' },
  { handle: 'itcandidatesUA' },
  { handle: 'hr_recruiter_ua' },
]

export function hiringTelegramChannelHandles(): string[] {
  return CHANNELS.filter((channel) => channel.enabled !== false).map((channel) => channel.handle)
}
