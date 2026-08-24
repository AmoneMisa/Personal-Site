import {ref, type Ref} from "vue";
import type {DockerAliasesResponse} from "~/types/dockerHub";

export function useDockerAliases(repo: Ref<string>) {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<DockerAliasesResponse | null>(null);

  function reset() {
    result.value = null;
    error.value = null;
  }

  async function load(tag: string) {
    loading.value = true;
    error.value = null;
    try {
      result.value = await $fetch<DockerAliasesResponse>("/api/dockerhub/tags/aliases", {
        params: {repo: repo.value.trim(), tag},
      });
    } catch (caught: any) {
      error.value = caught?.data?.message || caught?.message || "Fetch failed";
    } finally {
      loading.value = false;
    }
  }

  return {loading, error, result, reset, load};
}
