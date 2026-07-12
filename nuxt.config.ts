import svgLoader from 'vite-svg-loader';

export default defineNuxtConfig({
    app: {
        head: {
            htmlAttrs: {
                lang: 'ru'
            },
            link: [
                {
                    rel: "preload",
                    as: "font",
                    href: "/fonts/PT Root UI_Regular.woff2",
                    type: "font/woff2",
                    crossorigin: "anonymous"
                },
                {
                    rel: "preload",
                    as: "font",
                    href: "/fonts/PT Root UI_Bold.woff2",
                    type: "font/woff2",
                    crossorigin: "anonymous"
                }
            ]
        }
    },
    compatibilityDate: '2025-07-15',
    devtools: {enabled: true},
    modules: ['@nuxt/ui', '@nuxtjs/i18n', '@nuxt/icon', '@nuxt/image'],
    css: ['~/assets/css/main.css'],
    sourcemap: {
        client: true,
        server: true
    },
    vite: {
        build: {
            sourcemap: true,
            minify: 'esbuild',
            cssMinify: 'lightningcss'
        },
        plugins: [svgLoader()], optimizeDeps: {
            exclude: ["monaco-editor"],
        }
    },
    i18n: {
        baseUrl: 'https://whiteslove.me',
        defaultLocale: 'ru',
        langDir: null,
        locales: [
            {code: 'en', language: 'en-US', name: 'English'},
            {code: 'ru', language: 'ru-RU', name: 'Русский'},
            // {code: 'kk', language: 'kk-KZ', name: 'Қазақша'}
        ],
        strategy: 'no_prefix',
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
        experimental: {
            websocket: true
        },
        routeRules: {
            '/api/**': {proxy: 'http://backend:8000/**'}, //http://backend:8000/** - prod
            '/fonts/**': {headers: {'cache-control': 'public, max-age=31536000, immutable'}},
            '/images/**': {headers: {'cache-control': 'public, max-age=31536000, immutable'}},
            '/svg/**': {headers: {'cache-control': 'public, max-age=31536000, immutable'}},
            '/_ipx/**': {headers: {'cache-control': 'public, max-age=31536000, immutable'}}
        }
    },
    icon: {
        localApiEndpoint: "/_nuxt_icon"
    }
});