export default defineNuxtPlugin((nuxtApp) => {
  const SOURCE_BUTTONS = [
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'threads', label: 'Threads' },
  ] as const

  // Keep the actual page component untouched here: this is a small client-only
  // compatibility layer for the existing jobs toolbar. The page already restores
  // `source` from the URL, so these pills participate in the same search state.
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

  const setSource = (value: string) => {
    const url = new URL(window.location.href)
    if (value) url.searchParams.set('source', value)
    else url.searchParams.delete('source')
    url.searchParams.delete('page')
    window.location.assign(url.toString())
  }

  const ensureSources = () => {
    if (!jobsPath()) return
    const filters = document.querySelector<HTMLElement>('.jobs__filters')
    if (!filters) return

    const current = new URLSearchParams(window.location.search).get('source') || ''
    const nativePill = filters.querySelector<HTMLButtonElement>('button.jobs__pill:not([data-extra-job-source])')

    for (const option of SOURCE_BUTTONS) {
      let button = filters.querySelector<HTMLButtonElement>(`[data-extra-job-source="${option.value}"]`)
      if (!button) {
        // jobs/index.vue uses scoped styles. A button created from scratch does not
        // receive Vue's generated scope attribute, so it renders as plain text.
        // Clone a native source pill to inherit that attribute and the exact same
        // desktop/mobile styling, then attach our own source behaviour.
        button = nativePill
          ? nativePill.cloneNode(false) as HTMLButtonElement
          : document.createElement('button')
        button.type = 'button'
        button.className = 'jobs__pill'
        button.dataset.extraJobSource = option.value
        button.textContent = option.label
        button.addEventListener('click', () => setSource(option.value))
        filters.appendChild(button)
      }
      button.classList.toggle('jobs__pill_active', current === option.value)
    }
  }

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
    ensureSources()
  }

  let observer: MutationObserver | undefined
  onNuxtReady(() => {
    apply()
    observer = new MutationObserver(() => apply())
    observer.observe(document.body, { childList: true, subtree: true })
  })

  window.addEventListener('popstate', apply)
})
