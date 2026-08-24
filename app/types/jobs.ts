import type { scoreJob } from "~/utils/atsScore";
import type { JobResponse, JobStats } from "~~/shared/contracts/jobs";

export type {
  EmployerType,
  EmploymentKind,
  Job,
  JobExperienceStats,
  JobGroupedSalaryStat,
  JobProfessionGeographyStat,
  JobProfessionStat,
  JobSalaryTrendPoint,
  JobSkillDetail,
  JobSource,
  JobStats,
  LanguageReq,
  Relocation,
  SalaryPeriod,
  SalaryStat,
  Seniority,
  SponsorshipConfidence,
  WorkMode,
} from "~~/shared/contracts/jobs";

export interface JobResult extends JobResponse {
  warming?: boolean;
  loadedSources?: string[];
  pendingSources?: string[];
  failedSources?: string[];
}

export interface RecentJob {
  id: string;
  title: string;
  company: string;
  url: string;
  source: string;
}

export type JobAtsResult = ReturnType<typeof scoreJob>;
export type JobStatEntry = [string, JobStats["byCountry"][string]];
export type WorkModeStat = { key: string; n: number };
