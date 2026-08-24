import { configuredJobSources, refreshJobSource } from '../server/utils/jobsSourceRefresh'
import type { JobSource } from '../shared/contracts/jobs'

export function configuredSources(): JobSource[] {
  return configuredJobSources()
}

export async function refreshSource(source: string) {
  return refreshJobSource(source as JobSource)
}
