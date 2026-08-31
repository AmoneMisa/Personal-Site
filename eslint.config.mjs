import withNuxt from './.nuxt/eslint.config.mjs'

const readableControlFlow = ['error', { max: 1 }]

export default withNuxt(
  {
    ignores: [
      '.pnpm-store/**',
      'backend/**',
      'job-browser-fetcher/**',
      'whiteslove.me-audit/**',
    ],
    rules: {
      // The project has dynamic third-party and browser API boundaries where
      // `any` is intentional. Keep it visible without blocking CI.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Form-editor children intentionally mutate fields of shared reactive
      // state objects, but replacing a prop itself remains an error.
      'vue/no-mutating-props': ['error', { shallowOnly: true }],
      // Keep legacy compressed control flow visible while the ratchet below
      // makes cleaned files fail CI if the pattern is reintroduced.
      'max-statements-per-line': ['warn', { max: 1 }],
    },
  },
  {
    files: [
      'app/composables/flats/useFlatFeed.ts',
      'jobs-worker/*.ts',
      'scripts/migrate-database.ts',
      'scripts/prepare-database-schema.ts',
      'server/middleware/security-headers.ts',
      'server/routes/flats-translate.post.ts',
      'server/routes/jobs-feed.get.ts',
      'server/utils/boundedTtlCache.ts',
      'server/utils/fixedWindowRateLimiter.ts',
      'server/utils/jobSourceConfig.ts',
      'server/utils/jobSourceFetchers.ts',
      'server/utils/jobsSourceRefresh.ts',
      'server/utils/requestClientIp.ts',
      'shared/jobs/jobsPgQueue.ts',
    ],
    rules: {
      'max-statements-per-line': readableControlFlow,
    },
  },
)
