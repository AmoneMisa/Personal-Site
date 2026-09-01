import withNuxt from './.nuxt/eslint.config.mjs'

const readableControlFlow = ['error', { max: 1 }]

export default withNuxt(
  {
    ignores: [
      '.pnpm-store/**',
      'backend/**',
      'whiteslove.me-audit/**',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/no-mutating-props': ['error', { shallowOnly: true }],
      'max-statements-per-line': ['warn', { max: 1 }],
    },
  },
  {
    files: [
      'app/composables/flats/useFlatFeed.ts',
      'server/middleware/security-headers.ts',
      'server/routes/flats-translate.post.ts',
      'server/routes/jobs-feed.get.ts',
      'server/routes/jobs-vacancy.get.ts',
      'server/utils/backendPlatformProxy.ts',
      'server/utils/backendPlatformShareLookup.ts',
      'server/utils/boundedTtlCache.ts',
      'server/utils/fixedWindowRateLimiter.ts',
      'server/utils/requestClientIp.ts',
    ],
    rules: {
      'max-statements-per-line': readableControlFlow,
    },
  },
)
