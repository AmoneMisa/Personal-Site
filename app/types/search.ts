export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
  count?: number;
  disabled?: boolean;
}

export type SearchSavedView = "active" | "favorites" | "recent" | "hidden";

export type SearchResultAction = "share" | "source" | "favorite" | "hide" | "restore";

export type SearchMatchTier = "good" | "warning" | "bad";
