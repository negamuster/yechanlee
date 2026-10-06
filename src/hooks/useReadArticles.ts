import { useEffect, useState } from 'react'
import { READ_KEY, parseRead, markRead, readUrl } from '../lib/readArticles'
import type { ReadArticles } from '../lib/readArticles'
const UPDATE = 'anthracite:read-updated'
let memory: ReadArticles = {}
function read() { try { memory = parseRead(JSON.stringify({ ...parseRead(localStorage.getItem(READ_KEY)), ...memory })) } catch { /* Retain in-memory history when storage is blocked. */ } return memory }
export function useReadArticles() {
  const [history, setHistory] = useState(read)
  useEffect(() => {
    function sync(event: Event) { if (event instanceof StorageEvent && event.key !== READ_KEY && event.key !== null) return; try { memory = parseRead(localStorage.getItem(READ_KEY)); setHistory(memory) } catch { /* Optional storage. */ } }
    function local() { setHistory({ ...memory }) }
    window.addEventListener('storage', sync); window.addEventListener(UPDATE, local)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener(UPDATE, local) }
  }, [])
  function mark(url: string) {
    memory = markRead(read(), url)
    try { localStorage.setItem(READ_KEY, JSON.stringify(memory)) } catch { /* Reading links still works without persistent storage. */ }
    setHistory({ ...memory }); window.dispatchEvent(new Event(UPDATE))
  }
  return { isRead: (url: string) => !!history[readUrl(url)], mark }
}
