type LanguageToolOptions = {
    signal?: AbortSignal;
    timeoutMs?: number;
};

const MAX_LANGUAGE_TOOL_TEXT_LENGTH = 8000;

export async function checkTextWithLanguageTool(text: string, lang: string, options: LanguageToolOptions = {}) {
    if (text.length > MAX_LANGUAGE_TOOL_TEXT_LENGTH) {
        throw new Error("LanguageTool input is too long");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener("abort", abortFromCaller, {once: true});

    const params = new URLSearchParams({
        text,
        language: lang,
    });

    try {
        const res = await fetch("https://api.languagetool.org/v2/check", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
            signal: controller.signal,
        });

        if (!res.ok) {
            throw new Error("LanguageTool API error");
        }

        return await res.json();
    } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", abortFromCaller);
    }
}
