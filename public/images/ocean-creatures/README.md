# Ocean creatures 2D assets

Lightweight transparent WebP mascots used by `UnderwaterAmbient2d.client.vue`.

The runtime deliberately stays 2D. Each creature is rendered once as an intact sprite and gets lightweight pseudo-animation through whole-sprite deformation, bobbing and path movement. Sharks and other pets react to the pointer by moving away; pointer presses trigger a stronger short dodge. Jellyfish pulse and the puffer has a breathing/inflating cycle.

The `*-clean.webp` files preserve the original character pixels while removing detached fragments left by the generated source sheets. The component renders those complete transparent assets directly, without runtime clipping or vector replacements. The corrupted `fish-blue.webp` and `fish-coral.webp` exports are intentionally not used.

`OceanBubbles.client.vue` owns the bubble canvas. Bubbles can be popped by clicking/tapping them and render a short burst animation.

Animations are disabled for `prefers-reduced-motion`.
