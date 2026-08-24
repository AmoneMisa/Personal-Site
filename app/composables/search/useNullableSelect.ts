import type { Ref, WritableComputedRef } from "vue";

export const ANY_SELECT_VALUE = "__any__";

export function useNullableSelect<T extends string>(
  model: Ref<T>,
  options: { sentinel?: string; emptyValue?: T; onClear?: () => void } = {},
): WritableComputedRef<string> {
  const sentinel = options.sentinel ?? ANY_SELECT_VALUE;
  const emptyValue = options.emptyValue ?? ("" as T);

  return computed<string>({
    get: () => model.value || sentinel,
    set: (value) => {
      const cleared = value === sentinel;
      model.value = (cleared ? emptyValue : value) as T;
      if (cleared) options.onClear?.();
    },
  });
}
