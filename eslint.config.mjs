import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Keep control flow readable: several state mutations or calls must never be
    // compressed onto one physical line (for example `{ a(); b(); c(); }`).
    'max-statements-per-line': ['error', { max: 1 }],
  },
})
