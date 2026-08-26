<script setup lang="ts">
import CustomButton from "~/components/common/CustomButton.vue";
import FileInput from "~/components/common/FileInput.vue";
import CustomCheckbox from "~/components/common/CustomCheckbox.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import type {MergeJsonUi} from "~/composables/mergeJson/useMergeJsonState";

const props = defineProps<{ui: MergeJsonUi}>();
const {t} = useI18n();

const viewModeItems = computed(() => [
  {label: t("services.mergeJson.viewModes.json"), value: "json"},
  {label: t("services.mergeJson.viewModes.flat"), value: "flat"},
]);

function onDownload() {
  props.ui.download({filename: t("services.mergeJson.download.filename")});
}
</script>

<template>
  <div class="merge__toolbar">
    <div class="merge__files">
      <file-input
          :label-key="'services.mergeJson.inputs.fileA'"
          :hint-key="'services.mergeJson.inputs.hint'"
          :error="ui.errorA"
          :max-bytes="50 * 1024 * 1024"
          :accept="ui.accept"
          @files="ui.onFilesA"
      />
      <file-input
          :label-key="'services.mergeJson.inputs.fileB'"
          :hint-key="'services.mergeJson.inputs.hint'"
          :error="ui.errorB"
          :max-bytes="50 * 1024 * 1024"
          :accept="ui.accept"
          @files="ui.onFilesB"
      />
    </div>

    <div class="merge__controlbar">
      <u-select
          v-model="ui.viewMode"
          class="merge__select ui-locale"
          :items="viewModeItems"
          :title="t('services.mergeJson.titles.viewMode')"
      />

      <custom-checkbox
          v-model="ui.minify"
          :label-key="'services.mergeJson.controls.minify'"
          :title="t('services.mergeJson.titles.minify')"
          @update:modelValue="ui.onMinifyToggle"
      />

      <custom-checkbox
          v-model="ui.onlyDiff"
          :label-key="'services.mergeJson.controls.onlyDiff'"
          :title="t('services.mergeJson.titles.onlyDiff')"
      />

      <div class="merge__search-wrap">
        <custom-input
            v-model="ui.query"
            class="merge__search"
            :label-key="'services.mergeJson.controls.search'"
            :placeholder-key="'services.mergeJson.controls.searchPh'"
            :title="t('services.mergeJson.titles.search')"
            clearable
        />
        <div v-if="ui.query.trim()" class="merge__matches">
          {{ ui.matchesCount ? `${ui.matchIndex + 1}/${ui.matchesCount}` : "0" }}
        </div>
      </div>

      <custom-button
          variant="secondary"
          :_class="'merge__btn'"
          :disabled="!ui.canFix"
          :title="t('services.mergeJson.titles.fixJson')"
          @click="ui.fixCurrent"
      >
        {{ t("services.mergeJson.actions.fixJson") }}
      </custom-button>
    </div>

    <div class="merge__options">
      <div class="merge__group">
        <div class="merge__group-label">{{ t("services.mergeJson.controls.truth") }}</div>
        <div class="merge__group-row">
          <custom-button
              variant="secondary"
              :_class="`merge__chip ${ui.truth === 'A' ? 'merge__chip_active' : ''}`"
              :title="t('services.mergeJson.titles.truthA')"
              @click="ui.takeAllFrom('A')"
          >
            {{ t("services.mergeJson.controls.truthA") }}
          </custom-button>
          <custom-button
              variant="secondary"
              :_class="`merge__chip ${ui.truth === 'B' ? 'merge__chip_active' : ''}`"
              :title="t('services.mergeJson.titles.truthB')"
              @click="ui.takeAllFrom('B')"
          >
            {{ t("services.mergeJson.controls.truthB") }}
          </custom-button>
        </div>
      </div>

      <div class="merge__group">
        <div class="merge__group-label">{{ t("services.mergeJson.controls.sort") }}</div>
        <div class="merge__group-row">
          <custom-button
              variant="secondary"
              :_class="`merge__chip ${ui.sortMode === 'asc' ? 'merge__chip_active' : ''}`"
              :title="t('services.mergeJson.titles.sortAsc')"
              @click="ui.setSort('asc')"
          >
            {{ t("services.mergeJson.controls.sortAsc") }}
          </custom-button>
          <custom-button
              variant="secondary"
              :_class="`merge__chip ${ui.sortMode === 'desc' ? 'merge__chip_active' : ''}`"
              :title="t('services.mergeJson.titles.sortDesc')"
              @click="ui.setSort('desc')"
          >
            {{ t("services.mergeJson.controls.sortDesc") }}
          </custom-button>
        </div>
      </div>

      <div class="merge__row-actions">
        <custom-button variant="secondary" :_class="'merge__btn'" :disabled="!ui.selectedKey" :title="t('services.mergeJson.titles.useA')" @click="ui.useA">
          {{ t("services.mergeJson.row.useA") }}
        </custom-button>
        <custom-button variant="secondary" :_class="'merge__btn'" :disabled="!ui.selectedKey" :title="t('services.mergeJson.titles.useB')" @click="ui.useB">
          {{ t("services.mergeJson.row.useB") }}
        </custom-button>
        <custom-button variant="ghost" :_class="'merge__btn merge__btn_ghost'" :disabled="!ui.selectedKey" :title="t('services.mergeJson.titles.reset')" @click="ui.resetSelected">
          {{ t("services.mergeJson.row.reset") }}
        </custom-button>
        <custom-button variant="ghost" :_class="'merge__btn merge__btn_ghost'" :title="t('services.mergeJson.titles.addKey')" @click="ui.showAddKey = true">
          {{ t("services.mergeJson.actions.addKey") }}
        </custom-button>
      </div>
    </div>

    <div class="merge__footer-actions">
      <div class="merge__footer-secondary">
        <custom-button variant="ghost" :_class="'merge__btn merge__btn_ghost'" :disabled="!ui.canRename" :title="t('services.mergeJson.titles.rename')" @click="ui.openRename">
          {{ t("services.mergeJson.actions.rename") }}
        </custom-button>
        <custom-button variant="ghost" :_class="'merge__btn merge__btn_ghost'" :disabled="!ui.canDeleteBlock" :title="t('services.mergeJson.titles.deleteBlock')" @click="ui.openDeleteBlock">
          {{ t("services.mergeJson.actions.deleteBlock") }}
        </custom-button>
        <custom-button variant="ghost" :_class="'merge__btn merge__btn_ghost'" :disabled="!ui.resultTextJson.trim()" :title="t('services.mergeJson.titles.validate')" @click="ui.validateResult">
          {{ t("services.mergeJson.actions.validate") }}
        </custom-button>
      </div>

      <custom-button variant="full" :_class="'merge__btn merge__download'" :disabled="!ui.canDownload" :title="t('services.mergeJson.titles.download')" @click="onDownload">
        {{ t("services.mergeJson.actions.download") }}
      </custom-button>
    </div>
  </div>
</template>

<style scoped>
.merge__toolbar {
  display: grid;
  gap: 14px;
}

.merge__files {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.merge__controlbar {
  display: grid;
  grid-template-columns: 180px auto auto minmax(220px, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.merge__options {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: stretch;
  gap: 10px;
}

.merge__group {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
}

.merge__group-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.merge__group-row,
.merge__row-actions,
.merge__footer-secondary,
.merge__footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.merge__row-actions {
  justify-content: flex-end;
  align-content: center;
}

.merge__footer-actions {
  justify-content: space-between;
  padding-top: 2px;
}

.merge__btn,
.merge__chip {
  height: 38px;
}

.merge__btn_ghost {
  padding-inline: 8px;
}

.merge__chip {
  padding: 0 12px;
  border-radius: 8px;
}

.merge__chip_active {
  border-color: var(--accent-pink) !important;
  background: rgba(224, 103, 154, 0.16) !important;
}

.merge__select {
  min-width: 0;
  width: 100%;
}

.merge__search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.merge__search {
  min-width: 0;
  width: 100%;
}

.merge__matches {
  position: absolute;
  right: 10px;
  bottom: 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.merge__download {
  min-width: 140px;
}

@media (max-width: 1100px) {
  .merge__controlbar {
    grid-template-columns: minmax(160px, 0.7fr) auto auto minmax(220px, 1.3fr);
  }

  .merge__controlbar > :last-child {
    grid-column: 1 / -1;
    justify-self: end;
  }

  .merge__options {
    grid-template-columns: 1fr 1fr;
  }

  .merge__row-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .merge__files,
  .merge__controlbar,
  .merge__options {
    grid-template-columns: 1fr;
  }

  .merge__controlbar > :last-child,
  .merge__row-actions {
    grid-column: auto;
    justify-self: stretch;
  }

  .merge__footer-actions {
    align-items: stretch;
  }

  .merge__footer-secondary,
  .merge__footer-actions {
    flex-direction: column;
  }

  .merge__footer-actions > *,
  .merge__footer-secondary > *,
  .merge__row-actions > * {
    width: 100%;
  }
}
</style>
