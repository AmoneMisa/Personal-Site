export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n as any
  const merge = i18n?.mergeLocaleMessage?.bind(i18n)
    || i18n?.global?.mergeLocaleMessage?.bind(i18n.global)
  if (!merge) return

  merge('en', {
    jobs: {
      seniorityIntern: 'Intern',
      seniorityStaff: 'Staff',
      seniorityPrincipal: 'Principal',
    },
  })
  merge('ru', {
    jobs: {
      seniorityIntern: 'Стажёр',
      seniorityStaff: 'Staff',
      seniorityPrincipal: 'Principal',
    },
  })
})
