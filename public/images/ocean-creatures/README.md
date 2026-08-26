# Ocean creatures 2D assets

Lightweight transparent WebP mascots used by `UnderwaterAmbient2d.client.vue`.

The runtime deliberately stays 2D. Creature movement and cursor behaviour live in `UnderwaterAmbient2d.client.vue`; secondary body articulation lives in `app/assets/css/ocean-creature-rig.css`.

The `*-clean.webp` files preserve the original character pixels while removing detached fragments left by the generated source sheets. The source art is still stored as complete flattened transparent sprites — no destructive re-export or baked animation frames are required.

On browsers with CSS mask support, the rig reuses safe regions of those same sprites as lightweight articulated layers: the shark gets rear-spine and tail motion, the puffer gets a tail bone, the seahorse gets a lower-tail bone, and jellyfish separate bell motion from tentacle drift. Angles stay intentionally small because the artwork was not authored as cut-out animation.

The intact `<img>` remains in the DOM and owns sizing. If masking is not supported, the rig rules do not activate and the user sees the original complete sprite. This fallback is intentional and should be preserved when changing the rig.

The corrupted `fish-blue.webp` and `fish-coral.webp` exports are intentionally not used.

`OceanBubbles.client.vue` owns the bubble canvas. Bubbles can be popped by clicking/tapping them and render a short burst animation.

Animations are disabled for `prefers-reduced-motion`.
