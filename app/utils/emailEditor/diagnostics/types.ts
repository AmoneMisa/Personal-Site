export type DiagnosticSeverity = "warning" | "error";

export type DiagnosticItem = {
    id: string;
    ruleId: string;
    severity: DiagnosticSeverity;
    startOffset: number;
    endOffset: number;
    approxLine?: number;
} & (
    | { messageKey: string; messageParams?: Record<string, unknown>; message?: never }
    | { message: string; messageKey?: never; messageParams?: never }
);
