import {computed, ref, type Ref} from "vue";
import type {DockerResolveResponse} from "~/types/dockerHub";

export function useDockerResolve(
  repo: Ref<string>,
  selectedTag: Ref<string | null>,
  resetAliases: () => void,
) {
  const major = ref<number | null>(17);
  const variant = ref<string | null>("alpine");
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<DockerResolveResponse | null>(null);

  const canSearch = computed(() => repo.value.trim().length > 3 && !!major.value && major.value > 0);
  const tags = computed(() => result.value?.fallbacks ?? []);

  function reset() {
    result.value = null;
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
      result.value = await $fetch<DockerResolveResponse>("/api/dockerhub/tags/resolve", {
        params: {
          repo: repo.value.trim(),
          major: major.value,
          ...(variant.value ? {variant: variant.value} : {}),
        },
      });
      selectedTag.value = result.value.best_tag ?? null;
    } catch (caught: any) {
      error.value = caught?.data?.message || caught?.message || "Fetch failed";
    } finally {
      loading.value = false;
    }
  }

  function choose(tag: string) {
    selectedTag.value = tag;
    resetAliases();
  }

  return {major, variant, loading, error, result, canSearch, tags, reset, run, choose};
}
