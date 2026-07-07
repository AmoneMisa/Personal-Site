import { ref, reactive } from "vue";
import type { DiagnosticItem } from "~/utils/emailEditor/diagnostics/types";
import type { PreviewClient, TemplateEngine } from "~/utils/emailEditor/preview/clientProfiles";

export type MonacoBridgeApi = {
  insertSnippet: (snippet: string) => void;
  replaceRange: (startOffset: number, endOffset: number, text: string) => void;
  revealOffsets: (startOffset: number, endOffset: number) => void;
  getText: () => string;
};

export function useEmailEditorState() {
  const code = ref<string>(defaultStarterHtml());
  const templateEngine = ref<TemplateEngine>("clean_html");
  const previewClient = ref<PreviewClient>("gmail");

  const diagnostics = ref<DiagnosticItem[]>([]);
  const activeDiagnosticId = ref<string | null>(null);

  const isBusy = ref(false);

  const modals = reactive({
    insertImage: false,
    insertLink: false,
    insertTemplate: false,
  });

  const monacoApi = ref<MonacoBridgeApi | null>(null);

  const colorPicker = reactive({
    open: false,
    color: "#15162A",
    anchorClientX: 0,
    anchorClientY: 0,
    replaceRange: null as null | { startOffset: number; endOffset: number },
    originalText: "",
    preferHex: true,
  });

  // Fake data: sample values for template variables, shown by variable path in a
  // separate window and substituted into the preview when enabled.
  const fakeData = reactive({
    enabled: false,
    open: false,
    values: {} as Record<string, string>,
  });

  return {
    code,
    templateEngine,
    previewClient,
    diagnostics,
    activeDiagnosticId,
    isBusy,
    modals,
    monacoApi,
    colorPicker,
    fakeData,
  };
}

function defaultStarterHtml() {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width,initial-scale=1">',
    "  <title>Email</title>",
    "</head>",
    "<body>",
    '  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-root">',
    "    <tr>",
    '      <td align="center" class="email-root__cell">',
    '        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="email-card">',
    "          <tr>",
    '            <td class="email-card__content" style="padding:24px;">',
    '              <h1 class="email-title" style="margin:0 0 12px 0;">Hello!</h1>',
    '              <p class="email-text" style="margin:0;">Write your email here.</p>',
    "            </td>",
    "          </tr>",
    "        </table>",
    "      </td>",
    "    </tr>",
    "  </table>",
    "</body>",
    "</html>",
  ].join("\n");
}
