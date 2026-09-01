export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
  count?: number;
  disabled?: boolean;
}

export type SearchMatchTier = "good" | "warning" | "bad";

export type SearchFilterValue = string | number | boolean | string[] | null | undefined;

export type SearchFilterControl =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "checkbox"
  | "custom";

export interface SearchFilterField {
  id: string;
  control: SearchFilterControl;
  label?: string;
  value?: SearchFilterValue;
  options?: Array<SelectOption | string>;
  placeholder?: string;
  icon?: string;
  class?: string;
  disabled?: boolean;
  hidden?: boolean;
  searchable?: boolean;
  min?: number;
  max?: number;
  step?: number;
  inputmode?: "decimal" | "numeric" | "search" | "text";
  title?: string;
  onUpdate?: (value: SearchFilterValue) => void;
  onCommit?: () => void;
  onEnter?: () => void;
}

export interface SearchFilterBlock {
  id: string;
  title: string;
  icon?: string;
  class?: string;
  gridClass?: string;
  fields: SearchFilterField[];
}
