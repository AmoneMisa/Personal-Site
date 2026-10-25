// The aquarium is decorative and client-only, but its animated WebP sprites are
// heavy (~3 MB for the base frames, ~5 MB more for the alternate expressions).
// Both are held back until the visitor interacts, or until a fallback timer
// fires so the scene still appears for someone who is only watching.
const INTERACTION_EVENTS = ["pointerdown", "pointermove", "touchstart", "keydown", "wheel", "scroll"] as const;

function createInteractionGate(idleFallbackMs: number) {
  const ready = ref(false);
  let armed = false;

  return function useGate() {
    if (import.meta.client && !armed) {
      armed = true;
      const release = () => {
        if (ready.value) return;
        ready.value = true;
        for (const name of INTERACTION_EVENTS) window.removeEventListener(name, release);
      };
      for (const name of INTERACTION_EVENTS) window.addEventListener(name, release, { passive: true });
      window.setTimeout(release, idleFallbackMs);
    }
    return ready;
  };
}

/** Alternate expressions (shark hunt/annoyed, jelly moods, puffer ball, ...). */
export const useExpressionSprites = createInteractionGate(20_000);

/** The swimming creatures and the header crab themselves. */
export const useAquariumLife = createInteractionGate(6_000);
