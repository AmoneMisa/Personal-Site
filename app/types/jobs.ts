import type { scoreJob } from "~/utils/atsScore";

export interface LanguageReq { language: string; level?: string }
export interface JobSkillDetail { name: string; category: string; subcategory: string }

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  remote: boolean;
  tags: string[];
  postedAt: string;
  description?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  applyUrl?: string;
  country?: string;
  city?: string;
  workMode?: "remote" | "hybrid" | "office" | "unknown";
  relocation?: "offered" | "none" | "unknown";
  foreignerFriendly?: boolean;
  suspicious?: boolean;
  suspicionReasons?: string[];
  riskCategory?: "gambling" | "adult" | "scam" | null;
  noExperience?: boolean;
  languages?: LanguageReq[];
  skills?: string[];
  niceToHave?: string[];
  skillDetails?: JobSkillDetail[];
  niceToHaveDetails?: JobSkillDetail[];
  experienceMinYears?: number;
  experienceMaxYears?: number;
  salaryPeriod?: "hour" | "month" | "year";
  salaryUsd?: number;
  salaryGross?: boolean;
  salaryNegotiable?: boolean;
  seniority?: "junior" | "middle" | "senior" | "lead" | null;
  managementRole?: boolean;
  education?: string;
  schedule?: string;
  contractType?: string;
  deadline?: string;
  tools?: string[];
  applicationLanguage?: string;
  employerType?: "direct" | "agency" | "board" | "telegram";
  employmentKind?: string;
}

export interface SalaryStat {
  count: number;
  medianUsd: number;
  avgUsd: number;
  minUsd: number;
  maxUsd: number;
}

export interface JobSalaryTrendPoint {
  postedAt: string;
  salaryUsd: number;
  country?: string;
  city?: string;
  title: string;
}

export interface JobStats {
  salary: SalaryStat;
  bySource: Record<string, { count: number; medianUsd: number }>;
  byCountry: Record<string, { count: number; medianUsd: number }>;
  byWorkMode: Record<string, number>;
  foreignerFriendly: number;
  byLanguage: Record<string, number>;
  topSkills: { skill: string; count: number }[];
  salaryTrend: JobSalaryTrendPoint[];
}

export interface JobResult {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  sources: Record<string, number>;
  stats: JobStats;
  rates?: Record<string, number>;
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
export type JobStatEntry = [string, { count: number; medianUsd: number }];
export type WorkModeStat = { key: string; n: number };
