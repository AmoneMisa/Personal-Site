import {computed, ref, type Ref} from "vue";
import type {DockerSimpleSearchItem, DockerSimpleSort} from "~/types/dockerHub";

export function useDockerSimpleSearch(
  repo: Ref<string>,
  selectedTag: Ref<string | null>,
  resetAliases: () => void,
) {
  const query = ref("");
  const sort = ref<DockerSimpleSort>("len_asc");
  const loading = ref(false);
  const error = ref<string | null>(null);
  const results = ref<DockerSimpleSearchItem[]>([]);

  const canSearch = computed(() => repo.value.trim().length > 3 && query.value.trim().length > 1);
  const sortedResults = computed(() => [...results.value].sort((left, right) => {
    const lengthDifference = left.tag.length - right.tag.length;
    if (lengthDifference) return sort.value === "len_asc" ? lengthDifference : -lengthDifference;
    return left.tag.localeCompare(right.tag);
  }));

  function reset() {
    query.value = "";
    results.value = [];
    error.value = null;
    selectedTag.value = null;
    resetAliases();
  }

  async function run() {
    if (!canSearch.value) return;
    loading.value = true;
    error.value = null;
    resetAliases();
    try {
      const data = await $fetch<DockerSimpleSearchItem[]>("/api/dockerhub/tags/search", {
        params: {repo: repo.value.trim(), q: query.value.trim()},
      });
      results.value = Array.isArray(data) ? data : [];
      selectedTag.value = results.value[0]?.tag ?? null;
    } catch (caught: any) {
      error.value = caught?.data?.message || caught?.message || "Fetch failed";
      results.value = [];
      selectedTag.value = null;
    } finally {
      loading.value = false;
    }
  }

  function choose(tag: string) {
    selectedTag.value = tag;
    resetAliases();
  }

  return {query, sort, loading, error, results, sortedResults, canSearch, reset, run, choose};
}
