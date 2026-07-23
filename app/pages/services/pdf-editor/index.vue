<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import CustomButton from "~/components/common/CustomButton.vue";
import { computed, ref } from "vue";

const config = useRuntimeConfig();
const { t } = useI18n();

useSeoMeta({
  title: () => t('seo.pages.pdfEditor.title'),
  description: () => t('seo.pages.pdfEditor.description'),
  robots: () => t('seo.common.robots'),
  ogType: "website",
  ogSiteName: () => t('seo.common.siteName'),
  ogTitle: () => t('seo.pages.pdfEditor.ogTitle'),
  ogDescription: () => t('seo.pages.pdfEditor.ogDescription')
});
const router = useRouter();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);

const isBusy = ref(false);
const errorMsg = ref<string | null>(null);

const fileLabel = computed(() => selectedFile.value?.name ?? "");
const fileSizeMb = computed(() => {
  const f = selectedFile.value;
  if (!f) return "";
  return `${Math.max(0.1, Math.round((f.size / 1024 / 1024) * 10) / 10)} MB`;
});

function openPicker() {
  fileInput.value?.click();
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0] ?? null;
  if (!f) return;

  // accept only pdf
  const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    errorMsg.value = t("services.pdfEditor.upload.onlyPdf") || "Only PDF files are allowed";
    input.value = "";
    return;
  }

  selectedFile.value = f;
  errorMsg.value = null;
  input.value = "";
}

function clear() {
  selectedFile.value = null;
  errorMsg.value = null;
}

async function createDoc() {
  errorMsg.value = null;
  const f = selectedFile.value;
  if (!f) return;

  isBusy.value = true;
  try {
    const form = new FormData();
    form.append("files", f);

    const res = await $fetch<{ docId: string; expiresAtDraft: number }>(`${config.public.apiBase}/pdf/create`, {
      method: "POST",
      body: form,
    });

    await router.push(`/services/pdf-editor/${res.docId}`);
  } catch (e: any) {
    errorMsg.value = e?.data?.detail?.message || e?.data?.message || e?.message || "Create failed";
  } finally {
    isBusy.value = false;
  }
}
</script>

<template>
  <u-container class="pdf">
    <div class="pdf__header background-hero text-center space-y-3">
      <page-header
          title="services.pdfEditor.title"
          headline="services.pdfEditor.headline"
          description="services.pdfEditor.subtitle"
          class="mb-6"
          :is-centered="true"
      />
    </div>

    <div class="pdf__grid">
      <section class="ui-anim-border pdf__panel">
        <div class="ui-anim-border__inner pdf__panel-inner">
          <div class="pdf__panel-head">
            <div class="pdf__panel-title">
              <u-icon name="i-lucide-upload" />
              <span>{{ t("services.pdfEditor.upload.title") }}</span>
            </div>

            <button type="button" class="ui-pill-btn ui-pill-btn_animated" @click="openPicker" :disabled="isBusy">
              <span class="ui-pill-btn__inner">
                <u-icon name="i-lucide-plus" />
                {{ t("services.pdfEditor.upload.add") }}
              </span>
            </button>
            <input
                ref="fileInput"
                type="file"
                accept="application/pdf,.pdf"
                class="hidden"
                @change="onPick"
            />
          </div>
          <div v-if="selectedFile" class="pdf__files">
            <ul class="pdf__file-list">
              <li class="pdf__file">
                <div class="pdf__file-left">
                  <div class="pdf__file-ico">
                    <u-icon name="i-lucide-file-text" />
                  </div>
                  <div class="pdf__file-meta">
                    <div class="pdf__file-name">{{ fileLabel }}</div>
                    <div class="pdf__file-size text-muted">{{ fileSizeMb }}</div>
                  </div>
                </div>

                <button
                    type="button"
                    class="pdf__icon-btn pdf__icon-btn_danger"
                    @click="clear"
                    :disabled="isBusy"
                >
                  <u-icon name="i-lucide-x" />
                </button>
              </li>
            </ul>

            <div class="pdf__upload-actions">
              <custom-button
                  variant="full"
                  class="pdf__run-btn"
                  :class="{ 'opacity-60 pointer-events-none': isBusy }"
                  @click="createDoc"
              >
                {{ t("services.pdfEditor.upload.start") }}
              </custom-button>

              <button type="button" class="ui-pill-btn" @click="clear" :disabled="isBusy">
                <span class="ui-pill-btn__inner">
                  <u-icon name="i-lucide-trash-2" />
                  {{ t("services.pdfEditor.upload.clear") }}
                </span>
              </button>
            </div>

            <div class="pdf__help text-muted">
              {{ t("services.pdfEditor.upload.singleHelp") || "You can upload only one PDF for editing." }}
            </div>
          </div>

          <div v-else class="pdf__hint text-muted">
            {{ t("services.pdfEditor.upload.hint") }}
          </div>

          <div v-if="errorMsg" class="pdf__error">{{ errorMsg }}</div>
        </div>
      </section>
    </div>
  </u-container>
</template>

<style lang="scss">
.pdf {
  padding-top: 24px;
  padding-bottom: 96px;
}

.pdf__subtitle {
  max-width: 760px;
  font-size: 14px;
}

.pdf__grid {
  margin-top: 28px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.pdf__panel {
  border-radius: 18px;
}

.pdf__panel-inner {
  border-radius: 16px;
  padding: 16px;
}

.pdf__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.pdf__panel-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.9);
}

.light .pdf__panel-title {
  color: rgba(21, 22, 42, 0.85);
}

.pdf__files {
  margin-top: 6px;
}

.pdf__file-list {
  display: grid;
  gap: 8px;
}

.pdf__file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.pdf__file-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.pdf__file-ico {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.pdf__file-name {
  font-weight: 800;
  color: rgba(255, 255, 255, 0.88);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 36ch;
}

.light .pdf__file-name {
  color: rgba(21, 22, 42, 0.86);
}

.pdf__icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.85);
  transition: filter 160ms ease, transform 140ms ease;
}

.pdf__icon-btn:hover {
  filter: brightness(1.08);
}

.pdf__icon-btn:active {
  transform: translateY(1px);
}

.pdf__icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pdf__icon-btn_danger {
  border-color: rgba(255, 80, 120, 0.28);
  background: rgba(255, 80, 120, 0.10);
  color: rgb(255, 120, 150);
}

.pdf__icon-btn_danger:hover {
  background: rgba(255, 80, 120, 0.20);
  color: rgb(255, 150, 175);
}

.pdf__upload-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Match the neighbouring "Clear list" pill: same height and radius so the
   primary action sits inline instead of towering over it. */
.pdf__run-btn {
  min-width: 200px;
  height: 40px !important;
  border-radius: 14px !important;
}

.pdf__error {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 80, 120, 0.1);
  border: 1px solid rgba(255, 80, 120, 0.18);
}

.pdf__hint {
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.pdf__help {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.35;
}
</style>
