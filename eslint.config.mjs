import withNuxt from './.nuxt/eslint.config.mjs'

const readableControlFlow = ['error', { max: 1 }]

export default withNuxt(
  {
    rules: {
      // These rules expose real legacy debt, but turning hundreds of pre-existing
      // violations into a blocking wall would prevent security/reliability work.
      // Keep them visible while the remediation plan burns the baseline down.
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/no-mutating-props': 'warn',
      'max-statements-per-line': ['warn', { max: 1 }],
    },
  },
  {
    // Ratchet: files cleaned as part of the remediation must never regress to the
    // compressed multi-statement style. Add paths here as each area is cleaned.
    files: [
      'app/composables/flats/useFlatFeed.ts',
      'jobs-worker/*.ts',
      'scripts/migrate-database.ts',
      'scripts/prepare-database-schema.ts',
      'server/routes/flats-translate.post.ts',
      'server/routes/jobs-feed.get.ts',
      'server/utils/boundedTtlCache.ts',
      'server/utils/fixedWindowRateLimiter.ts',
      'server/utils/jobSourceConfig.ts',
      'server/utils/jobSourceFetchers.ts',
      'server/utils/jobsSourceRefresh.ts',
    ],
    rules: {
      'max-statements-per-line': readableControlFlow,
    },
  },
)
