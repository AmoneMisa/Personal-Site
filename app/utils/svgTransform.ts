// Pure transform-string math for the SVG editor's move/scale/rotate tool.
// Kept DOM-free (no getBBox etc.) so it's unit-testable in plain Node - the
// caller supplies the pivot point (usually the element's own bbox center).

export type TransformEdit = {
    translateX: number;
    translateY: number;
    scale: number;
    rotateDeg: number;
};

export const IDENTITY_TRANSFORM_EDIT: TransformEdit = {
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotateDeg: 0,
};

function fmt(n: number): string {
    // Trim float noise (1.0000000002 -> 1) without losing real precision.
    return Number(n.toFixed(4)).toString();
}

// Builds the transform attribute value for an element: the edit (move/scale/
// rotate, scale and rotate pivoting around [cx, cy]) is applied on top of
// whatever transform the element already had, so existing hand-authored
// transforms on the source SVG are preserved rather than clobbered.
export function composeTransform(
    original: string,
    edit: TransformEdit,
    cx: number,
    cy: number
): string {
    const parts: string[] = [];

    if (edit.translateX !== 0 || edit.translateY !== 0) {
        parts.push(`translate(${fmt(edit.translateX)},${fmt(edit.translateY)})`);
    }

    const hasScale = edit.scale !== 1;
    const hasRotate = edit.rotateDeg !== 0;
    if (hasScale || hasRotate) {
        parts.push(`translate(${fmt(cx)},${fmt(cy)})`);
        if (hasRotate) parts.push(`rotate(${fmt(edit.rotateDeg)})`);
        if (hasScale) parts.push(`scale(${fmt(edit.scale)})`);
        parts.push(`translate(${fmt(-cx)},${fmt(-cy)})`);
    }

    const originalTrimmed = String(original || "").trim();
    if (originalTrimmed) parts.push(originalTrimmed);

    return parts.join(" ");
}

export function isIdentityEdit(edit: TransformEdit): boolean {
    return edit.translateX === 0 && edit.translateY === 0 && edit.scale === 1 && edit.rotateDeg === 0;
}
