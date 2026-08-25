# Ocean creatures 2D assets

Lightweight transparent WebP mascots used by `UnderwaterAmbient2d.client.vue`.

The runtime deliberately stays 2D. Each creature is rendered once as an intact sprite and gets lightweight pseudo-animation through whole-sprite deformation, bobbing and path movement. Fish, sharks and other pets react to the pointer by moving away; pointer presses trigger a stronger short dodge. Jellyfish pulse and the puffer has a breathing/inflating cycle.

Generated source sheets that contain detached auxiliary parts are cropped at runtime as a single image; the component does not duplicate/cut the same source into fake body/tail/fin layers. The previously corrupted `fish-fancy.webp` asset was removed and its visual slot temporarily reuses the clean blue fish with a hue shift.

`OceanBubbles.client.vue` owns the bubble canvas. Bubbles can be popped by clicking/tapping them and render a short burst animation.

Animations are disabled for `prefers-reduced-motion`.
