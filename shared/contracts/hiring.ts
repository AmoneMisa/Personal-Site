import type { Seniority } from './jobs'

export type CandidateGender = 'male' | 'female' | 'unknown'

export interface HiringStatisticsItem {
  label: string
  value: number
}

export interface HiringProfessionSalaryRange {
  profession: string
  count: number
  minUsd: number
  maxUsd: number
}

export interface HiringStatistics {
  genders: Record<CandidateGender, number>
  ages: HiringStatisticsItem[]
  platforms: HiringStatisticsItem[]
  locations: HiringStatisticsItem[]
  sectors: HiringStatisticsItem[]
  professions: HiringStatisticsItem[]
  activity: Array<{ date: string; value: number }>
  salaryByExperience: Array<number | null>
  salaryByProfession: HiringProfessionSalaryRange[]
  salarySamples: number
}


export interface CountryMeta {
  code: string
  name: string
  currency: string
  cities?: string[]
}
