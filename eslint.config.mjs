import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
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
    },
});
