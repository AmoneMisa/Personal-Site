export interface ActivitySummary {
  firstSeenAt?: string | null;
  dateUpdateCount?: number;
  reappearanceCount?: number;
  duplicateCount?: number;
  latestSourcePublishedAt?: string | null;
  repostCount?: number;
}
export type ActivityTab = "details" | "contact" | "history" | "duplicates";
export interface ActivityEvent {
  id: string;
  kind: string;
  observedAt: string;
  sourcePublishedAt?: string | null;
  price?: number | string | null;
  currency?: string | null;
  salary?: string | null;
}
export interface ActivityHistory {
  firstSeenAt: string | null;
  events: ActivityEvent[];
  nextCursor: string | null;
}
export interface DuplicateListing {
  publicId: number;
  id: string;
  source: string;
  title: string;
  url?: string | null;
  applyUrl?: string | null;
  salary?: {
    min: number | null; max: number | null; currency: string | null;
    period: string | null; gross: boolean | null; negotiable: boolean;
  };
  price?: string | number | null;
  currency?: string;
  active: boolean;
  current: boolean;
  firstSeenAt?: string;
  sourcePublishedAt?: string;
  advertiserType: "agency" | "owner_claim" | "direct" | "unknown";
  commission?: boolean | null;
  commissionPercent?: number | null;
  commissionAmount?: {amount: number; currency?: string | null} | null;
  matchKind: string;
  company?: string;
  contactActions?: unknown;
}
export interface ActivityDuplicates {
  origin?: {
    status: "candidate" | "insufficient_evidence" | "ambiguous";
    candidatePublicId: number | null;
    confidence: "moderate" | null;
    evidence: string[];
    comparedPublicIds: number[];
    ownershipVerified: false;
  };
  duplicateCount: number;
  groups: {key: string; contact: string | null; sameAdvertiser: boolean; company?: string; advertiserType?: string; listings: DuplicateListing[]}[];
}
