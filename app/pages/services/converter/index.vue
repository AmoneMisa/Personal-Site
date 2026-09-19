<script setup lang="ts">
import CustomButton from "~/components/common/CustomButton.vue";
import { useServiceSeo } from "~/composables/services/useServiceSeo";
import {formatFileSize} from "~/utils/files";
import {useConverterState} from "~/composables/converter/useConverterState";

const {t, locale} = useI18n();

useServiceSeo("converter");

const {
  mode,
  target,
  accept,
  maxFiles,
  isMultiple,
  isLoading,
  errorMessage,
  successMessage,
  files,
  fileInputRef,
  isDragging,
  removeFile,
  onDragOver,
  onDragLeave,
  clearFiles,
  openPicker,
  pickFilesFromInput,
  onDrop,
  convert,
  modeCards,
  targetItems,
} = useConverterState();

// `accept` is the raw input attribute (".png,.jpg,..."); spaced for reading.
const acceptLabel = computed(() => accept.value.split(",").join(", "));

// "20 файлов" / "1 файл" instead of the old catch-all "файл(ов)".
const FILE_FORMS = {one: "filesOne", few: "filesFew"} as Record<string, string>;
function filesWord(n: number): string {
  const category = new Intl.PluralRules(locale.value).select(n);
  return t(`services.converter.dropzone.${FILE_FORMS[category] ?? "filesMany"}`);
}
</script>

<template>
  <u-page class="converter" :ui="{ center: 'flex flex-col gap-[28px] lg:gap-[32px] xl:gap-[40px] py-12' }">
    <!-- `converter` is the root that assets/css/ui.css styles against (panel,
         dropzone, tips); without it none of that applied. -->
    <service-page-header
        backdrop="reef"
        title="services.converter.hero.titleLine1"
        headline="services.converter.subtitle"
        description="services.converter.hero.description"
    />
    <u-page-body class="mt-4 pb-0 gap-16 flex flex-col justify-center">
      <u-container class="max-w-6xl mx-auto mb-0">
        <div class="mode-grid">
          <button
              v-for="c in modeCards"
              :key="c.key"
              class="mode-card"
              :class="{ 'is-active': mode === c.key }"
              type="button"
              @click="mode = c.key"
          >
            <span class="mode-card__top">
              <span class="mode-card__icon"><icon class="mode-card__glyph" :name="c.icon"/></span>
              <span class="mode-card__title">{{ c.title }}</span>
            </span>
            <span class="mode-card__desc">{{ c.desc }}</span>
          </button>
        </div>
      </u-container>

      <u-container class="max-w-6xl mx-auto mb-0">
        <div class="panel">
          <div class="panel__header">
            <page-header
                :title="
                mode === 'media'
                  ? t('services.converter.panel.title.media')
                  : mode === 'data'
                    ? t('services.converter.panel.title.data')
                    : t('services.converter.panel.title.docs')
              "
                :description="
                mode === 'media'
                  ? t('services.converter.panel.description.media')
                  : mode === 'data'
                    ? t('services.converter.panel.description.data')
                    : t('services.converter.panel.description.docs')
              "
                descriptionSize="18"
                class="border-none"
            />

            <div class="panel__controls">
              <div class="control">
                <span class="control__label">
                  {{ t('services.converter.controls.targetFormat') }}
                </span>

                <!-- The app's SelectMenu (components/U/SelectMenu.vue) is already a
                     complete 44px field and ignores `ui`, so wrapping it in a
                     pill drew a second field around it. -->
                <u-select-menu
                    v-model="target"
                    :items="targetItems"
                    value-key="value"
                    label-key="label"
                    class="format-select ui-locale"
                />
              </div>

              <custom-button
                  variant="primary"
                  class="control__btn"
                  :disabled="isLoading"
                  @click="convert"
              >
                <span v-if="!isLoading">{{ t('services.converter.controls.convert') }}</span>
                <span v-else>{{ t('services.converter.controls.converting') }}</span>
              </custom-button>
            </div>
          </div>

          <div
              class="dropzone"
              :class="{ 'is-dragging': isDragging }"
              @drop="onDrop"
              @dragover="onDragOver"
              @dragleave="onDragLeave"
          >
            <div class="dropzone__inner">
              <div class="dropzone__badge">
                <icon name="i-lucide-upload" class="dropzone__badge-icon"/>
              </div>

              <div class="dropzone__text">
                <div class="dropzone__title">
                  {{ t('services.converter.dropzone.title') }}
                  <span class="dropzone__muted">{{ t('services.converter.dropzone.orPick') }}</span>
                </div>

                <div class="dropzone__meta">
                  <span>
                    {{ t('services.converter.dropzone.support') }}
                    <b>{{ acceptLabel }}</b>
                  </span>
                  <span>
                    {{ t('services.converter.dropzone.limit') }}
                    <b>{{ maxFiles }}</b> {{ filesWord(maxFiles) }}
                  </span>
                </div>
              </div>

              <div class="dropzone__actions">
                <input
                    ref="fileInputRef"
                    class="visually-hidden"
                    type="file"
                    :multiple="isMultiple"
                    :accept="accept"
                    @change="pickFilesFromInput"
                />

                <custom-button
                    :buttonType="'white'"
                    class="dropzone__pick"
                    @click="openPicker"
                >
                  {{ t('services.converter.dropzone.pick') }}
                </custom-button>

                <custom-button
                    :buttonType="'link'"
                    class="dropzone__clear"
                    :disabled="isLoading"
                    @click="clearFiles"
                >
                  {{ t('services.converter.dropzone.clear') }}
                </custom-button>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" class="msg msg--error">
            <icon name="i-lucide-alert-triangle" class="msg__icon"/>
            <span>{{ errorMessage }}</span>
          </div>
          <div v-if="successMessage" class="msg msg--ok">
            <icon name="i-lucide-check-circle-2" class="msg__icon"/>
            <span>{{ successMessage }}</span>
          </div>

          <div class="files" v-if="files.length">
            <div class="files__head">
              <span class="files__title">{{ t('services.converter.files.title') }}</span>
              <span class="files__hint" v-if="mode === 'media'">
                {{ t('services.converter.files.zipHintMedia') }}
              </span>
            </div>

            <div class="files__list">
              <div v-for="(f, idx) in files" :key="`${f.name}-${idx}`" class="file">
                <div class="file__meta">
                  <span class="file__name">{{ f.name }}</span>
                  <span class="file__size">{{ formatFileSize(f.size) }}</span>
                </div>

                <button class="file__remove" type="button" @click="removeFile(idx)" :disabled="isLoading">
                  <icon name="i-lucide-x"/>
                </button>
              </div>
            </div>
          </div>

          <div class="tips">
            <div class="tip">
              <icon name="i-lucide-sparkles" class="tip__icon"/>
              <span>{{ t('services.converter.tips.pngToJpeg') }}</span>
            </div>
            <div class="tip">
              <icon name="i-lucide-info" class="tip__icon"/>
              <span>{{ t('services.converter.tips.pdfToDocx') }}</span>
            </div>
          </div>
        </div>
      </u-container>
    </u-page-body>
  </u-page>
</template>

<style scoped lang="scss">
.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
}

.mode-card {
  text-align: left;
  padding: 18px 18px 16px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--secondary-bg-gradient);
  box-shadow: var(--shadow-light);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  color: var(--text-white);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-primary);
    border-color: rgba(224, 103, 154, 0.38);
  }

  &.is-active {
    border-color: rgba(224, 103, 154, 0.55);
    box-shadow: var(--shadow-primary);

    .mode-card__icon {
      background: var(--color-primary-gradient);
    }

    .mode-card__glyph {
      color: #fff;
    }
  }

}

.mode-card__top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

/* The box and the glyph are separate elements on purpose. Nuxt Icon draws a
   glyph as a CSS mask filled with background-color: currentColor, so a box
   background set on the icon element itself repainted the glyph: inactive
   icons came out 14%-opacity pink on navy -- practically invisible. */
.mode-card__icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(224, 103, 154, 0.14);
  border: 1px solid var(--line);
}

.mode-card__glyph {
  width: 22px;
  height: 22px;
  color: var(--accent-pink, #e0679a);
}

.mode-card__title {
  font-size: 18px;
  font-weight: 700;
}

.mode-card__desc {
  color: var(--ui-text-muted);
  font-size: 14px;
  line-height: 1.4;
}

.panel {
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--secondary-bg-gradient);
  box-shadow: var(--shadow-light);
  padding: 18px;

  @media (min-width: 1024px) {
    padding: 22px;
  }
}

.panel__header {
  display: flex;
  flex-direction: column;
  gap: 14px;

  @media (min-width: 1024px) {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }
}

.panel__controls {
  display: flex;
  flex-direction: column;
  gap: 12px;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: flex-end;
  }
}

.control {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 240px;
}

.control__label {
  font-size: 13px;
  color: var(--ui-text-muted);
}

.format-select {
  width: 100%;
}

/* Same control metric as the format field beside it. From 640px the two share
   a row, and UButton's default align-self:center floated the button above the
   field's bottom edge, so it is pinned to the row's end instead. The extra
   ancestor is for specificity: UButton's own scoped rule ties with a bare
   `.control__btn`, and then load order decided -- against us. */
.panel .panel__controls .control__btn {
  height: var(--ui-control-h-lg, 44px);
  width: 100%;

  @media (min-width: 640px) {
    width: 180px;
    align-self: flex-end;
  }
}

.dropzone {
  margin-top: 18px;
  border-radius: 10px;
  border: 1px dashed rgba(224, 103, 154, 0.45);
  background: rgba(224, 103, 154, 0.08);
  padding: 16px;
  transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;

  &.is-dragging {
    transform: translateY(-2px);
    border-color: rgba(224, 103, 154, 0.8);
    background: rgba(224, 103, 154, 0.12);
  }
}

.dropzone__inner {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: center;

  @media (min-width: 1024px) {
    grid-template-columns: auto 1fr auto;
    gap: 18px;
  }
}

.dropzone__badge {
  width: 54px;
  height: 54px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-gradient);
  box-shadow: var(--shadow-primary);
}

.dropzone__badge-icon {
  font-size: 22px;
  color: #fff;
}

.dropzone__title {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-white);

}

/* No margin: the template's own whitespace already separates the two halves,
   and the extra 6px doubled the gap ("сюда  или"). */
.dropzone__muted {
  font-weight: 600;
  color: var(--ui-text-muted);
}

.dropzone__meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 13px;

  b {
    color: var(--text-white);

  }
}

.dropzone__actions {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-start;

  @media (min-width: 1024px) {
    justify-content: flex-end;
  }
}

.dropzone__pick {
  height: 44px;
}

/* CustomButton "link" already handles visuals; spacing only */
.dropzone__clear {
  height: 44px;
  display: inline-flex;
  align-items: center;
}

.msg {
  margin-top: 14px;
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid var(--color-border);

  &--error {
    background: rgba(255, 77, 109, 0.10);
  }

  &--ok {
    background: rgba(90, 245, 160, 0.10);
  }
}

.msg__icon {
  margin-top: 1px;
  font-size: 18px;
}

.files {
  margin-top: 16px;
}

.files__head {
  display: flex;
  flex-direction: column;
  gap: 4px;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }
}

.files__title {
  font-weight: 600;
  color: var(--text-white);

}

.files__hint {
  font-size: 13px;
  color: var(--ui-text-muted);
}

.files__list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: rgba(0, 0, 0, 0.16);

}

.file__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file__name {
  font-weight: 700;
  color: var(--text-white);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70vw;

  @media (min-width: 1024px) {
    max-width: 520px;
  }
}

.file__size {
  font-size: 12px;
  color: var(--ui-text-muted);
}

.file__remove {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--ui-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: rgba(255, 77, 109, 0.35);
    color: rgba(255, 77, 109, 0.9);
  }
}

.tips {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 1fr;
  }
}

.tip {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  color: var(--ui-text-muted);
  background: rgba(0, 0, 0, 0.10);

}

.tip__icon {
  font-size: 18px;
  margin-top: 2px;
  color: rgba(224, 103, 154, 0.95);
}
</style>
