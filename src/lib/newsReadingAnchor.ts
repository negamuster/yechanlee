export interface NewsReadingAnchor { key: string; top: number }

export function captureNewsAnchor(root: HTMLElement | null): NewsReadingAnchor | null {
  if (!root) return null
  const header = document.querySelector('.site-header')?.getBoundingClientRect()
  const top = header && header.top <= 0 ? Math.max(0, header.bottom) + 8 : 8
  for (const article of root.querySelectorAll<HTMLElement>('[data-reading-key]')) {
    const rect = article.getBoundingClientRect()
    if (rect.height > 0 && rect.bottom > top && rect.top < window.innerHeight) return { key: article.dataset.readingKey!, top: rect.top }
  }
  return null
}

export function restoreNewsAnchor(root: HTMLElement | null, anchor: NewsReadingAnchor) {
  if (!root) return
  const article = [...root.querySelectorAll<HTMLElement>('[data-reading-key]')].find(element => element.dataset.readingKey === anchor.key)
  if (!article) return
  const delta = article.getBoundingClientRect().top - anchor.top
  if (Number.isFinite(delta) && Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' })
}
