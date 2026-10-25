// The aquarium creatures keep every alternate expression (shark hunt/annoyed,
// jelly moods, puffer ball, ...) in the DOM at opacity 0, which made the browser
// fetch ~5 MB of animated WebP on first paint. Those frames only matter once the
// visitor interacts, so they are mounted after the first interaction, or after a
// long idle fallback so autonomous moods still appear for someone just watching.
const INTERACTION_EVENTS = ["pointerdown", "pointermove", "touchstart", "keydown", "wheel", "scroll"] as const;
const IDLE_FALLBACK_MS = 20_000;

const ready = ref(false);
let armed = false;

export function useExpressionSprites() {
  if (import.meta.client && !armed) {
    armed = true;
    const release = () => {
      if (ready.value) return;
      ready.value = true;
      for (const name of INTERACTION_EVENTS) window.removeEventListener(name, release);
    };
    for (const name of INTERACTION_EVENTS) window.addEventListener(name, release, { passive: true });
    window.setTimeout(release, IDLE_FALLBACK_MS);
  }
  return ready;
}
