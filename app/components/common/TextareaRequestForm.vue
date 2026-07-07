<script setup lang="ts">
import {computed, ref, watch} from "vue";
import CustomButton from "~/components/common/CustomButton.vue";

defineProps({
  placeholder: {
    type: String,
    default: "Type something to promt AI...",
    required: true
  },
  buttonText: {
    type: String,
    default: "Start with AI",
    required: true
  },
  rows: {
    type: Number,
    default: 2
  },
  autoresize: {
    type: Boolean,
    default: false
  }
});

const TG_USERNAME = "whiteslove";
const message = ref("");

const MAX_LEN = 1500;

const patterns = {
  htmlTag: /<[^>]+>/i,
  scriptTag: /<\s*\/?\s*script\b/i,
  dangerousTags: /<\s*(iframe|object|embed|link|meta)\b/i,
  jsProto: /\b(javascript|data)\s*:/i,
  url: /\b((https?:\/\/|ftp:\/\/|tg:\/\/)|www\.)/i,
  domainLike: /(?<!@)\b([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?/i
};

function validateInput(text: string): string | null {
  const t = text.trim();

  if (!t) return "Введите текст.";
  if (t.length > MAX_LEN) return `Слишком длинно: максимум ${MAX_LEN} символов.`;
  if (patterns.scriptTag.test(t)) return "Скрипты запрещены.";
  if (patterns.dangerousTags.test(t)) return "HTML-теги запрещены.";
  if (patterns.htmlTag.test(t)) return "HTML запрещён.";
  if (patterns.jsProto.test(t)) return "Опасные протоколы запрещены.";
  if (patterns.url.test(t)) return "Ссылки запрещены.";
  if (patterns.domainLike.test(t)) return "Домены/ссылки запрещены.";

  return null;
}

const touched = ref(false);
const submitted = ref(false);

const rawError = computed(() => validateInput(message.value));

const showError = computed(() => {
  if (!touched.value && !submitted.value) return false;
  if (touched.value && !submitted.value && !message.value.trim()) return false;
  return !!rawError.value;
});

const errorText = computed(() => (showError.value ? rawError.value : null));

const isSubmitDisabled = computed(() => submitted.value && !!rawError.value);

watch(message, () => {
  if (!touched.value) touched.value = true;
});

const copied = ref(false);

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    return true;
  } catch {
    copied.value = false;
    return false;
  }
}

function tryOpen(url: string) {
  return new Promise<boolean>((resolve) => {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) return resolve(false);
    resolve(true);
  });
}

async function openTelegramShare() {
  submitted.value = true;

  const err = validateInput(message.value);
  if (err) return;

  copied.value = false;

  const text = message.value.trim();
  const encoded = encodeURIComponent(text);
  const profileUrl = `https://t.me/${encodeURIComponent(TG_USERNAME)}`;

  // Telegram ignores the `text` param when opening a user profile chat
  // (tg://resolve?domain=…&text=… / t.me/<user>?text=…), so the message never
  // gets prefilled that way. The share dialog is the only deep link that carries
  // the text. The universal https link opens the native app on mobile and
  // Telegram Web on desktop, and lets the user pick the developer as recipient.
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encoded}`;

  // Copy first as a fallback in case the user dismisses the share sheet.
  const copiedOk = await copyToClipboard(text);

  const opened = await tryOpen(shareUrl);
  if (!opened && !copiedOk) await copyToClipboard(text);
}

</script>

<template>
  <u-form
      class="flex justify-center flex-col items-center gap-3 m-auto p-6 max-w-[540px] w-full rounded-xl textarea-form"
      @submit.prevent="openTelegramShare"
  >
    <u-form-field class="w-full">
      <u-textarea
          v-model="message"
          :rows="rows"
          :placeholder="placeholder"
          :required="true"
          :autoresize="autoresize"
          class="w-full border-[1px] rounded-md border-primary"
      />

      <p v-if="errorText" class="mt-2 text-sm text-red-500">
        {{ errorText }}
      </p>
      <p v-else-if="copied" class="mt-2 text-sm text-green-500">
        Текст скопирован.
      </p>
    </u-form-field>

    <u-separator class="py-2.5" :ui="{ border: '' }"/>

    <u-form-field class="w-fill-available">
      <custom-button
          class="w-fill-available justify-center"
          variant="full"
          type="submit"
          :disabled="isSubmitDisabled"
      >
        {{ buttonText }}
      </custom-button>
    </u-form-field>
  </u-form>
</template>

<style scoped>
.textarea-form {
  background-color: var(--color-blackest);
}
</style>
