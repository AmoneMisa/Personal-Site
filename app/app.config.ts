// Nuxt UI theme: make component accents (buttons, inputs, focus rings, selected
// states) follow the redesign's pink instead of the default. Custom CSS uses the
// exact brand pink (--accent-pink #e0679a); "pink" is the closest built-in ramp.
export default defineAppConfig({
  ui: {
    colors: {
      primary: "pink",
      neutral: "slate",
    },
  },
});
