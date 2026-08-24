import svgLoader from 'vite-svg-loader';

export default defineNuxtConfig({
    app: {
        head: {
            htmlAttrs: {
                lang: 'ru'
            },
            script: [
                {
                    // The site is dark-only. Lock the persisted preference before paint
                    // so stale values from the removed theme toggle cannot flash a light theme.
                    tagPriority: 'critical',
                    innerHTML:
                        "try{localStorage.setItem('nuxt-color-mode','dark');" +
                        "document.cookie='nuxt-color-mode=dark;path=/;max-age=31536000';}catch(e){}" +
                        "var d=document.documentElement;d.classList.add('dark');" +
                        "d.classList.remove('light');d.style.colorScheme='dark';"
                }
            ],
            link: [
                {
                    rel: "preload",
                    as: "font",
                    href: "/fonts/redesign/golos-text-400-cyrillic.woff2",
                    type: "font/woff2",
                    crossorigin: "anonymous"
                },
                {
                    rel: "preload",
                    as: "font",
                    href: "/fonts/redesign/inter-400-cyrillic.woff2",
                    type: "font/woff2",
                    crossorigin: "anonymous"
                }
            ]
        }
    },
    compatibilityDate: '2025-07-15',
    devtools: {enabled: true},
    modules: ['@nuxtjs/i18n', '@nuxt/icon', '@nuxt/image'],
    css: ['~/assets/css/main.css', '~/assets/css/flat-placeholder.css'],
    sourcemap: {
        client: false,
        server: true
    },
    vite: {
        build: {
            sourcemap: false,
            cssMinify: 'lightningcss',
            reportCompressedSize: false
        },
        plugins: [svgLoader()], optimizeDeps: {
            exclude: ["monaco-editor"],
        }
    },
    i18n: {
        baseUrl: 'https://whiteslove.me',
        defaultLocale: 'ru',
        // Messages are now static JSON in i18n/locales (was DB-driven). Lazy-loaded
        // per locale; missing keys fall back to ru (see i18n.config.ts).
        langDir: 'locales',
        lazy: true,
        vueI18n: './i18n.config.ts',
        // Some messages legitimately contain literal HTML tags as text (email-editor
        // diagnostics mention <style>, <{tag}>, ...). They're trusted and rendered
        // via {{ }} (auto-escaped), so allow them past the strict compile check.
        compilation: {
            strictMessage: false,
        },
        locales: [
            {code: 'en', language: 'en-US', name: 'English', files: ['en.json', 'errors.en.json']},
            {code: 'ru', language: 'ru-RU', name: 'Русский', files: ['ru.json', 'errors.ru.json']},
        ],
        // Russian is the default and stays unprefixed at "/"; other locales get a
        // path prefix ("/en/..."). This gives every language a distinct, indexable
        // URL so hreflang alternates and the per-locale sitemap actually mean
        // something to search engines.
        strategy: 'prefix_except_default',
        detectBrowserLanguage: {
            useCookie: true, // Crucial: This tells i18n to use a cookie
            cookieKey: 'i18n_lang', // Default cookie name, you can change it
            alwaysRedirect: false, // Don't redirect if a cookie is already set (important for no_prefix)
            redirectOn: 'root', // Detect on the first visit to the root path
            fallbackLocale: 'ru', // Fallback if detected browser lang isn't available
        },
    },
    experimental: {appManifest: false},
    runtimeConfig: {
        apiBase: 'http://backend:8000', //http://backend:8000/** - prod
        public: {
            apiBase: '/api'
        }
    },
    nitro: {
        // Jobs/hiring read APIs live directly in Nitro server routes. No crawler,
        // scheduler or queue execution is registered in this process; the separate
        // Node jobs-worker owns every ingestion task.
        compressPublicAssets: {gzip: true, brotli: true},
        routeRules: {
            '/api/**': {proxy: 'http://backend:8000/**'}, //http://backend:8000/** - prod
            '/fonts/**': {headers: {'cache-control': 'public, max-age=31536000, immutable'}},
            '/images/**': {headers: {'cache-control': 'public, max-age=31536000, immutable'}},
            '/svg/**': {headers: {'cache-control': 'public, max-age=31536000, immutable'}},
            '/_ipx/**': {headers: {'cache-control': 'public, max-age=31536000, immutable'}}
        }
    },
    icon: {
        // Never make SSR depend on Iconify/network availability. All literal
        // icon usages are collected at build time; unresolved/dynamic icons fail
        // visually instead of blocking the entire HTML response and causing 504s.
        provider: 'none',
        serverBundle: false,
        fallbackToApi: false,
        clientBundle: {
            scan: true,
            icons: [
                'lucide:search',
                'lucide:bookmark-plus',
                'lucide:share-2',
                'lucide:chevron-down',
                'lucide:house',
                'lucide:arrow-left',
                'lucide:refresh-cw',
                'lucide:layout-grid',
                'lucide:sparkles',
                'lucide:snowflake',
                'lucide:square-parking',
                'lucide:wifi',
                'lucide:flame',
                'lucide:panel-top',
                'lucide:sun',
                'lucide:tree-pine',
                'lucide:sliders-horizontal',
                'lucide:rotate-ccw',
            ],
        },
    }
});