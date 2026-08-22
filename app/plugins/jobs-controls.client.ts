export default defineNuxtPlugin(() => {
  const SOURCE_BUTTONS = [
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'threads', label: 'Threads' },
  ] as const

  const jobsPath = () => /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?jobs\/?$/.test(window.location.pathname)

  const setSource = (value: string) => {
    const url = new URL(window.location.href)
    if (value) url.searchParams.set('source', value)
    else url.searchParams.delete('source')
    url.searchParams.delete('page')
    window.location.assign(url.toString())
  }

  const patchLabels = (root: ParentNode = document) => {
    root.querySelectorAll<HTMLElement>('[role="option"], button, [data-reka-collection-item]').forEach((node) => {
      const text = node.textContent?.trim()
      if (text === 'Название А–Я') node.textContent = 'Заголовок А–Я'
      if (text === 'Зарплата') node.textContent = 'Зарплата: больше → меньше'
      if (text === 'Salary') node.textContent = 'Salary: high → low'
    })
  }

  const ensureSources = () => {
    if (!jobsPath()) return
    const filters = document.querySelector<HTMLElement>('.jobs__filters')
    if (!filters) return

    const current = new URLSearchParams(window.location.search).get('source') || ''
    for (const option of SOURCE_BUTTONS) {
      if (filters.querySelector(`[data-extra-job-source="${option.value}"]`)) continue
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `jobs__pill${current === option.value ? ' jobs__pill_active' : ''}`
      button.dataset.extraJobSource = option.value
      button.textContent = option.label
      button.addEventListener('click', () => setSource(option.value))
      filters.appendChild(button)
    }
  }

  const ensureStyles = () => {
    if (document.getElementById('jobs-controls-hotfix')) return
    const style = document.createElement('style')
    style.id = 'jobs-controls-hotfix'
    style.textContent = `
      @media (min-width: 900px) {
        .jobs__controls {
          grid-template-columns: minmax(320px, 1fr) minmax(240px, 300px) 200px !important;
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
    patchLabels()
  }

  let observer: MutationObserver | undefined
  onNuxtReady(() => {
    apply()
    observer = new MutationObserver(() => apply())
    observer.observe(document.body, { childList: true, subtree: true })
  })

  window.addEventListener('popstate', apply)
})
