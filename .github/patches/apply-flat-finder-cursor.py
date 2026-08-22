from pathlib import Path


def replace_once(text, old, new, name):
    if old not in text:
        raise SystemExit(f'missing patch anchor: {name}')
    return text.replace(old, new, 1)

path = Path('app/pages/flat-finder/index.vue')
text = path.read_text()

text = replace_once(
    text,
    '  sourceErrors?: Array<{ source?: string; country?: string; error?: string }>;\n  error?: string;\n',
    '  sourceErrors?: Array<{ source?: string; country?: string; error?: string }>;\n  nextCursor?: string | null;\n  queryMs?: number;\n  error?: string;\n',
    'feed cursor fields',
)

text = replace_once(
    text,
    'const sourceErrors = ref<FeedResult["sourceErrors"]>([]);\n',
    'const sourceErrors = ref<FeedResult["sourceErrors"]>([]);\nconst nextCursor = ref<string | null>(null);\n',
    'cursor state',
)

old = '  const params: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(append ? listings.value.length : 0) };\n'
new = '''  const params: Record<string, string> = { limit: String(PAGE_SIZE) };
  const cursorSort = sort.value === "newest" || sort.value === "oldest";
  if (append && cursorSort && nextCursor.value) params.cursor = nextCursor.value;
  else params.offset = String(append ? listings.value.length : 0);
'''
text = replace_once(text, old, new, 'pagination params')

text = replace_once(
    text,
    '  if (background) { total.value = data.count ?? total.value; sourceErrors.value = data.sourceErrors || []; warming.value = !!data.warming; scheduleWarmPoll(); return; }\n',
    '  if (background) { total.value = data.count ?? total.value; sourceErrors.value = data.sourceErrors || []; warming.value = !!data.warming; scheduleWarmPoll(); return; }\n  nextCursor.value = data.nextCursor || null;\n',
    'capture cursor',
)

text = replace_once(
    text,
    '    if (!background) { failed.value = true; if (!append) { listings.value = []; total.value = 0; } sourceErrors.value = []; loading.value = false; loadingMore.value = false; }\n',
    '    if (!background) { failed.value = true; if (!append) { listings.value = []; total.value = 0; nextCursor.value = null; } sourceErrors.value = []; loading.value = false; loadingMore.value = false; }\n',
    'reset cursor on failed fresh load',
)

path.write_text(text)
