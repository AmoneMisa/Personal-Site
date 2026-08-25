import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceExact = (source, from, to, label) => {
  if (!source.includes(from)) throw new Error(`Missing expected ${label}`);
  return source.replace(from, to);
};

write('app/components/search/SearchResultGrid.vue', `<script setup lang="ts">
withDefaults(defineProps<{
  dense?: boolean;
  equalRows?: boolean;
}>(), {
  dense: false,
  equalRows: false,
});
</script>

<template>
  <div
    class="search-result-grid"
    :class="{
      'search-result-grid_dense': dense,
      'search-result-grid_equal': equalRows,
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.search-result-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: stretch;
}
.search-result-grid_equal { grid-auto-rows: 1fr; }
@media (min-width: 640px) {
  .search-result-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .search-result-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1180px) {
  .search-result-grid_dense { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (min-width: 1440px) {
  .search-result-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
`);

let jobs = read('app/pages/jobs/index.vue');
jobs = replaceExact(jobs,
  'import JobGrid from "~/components/jobs/JobGrid.vue";\n',
  'import SearchResultGrid from "~/components/search/SearchResultGrid.vue";\n',
  'jobs grid import',
);
jobs = replaceExact(jobs, `    <JobGrid :items="scored">
      <template #default="{ job, ats }">
      <JobCard
          :key="job.id"
          :job="job"
          :ats="ats"
          :seen="isSeen(job.id)"
          :favorite="isFavorite(job.id)"
          :hidden="isHidden(job.id)"
          :share-copied="shareCopiedJobId === job.id"
          :salary="formatSalary(job)"
          :converted-salary="convertedSalary(job)"
          @open="openJob"
          @share="shareJob"
          @seen="markSeen"
          @favorite="toggleFavorite"
          @hidden="toggleHidden"
      />
      </template>
    </JobGrid>`, `    <SearchResultGrid class="jobs__grid">
      <JobCard
          v-for="{ job, ats } in scored"
          :key="job.id"
          :job="job"
          :ats="ats"
          :seen="isSeen(job.id)"
          :favorite="isFavorite(job.id)"
          :hidden="isHidden(job.id)"
          :share-copied="shareCopiedJobId === job.id"
          :salary="formatSalary(job)"
          :converted-salary="convertedSalary(job)"
          @open="openJob"
          @share="shareJob"
          @seen="markSeen"
          @favorite="toggleFavorite"
          @hidden="toggleHidden"
      />
    </SearchResultGrid>`, 'jobs grid template');
jobs = replaceExact(jobs,
  '.jobs__filter-blocks { grid-column: 1 / -1; }',
  `.jobs__filter-blocks { grid-column: 1 / -1; }
.jobs__grid :deep(.job-card) { height: 100%; min-height: 0; }
.jobs__grid :deep(.job-card__footer) { margin-top: 12px; padding-top: 0; }
.jobs__grid :deep(.job-card__salary-separator) { display: none; }`,
  'jobs grid card styles',
);
write('app/pages/jobs/index.vue', jobs);

let hiring = read('app/pages/hiring/index.vue');
hiring = replaceExact(hiring,
  'import CandidateGrid from "~/components/hiring/CandidateGrid.vue";\n',
  'import SearchResultGrid from "~/components/search/SearchResultGrid.vue";\n',
  'hiring grid import',
);
hiring = replaceExact(hiring, `    <CandidateGrid :profiles="displayedProfiles" :dense="denseGrid">
      <template #default="{ profile }">
      <CandidateCard
        :key="profile.id"
        :profile="profile"
        :favorite="isFavorite(profile.id)"
        :hidden="isHidden(profile.id)"
        :rates="usdRates"
        :country-currency="profileCountryCurrency(profile)"
        :match-filters="candidateMatchFilters"
        @open="openCv(profile)"
        @toggle-favorite="toggleFavorite(profile)"
        @toggle-hidden="toggleHidden(profile)"
      />
      </template>
    </CandidateGrid>`, `    <SearchResultGrid :dense="denseGrid" equal-rows>
      <CandidateCard
        v-for="profile in displayedProfiles"
        :key="profile.id"
        :profile="profile"
        :favorite="isFavorite(profile.id)"
        :hidden="isHidden(profile.id)"
        :rates="usdRates"
        :country-currency="profileCountryCurrency(profile)"
        :match-filters="candidateMatchFilters"
        @open="openCv(profile)"
        @toggle-favorite="toggleFavorite(profile)"
        @toggle-hidden="toggleHidden(profile)"
      />
    </SearchResultGrid>`, 'hiring grid template');
write('app/pages/hiring/index.vue', hiring);

let flats = read('app/pages/flat-finder/index.vue');
flats = replaceExact(flats,
  'import FlatGrid from "~/components/flats/FlatGrid.vue";\n',
  'import SearchResultGrid from "~/components/search/SearchResultGrid.vue";\n',
  'flat grid import',
);
flats = replaceExact(flats, `    <FlatGrid :listings="displayedListings">
      <template #default="{ listing: l }">
      <FlatCard
        :key="listingKey(l)"
        :listing="l"
        :photo="listingPhoto(l)"
        :presentation="presentCard(l)"
        :favorite="isFavorite(l.id)"
        :hidden="isHidden(l.id)"
        :checking="checkingListingKey === listingKey(l)"
        :no-photo-label="t('noPhoto')"
        :checking-label="t('checkingListing')"
        :favorite-label="isFavorite(l.id) ? t('removeFavorite') : t('addFavorite')"
        :hide-label="isHidden(l.id) ? t('restoreListing') : t('hideListing')"
        @open="openListing(l)"
        @toggle-favorite="toggleFavorite(l)"
        @toggle-hidden="toggleHidden(l)"
        @photo-error="markPhotoFailedFromEvent"
      />
      </template>
    </FlatGrid>`, `    <SearchResultGrid>
      <FlatCard
        v-for="l in displayedListings"
        :key="listingKey(l)"
        :listing="l"
        :photo="listingPhoto(l)"
        :presentation="presentCard(l)"
        :favorite="isFavorite(l.id)"
        :hidden="isHidden(l.id)"
        :checking="checkingListingKey === listingKey(l)"
        :no-photo-label="t('noPhoto')"
        :checking-label="t('checkingListing')"
        :favorite-label="isFavorite(l.id) ? t('removeFavorite') : t('addFavorite')"
        :hide-label="isHidden(l.id) ? t('restoreListing') : t('hideListing')"
        @open="openListing(l)"
        @toggle-favorite="toggleFavorite(l)"
        @toggle-hidden="toggleHidden(l)"
        @photo-error="markPhotoFailedFromEvent"
      />
    </SearchResultGrid>`, 'flat grid template');
write('app/pages/flat-finder/index.vue', flats);

for (const path of [
  'app/components/jobs/JobGrid.vue',
  'app/components/hiring/CandidateGrid.vue',
  'app/components/flats/FlatGrid.vue',
]) fs.rmSync(path);

write('tests/search-component-dedup.test.mjs', `import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pages = [
  'app/pages/flat-finder/index.vue',
  'app/pages/jobs/index.vue',
  'app/pages/hiring/index.vue',
];

test('all three search boards share the result grid component', () => {
  for (const path of pages) {
    const source = read(path);
    assert.match(source, /SearchResultGrid/u, path);
  }
});

test('page-specific grid wrappers stay removed', () => {
  for (const path of [
    'app/components/jobs/JobGrid.vue',
    'app/components/hiring/CandidateGrid.vue',
    'app/components/flats/FlatGrid.vue',
  ]) assert.equal(existsSync(new URL('../' + path, import.meta.url)), false, path);
});
`);
