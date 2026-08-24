export type DockerResolveResponse = {
  repo: string;
  major: number;
  variant?: string | null;
  best_tag: string | null;
  fallbacks: string[];
  reason: string;
  total_matched: number;
};

export type DockerAliasesResponse = {
  repo: string;
  tag: string;
  digest: string | null;
  aliases: string[];
  reason: string;
};

export type DockerSimpleSearchItem = {
  base: string;
  tag: string;
  examples: string[];
};

export type DockerSimpleSort = "len_asc" | "len_desc";
export type DockerVariantPreset = {labelKey: string; value: string | null};
