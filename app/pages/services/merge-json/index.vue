<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import CustomButton from "~/components/common/CustomButton.vue";
import FileInput from "~/components/common/FileInput.vue";
import CustomCheckbox from "~/components/common/CustomCheckbox.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import AddKeyModal from "~/components/mergeJson/AddKeyModal.vue";
import MonacoJsonView from "~/components/mergeJson/MonacoJsonView.client.vue";
import {useMergeJsonState} from "~/composables/mergeJson/useMergeJsonState";

const {t} = useI18n();

useSeoMeta({
  title: () => t('seo.pages.mergeJson.title'),
  description: () => t('seo.pages.mergeJson.description'),
  robots: () => t('seo.common.robots'),
  ogType: "website",
  ogSiteName: () => t('seo.common.siteName'),
  ogTitle: () => t('seo.pages.mergeJson.ogTitle'),
  ogDescription: () => t('seo.pages.mergeJson.ogDescription')
});
const ui = proxyRefs(useMergeJsonState());

const viewModeItems = computed(() => [
  {label: t("services.mergeJson.viewModes.json"), value: "json"},
  {label: t("services.mergeJson.viewModes.flat"), value: "flat"},
]);

const monacoMode = computed(() => (ui.viewMode === "flat" ? "flat" : "json"));

function onDownload() {
  ui.download({filename: t("services.mergeJson.download.filename")});
}
</script>

<template>
  <u-container class="merge">
    <div class="merge__header background-hero text-center space-y-3">
      <page-header
          title="services.mergeJson.title"
          headline="services.mergeJson.headline"
          description="services.mergeJson.subtitle"
          class="mb-6"
          :is-centered="true"
      />
    </div>

    <section class="merge__card">
      <div class="merge__toolbar">
        <div class="merge__toolbar-row">
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
        <div class="merge__toolbar-row">
          <u-select
              v-model="ui.viewMode"
              class="merge__select"
              :items="viewModeItems"
              :title="t('services.mergeJson.titles.viewMode')"
          />

          <custom-checkbox
              v-model="ui.minify"
              :label-key="'services.mergeJson.controls.minify'"
              :title="t('services.mergeJson.titles.minify')"
              @update:modelValue="ui.onMinifyToggle"
          />

          <custom-button
              variant="ghost"
              :_class="'merge__btn'"
              :disabled="!ui.canFix"
              @click="ui.fixCurrent"
              :title="t('services.mergeJson.titles.fixJson')"
          >
            {{ t("services.mergeJson.actions.fixJson") }}
          </custom-button>
        </div>

        <div class="merge__group">
          <div class="merge__group-label">{{ t("services.mergeJson.controls.truth") }}</div>
          <div class="merge__group-row">
            <custom-button
                variant="secondary"
                :_class="`merge__chip ${ui.truth === 'A' ? 'merge__chip_active' : ''}`"
                @click="ui.takeAllFrom('A')"
                :title="t('services.mergeJson.titles.truthA')"
            >
              {{ t("services.mergeJson.controls.truthA") }}
            </custom-button>

            <custom-button
                variant="secondary"
                :_class="`merge__chip ${ui.truth === 'B' ? 'merge__chip_active' : ''}`"
                @click="ui.takeAllFrom('B')"
                :title="t('services.mergeJson.titles.truthB')"
            >
              {{ t("services.mergeJson.controls.truthB") }}
            </custom-button>
          </div>
        </div>

        <div class="merge__group">
          <div class="merge__group-label">{{ t("services.mergeJson.controls.sort") }}</div>
          <div class="merge__group-row">
            <custom-button
                variant="ghost"
                :_class="`merge__chip ${ui.sortMode === 'asc' ? 'merge__chip_active' : ''}`"
                @click="ui.setSort('asc')"
                :title="t('services.mergeJson.titles.sortAsc')"
            >
              {{ t("services.mergeJson.controls.sortAsc") }}
            </custom-button>

            <custom-button
                variant="ghost"
                :_class="`merge__chip ${ui.sortMode === 'desc' ? 'merge__chip_active' : ''}`"
                @click="ui.setSort('desc')"
                :title="t('services.mergeJson.titles.sortDesc')"
            >
              {{ t("services.mergeJson.controls.sortDesc") }}
            </custom-button>
          </div>
        </div>

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
            {{ ui.matchesCount ? `${ui.matchIndex + 1}/${ui.matchesCount}` : `0` }}
          </div>
        </div>
        <div class="merge__spacer"/>

        <custom-button
            variant="secondary"
            :_class="'merge__btn'"
            :disabled="!ui.selectedKey"
            @click="ui.useA"
            :title="t('services.mergeJson.titles.useA')"
        >
          {{ t("services.mergeJson.row.useA") }}
        </custom-button>

        <custom-button
            variant="secondary"
            :_class="'merge__btn'"
            :disabled="!ui.selectedKey"
            @click="ui.useB"
            :title="t('services.mergeJson.titles.useB')"
        >
          {{ t("services.mergeJson.row.useB") }}
        </custom-button>

        <custom-button
            variant="ghost"
            :_class="'merge__btn'"
            :disabled="!ui.selectedKey"
            @click="ui.resetSelected"
            :title="t('services.mergeJson.titles.reset')"
        >
          {{ t("services.mergeJson.row.reset") }}
        </custom-button>

        <custom-button
            variant="ghost"
            :_class="'merge__btn'"
            @click="ui.showAddKey = true"
            :title="t('services.mergeJson.titles.addKey')"
        >
          {{ t("services.mergeJson.actions.addKey") }}
        </custom-button>

        <custom-button
            variant="ghost"
            :_class="'merge__btn'"
            :disabled="!ui.canRename"
            @click="ui.openRename"
            :title="t('services.mergeJson.titles.rename')"
        >
          {{ t("services.mergeJson.actions.rename") }}
        </custom-button>

        <custom-button
            variant="ghost"
            :_class="'merge__btn'"
            :disabled="!ui.canDeleteBlock"
            @click="ui.openDeleteBlock"
            :title="t('services.mergeJson.titles.deleteBlock')"
        >
          {{ t("services.mergeJson.actions.deleteBlock") }}
        </custom-button>
        <custom-button
            variant="ghost"
            :_class="'merge__btn'"
            :disabled="!ui.resultTextJson.trim()"
            @click="ui.validateResult"
            :title="t('services.mergeJson.titles.validate')"
        >
          {{ t("services.mergeJson.actions.validate") }}
        </custom-button>

        <custom-button
            variant="primary"
            :_class="'merge__btn'"
            :disabled="!ui.canDownload"
            @click="onDownload"
            :title="t('services.mergeJson.titles.download')"
        >
          {{ t("services.mergeJson.actions.download") }}
        </custom-button>
      </div>

      <div class="merge__triple">
        <div class="merge__pane">
          <div class="merge__pane-head">
            <div class="merge__pane-title">{{ t("services.mergeJson.table.colA") }}</div>
            <div class="merge__pane-sub" v-if="ui.selectedKey">
              <span class="merge__sel">{{ ui.selectedKey }}</span>
            </div>
          </div>

          <div class="merge__pane-body">
            <ClientOnly>
              <monaco-json-view
                  :mode="monacoMode"
                  :text="ui.viewTextA"
                  :selected-key="ui.selectedKey"
                  :hidden-keys="ui.hiddenKeysA"
                  :decorations="ui.decorationsA"
                  :reveal-path="ui.revealKey"
                  @nav="ui.jumpToMatch"
                  readonly
                  @select="ui.selectKey"
              />
            </ClientOnly>
          </div>
        </div>

        <div class="merge__pane merge__pane_center">
          <div class="merge__pane-head">
            <div class="merge__pane-title">{{ t("services.mergeJson.table.colResult") }}</div>
            <div class="merge__pane-sub" v-if="ui.selectedKey">
              <span class="merge__sel">{{ ui.selectedKey }}</span>
            </div>
          </div>

          <div class="merge__pane-body">
            <ClientOnly>
              <monaco-json-view
                  :mode="monacoMode"
                  :model-value="ui.viewMode === 'flat' ? ui.resultTextFlat : ui.resultTextJson"
                  :selected-key="ui.selectedKey"
                  :hidden-keys="ui.hiddenKeysR"
                  :decorations="ui.decorationsR"
                  :reveal-path="ui.revealKey"
                  @nav="ui.jumpToMatch"
                  :readonly="false"
                  @update:modelValue="
                  (v) => (ui.viewMode === 'flat' ? ui.onResultFlatChange(v) : ui.onResultJsonChange(v))
                "
                  @select="ui.selectKey"
              />
            </ClientOnly>

            <div v-if="ui.errorR" class="merge__err">{{ ui.errorR }}</div>
          </div>
        </div>

        <div class="merge__pane">
          <div class="merge__pane-head">
            <div class="merge__pane-title">{{ t("services.mergeJson.table.colB") }}</div>
            <div class="merge__pane-sub" v-if="ui.selectedKey">
              <span class="merge__sel">{{ ui.selectedKey }}</span>
            </div>
          </div>

          <div class="merge__pane-body">
            <ClientOnly>
              <monaco-json-view
                  :mode="monacoMode"
                  :text="ui.viewTextB"
                  :selected-key="ui.selectedKey"
                  :hidden-keys="ui.hiddenKeysB"
                  :decorations="ui.decorationsB"
                  :reveal-path="ui.revealKey"
                  @nav="ui.jumpToMatch"
                  readonly
                  @select="ui.selectKey"
              />
            </ClientOnly>
          </div>
        </div>
      </div>
    </section>

    <add-key-modal v-model="ui.showAddKey" @submit="ui.onAddKey"/>
    <component
        v-if="ui.modal.component"
        :is="ui.modal.component"
        :model-value="ui.modal.open"
        v-bind="ui.modal.props"
        @update:modelValue="(v) => (v ? (ui.modal.open = true) : ui.closeModal())"
        @close="ui.closeModal"
        @confirm="(payload) => { ui.modal.onConfirm(payload); ui.closeModal(); }"
    />

  </u-container>
</template>

<style scoped>
.merge {
  padding-top: 24px;
  padding-bottom: 96px;
}

.merge__subtitle {
  max-width: 760px;
  font-size: 14px;
}

.merge__card {
  margin-top: 18px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.merge__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
}

.merge__toolbar-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  width: -webkit-fill-available;
}

.merge__spacer {
  flex: 1 1 auto;
}

.merge__btn {
  height: 34px;
}

.merge__select {
  min-width: 160px;
}

.merge__chip {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
}

.merge__chip_active {
  background-color: var(--color-primary);
}

.merge__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
}

.merge__group-label {
  font-weight: 900;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.merge__group-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.merge__search {
  min-width: 240px;
}

.merge__triple {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 12px;
  min-width: 0;
}

.merge__pane {
  border-radius: 16px;
  border: 1px solid var(--ui-border);
  background: rgba(0, 0, 0, 0.12);
  padding: 10px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.merge__pane_center {
  box-shadow: 0 0 0 1px rgba(128, 90, 245, 0.18) inset;
}

.merge__pane-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.merge__pane-title {
  font-weight: 900;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.merge__pane-sub {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.75;
  min-width: 0;
}

.merge__sel {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.merge__pane-body {
  min-height: 420px;
  height: 420px;
}

.merge__err {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 900;
  color: var(--color-error);
  opacity: 0.95;
}

@media (max-width: 1100px) {
  .merge__triple {
    grid-template-columns: 1fr;
  }

  .merge__pane-body {
    min-height: 360px;
    height: 360px;
  }

  .merge__search {
    min-width: 180px;
  }
}

.merge__search-wrap {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.merge__matches {
  font-size: 12px;
  font-weight: 900;
  opacity: .75;
  padding-bottom: 6px;
}

</style>
