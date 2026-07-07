import {
    useContacts,
    useFooterBlocks,
    useHeaderMenu,
    useTranslationMessages,
    useTranslationsLoaded
} from '~/composables/useCommonData';
import {safeFetch} from '~/utils/safeFetch';

export async function bootstrapCommonSSR(nuxtApp: ReturnType<typeof useNuxtApp>, lang: string) {
    const config = useRuntimeConfig();
    const api = config.public.apiBase;

    const tr = await safeFetch<Record<string, any>>(
        `${api}/translations/structured`,
        {query: {lang}}
    );

    const hasTranslations = !!(tr.data && Object.keys(tr.data).length);

    if (hasTranslations) {
        nuxtApp.$i18n.setLocaleMessage(lang, tr.data);

        nuxtApp.runWithContext(() => {
            const messages = useTranslationMessages();
            messages.value = tr.data;
        });

        nuxtApp.runWithContext(() => {
            const loaded = useTranslationsLoaded();
            if (!loaded.value.includes(lang)) loaded.value.push(lang);
        });
    }

    const [contacts, menu, footer] = await Promise.all([
        safeFetch(`${api}/contacts`),
        safeFetch(`${api}/header-menu`),
        safeFetch(`${api}/footer/menu/blocks`),
    ]);

    nuxtApp.runWithContext(() => {
        useContacts().value = contacts?.data ?? null;
        useHeaderMenu().value = menu.data ?? null;
        useFooterBlocks().value = footer.data ?? null;
    });
}
