import { configuredJobRefreshTargets, refreshJobTarget } from '../server/utils/jobsSourceRefresh'

export function configuredSources(): string[] {
  return configuredJobRefreshTargets()
}

export async function refreshSource(source: string) {
  return refreshJobTarget(source)
}
