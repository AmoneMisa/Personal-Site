export type MergeJsonEditorMode = "json" | "flat";
export type MergeJsonDecorationKind = "new" | "conflict" | "added" | "edited" | "find";
export type MergeJsonDecoration = {path: string; kind: MergeJsonDecorationKind};
