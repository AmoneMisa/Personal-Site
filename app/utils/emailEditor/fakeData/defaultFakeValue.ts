// Produce a friendly sample value for a variable path based on its leaf segment,
// so the fake-data window starts pre-filled with something readable.
const LEAF_SAMPLES: Array<[RegExp, string]> = [
    [/^(first_?name)$/i, "John"],
    [/^(last_?name)$/i, "Doe"],
    [/^(full_?name|username|user|name)$/i, "John Doe"],
    [/^(e?mail|email_?address)$/i, "john.doe@example.com"],
    [/^(phone|tel|mobile)$/i, "+1 555 0100"],
    [/^(company|org|organization)$/i, "Acme Inc."],
    [/^(date|created_?at|updated_?at)$/i, "2026-01-01"],
    [/^(time)$/i, "10:30"],
    [/^(price|total|amount|sum|subtotal|cost)$/i, "99.00"],
    [/^(count|qty|quantity|number|num)$/i, "3"],
    [/^(url|link|href)$/i, "https://example.com"],
    [/^(id|uuid)$/i, "1001"],
    [/^(city)$/i, "New York"],
    [/^(country)$/i, "USA"],
    [/^(title|subject)$/i, "Hello"],
    [/^(status|state)$/i, "active"],
    [/^(code|token)$/i, "ABC123"],
];

function humanize(leaf: string): string {
    const words = leaf
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim();
    if (!words) return leaf;
    return words
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

export function defaultFakeValue(path: string): string {
    const segments = path.split(/\.|\[\d+\]/).filter(Boolean);
    const leaf = segments[segments.length - 1] ?? path;

    for (const [re, sample] of LEAF_SAMPLES) {
        if (re.test(leaf)) return sample;
    }

    return humanize(leaf);
}
