// The site is dark-only. colorMode.preference in nuxt.config only sets the
// DEFAULT — a value stored from the old theme toggle (e.g. "light" in
// localStorage) still wins. Force dark here so returning visitors who once
// switched to light are corrected, and the stored value is overwritten to dark.
export default defineNuxtPlugin(() => {
  const colorMode = useColorMode();
  if (colorMode.preference !== "dark") colorMode.preference = "dark";
  if (colorMode.value !== "dark") colorMode.value = "dark";
});
