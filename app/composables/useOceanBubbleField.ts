// The bubbles live on a canvas in OceanBubbles and the mascots are DOM elements
// driven by UnderwaterAmbient2d. Neither owns the other, so they meet here: the
// bubble layer publishes where its bubbles currently are, and the swimmers read
// that to steer toward or away from them.
//
// Both components are client-only singletons inside OceanPageBackdrop, so this
// is deliberately module state rather than provide/inject — same shape as the
// state each of those components already keeps.

export type BubbleProbe = {
  x: number;
  y: number;
  radius: number;
};

// Reused in place so a 60fps publish does not allocate.
const field: BubbleProbe[] = [];
let fieldLength = 0;
let popper: ((x: number, y: number, radius: number) => boolean) | null = null;

export function publishBubbleField(next: readonly BubbleProbe[]) {
  fieldLength = next.length;
  for (let i = 0; i < fieldLength; i += 1) {
    const source = next[i]!;
    const slot = field[i];
    if (slot) {
      slot.x = source.x;
      slot.y = source.y;
      slot.radius = source.radius;
    } else {
      field.push({ x: source.x, y: source.y, radius: source.radius });
    }
  }
}

/**
 * Nearest bubble to a point, or null if none is within `range`. Returns the
 * live entry, so callers must not hold onto it across frames.
 */
export function nearestBubble(x: number, y: number, range: number): BubbleProbe | null {
  let best: BubbleProbe | null = null;
  let bestDistance = range * range;

  for (let i = 0; i < fieldLength; i += 1) {
    const bubble = field[i]!;
    const dx = bubble.x - x;
    const dy = bubble.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = bubble;
      bestDistance = distance;
    }
  }

  return best;
}

export function registerBubblePopper(fn: typeof popper) {
  popper = fn;
}

/** Ask the bubble layer to burst whatever bubble sits nearest the point. */
export function popBubbleAt(x: number, y: number, range: number) {
  return popper?.(x, y, range) ?? false;
}

export function resetBubbleField() {
  fieldLength = 0;
  field.length = 0;
  popper = null;
}
