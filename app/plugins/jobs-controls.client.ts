export default defineNuxtPlugin((nuxtApp) => {
  const i18n = (nuxtApp as any).$i18n
  i18n?.mergeLocaleMessage?.('ru', {
    jobs: {
      sortTitle: 'Заголовок А–Я',
      sortSalary: 'Зарплата: больше → меньше',
    },
  })
  i18n?.mergeLocaleMessage?.('en', {
    jobs: {
      sortTitle: 'Title A–Z',
      sortSalary: 'Salary: high → low',
    },
  })

  const jobsPath = () => /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?jobs\/?$/.test(window.location.pathname)

  const ensureStyles = () => {
    if (document.getElementById('jobs-controls-hotfix')) return
    const style = document.createElement('style')
    style.id = 'jobs-controls-hotfix'
    style.textContent = `
      @media (min-width: 900px) {
        .jobs__controls {
          grid-template-columns: minmax(420px, 760px) 280px 220px !important;
          justify-content: start;
          align-items: start;
        }
        .jobs__controls > :nth-child(1),
        .jobs__controls > :nth-child(2),
        .jobs__controls > :nth-child(3) {
          min-width: 0;
        }
      }
    `
    document.head.appendChild(style)
  }

  const apply = () => {
    if (!jobsPath()) return
    ensureStyles()
  }

  onNuxtReady(apply)
  window.addEventListener('popstate', apply)
})
