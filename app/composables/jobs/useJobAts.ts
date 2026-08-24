import { computed, ref, type Ref } from "vue";
import { buildCvProfile, scoreJob, type CvProfile } from "~/utils/atsScore";
import { extractCvText } from "~/utils/cvExtract";
import type { Job } from "~/types/jobs";

interface JobAtsOptions {
  jobs: Ref<Job[]>;
  displayedJobs: Ref<Job[]>;
  activeJob: Ref<Job | null>;
  total: Ref<number>;
  pageSize: Ref<number>;
  sort: Ref<string>;
  reload: () => Promise<unknown>;
  translate: (key: string) => string;
}

export function useJobAts(options: JobAtsOptions) {
  const cvProfile = ref<CvProfile | null>(null);
  const cvPaste = ref("");
  const cvError = ref<string | null>(null);
  const cvLoading = ref(false);

  const scored = computed(() => {
    const profile = cvProfile.value;
    const list = options.displayedJobs.value.map((job) => ({
      job,
      ats: profile ? scoreJob(profile, job) : null,
    }));
    if (profile && options.sort.value === "ats") {
      list.sort((left, right) => (right.ats?.score ?? 0) - (left.ats?.score ?? 0));
    }
    return list;
  });

  const activeAts = computed(() => (
    cvProfile.value && options.activeJob.value
      ? scoreJob(cvProfile.value, options.activeJob.value)
      : null
  ));

  async function onCvFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    cvError.value = null;
    cvLoading.value = true;
    try {
      const text = await extractCvText(file);
      cvPaste.value = text;
      cvProfile.value = buildCvProfile(text);
      if (!options.jobs.value.length || options.total.value > options.pageSize.value) await options.reload();
    } catch (error: unknown) {
      cvError.value = error instanceof Error ? error.message : options.translate("atsReadError");
    } finally {
      cvLoading.value = false;
    }
  }

  function applyPastedCv() {
    if (cvPaste.value.trim().length < 30) {
      cvError.value = options.translate("atsPasteTooShort");
      return;
    }
    cvError.value = null;
    cvProfile.value = buildCvProfile(cvPaste.value);
  }

  function clearCv() {
    cvProfile.value = null;
    cvPaste.value = "";
    cvError.value = null;
    if (options.sort.value === "ats") options.sort.value = "date";
  }

  return { cvProfile, cvPaste, cvError, cvLoading, scored, activeAts, onCvFile, applyPastedCv, clearCv };
}
