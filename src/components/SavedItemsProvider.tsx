import { saveThesis } from '../lib/thesis'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { Toaster, toast } from 'sonner'
import { SAVED_KEY, LEGACY_SAVED_KEY, articleKey, emptySaved, readSaved, updateSaved, mergeSaved, removeSaved, removedItems, restoreRemoved } from '../lib/savedItems'
import type { SavedItems, SavedStock, SavedArticle } from '../lib/savedItems'
import './SavedItems.css'
interface SavedContext { saveNote: (input: Parameters<typeof saveThesis>[1]) => string; removeSelected: (kind: 'stocks' | 'articles', ids: string[]) => boolean; mergeBackup: (imported: SavedItems) => void; items: SavedItems; toggleStock: (stock: SavedStock) => void; toggleArticle: (article: SavedArticle) => boolean }
type Deletion = { before: SavedItems; removed: SavedItems; expires: number }
const Context = createContext<SavedContext | null>(null)
export function useSavedItems() { const value = useContext(Context); if (!value) throw new Error('SavedItemsProvider missing'); return value }
export default function SavedItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SavedItems>(() => { try { return readSaved(localStorage) } catch { return emptySaved() } })
  const [message, setMessage] = useState('')
  const [undo, setUndo] = useState<Deletion | null>(null)
  const undoDeletion = useCallback((deletion: Deletion) => {
    if (Date.now() > deletion.expires) { setUndo(null); return }
    try { setItems(updateSaved(localStorage, current => restoreRemoved(current, deletion.before, deletion.removed))); setUndo(null); setMessage('') }
    catch { setMessage('복원하지 못했습니다. 저장 공간과 항목 한도를 확인해 주세요.') }
  }, [])
  useEffect(() => {
    if (!undo) return
    toast(`최근 삭제 ${undo.removed.stocks.length + undo.removed.articles.length}개 · 30초간 복원 가능`, {
      id: 'saved-deletion', duration: Math.max(0, undo.expires - Date.now()),
      action: { label: '실행 취소', onClick: () => undoDeletion(undo) },
    })
    const timer = window.setTimeout(() => setUndo(null), Math.max(0, undo.expires - Date.now()))
    return () => { window.clearTimeout(timer); toast.dismiss('saved-deletion') }
  }, [undo, undoDeletion])
  useEffect(() => () => { toast.dismiss('article-save') }, [])
  useEffect(() => {
    function read() { try { setItems(readSaved(localStorage)) } catch { setMessage('저장 목록을 읽을 수 없습니다. 브라우저 저장 설정을 확인해 주세요.') } }
    read()
    function sync(event: StorageEvent) { if (event.key === SAVED_KEY || event.key === LEGACY_SAVED_KEY || event.key === null) read() }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  function change(transform: (value: SavedItems) => SavedItems, trackRemoval = true) {
    try {
      let before = emptySaved(), removed = emptySaved()
      const next = updateSaved(localStorage, value => { before = value; const after = transform(value); removed = removedItems(value, after); return after })
      setItems(next); setMessage('')
      if (trackRemoval && (removed.stocks.length || removed.articles.length)) setUndo({ before, removed, expires: Date.now() + 30000 })
      return true
    }
    catch { toast.dismiss('article-save'); setMessage('변경 사항을 저장하지 못했습니다. 브라우저 저장 공간·설정 또는 저장 한도를 확인해 주세요.'); return false }
  }
  function removeSelected(kind: 'stocks' | 'articles', ids: string[]) {
    return change(value => removeSaved(value, kind, ids))
  }
  function toggleStock(stock: SavedStock) { change(value => ({ ...value, stocks: value.stocks.some(row => row.ticker === stock.ticker) ? value.stocks.filter(row => row.ticker !== stock.ticker) : [stock, ...value.stocks] })) }
  function toggleArticle(article: SavedArticle) {
    const key = articleKey(article.article_url)
    let before = emptySaved(), removed = emptySaved(), wasSaved = false
    const success = change(value => {
      before = value
      wasSaved = value.articles.some(row => row.article_url === key)
      const next = { ...value, articles: wasSaved ? value.articles.filter(row => row.article_url !== key) : [article, ...value.articles] }
      removed = removedItems(value, next)
      return next
    }, false)
    if (success) toast(wasSaved ? '기사 저장을 해제했습니다.' : '기사를 저장했습니다.', {
      id: 'article-save', duration: 6000,
      action: { label: '실행 취소', onClick: () => { change(current => wasSaved ? restoreRemoved(current, before, removed) : removeSaved(current, 'articles', [key]), false) } },
    })
    return success
  }
  function saveNote(input: Parameters<typeof saveThesis>[1]) {
    const next = updateSaved(localStorage, current => ({ ...current, theses: saveThesis(current.theses || [], input, crypto.randomUUID(), new Date().toISOString()) }))
    setItems(next); setMessage(''); return next.theses!.find(n => n.ticker === input.ticker)!.revision
  }
  function mergeBackup(imported: SavedItems) {
    const next = updateSaved(localStorage, current => mergeSaved(current, imported))
    setItems(next); setMessage('')
  }
  return <Context.Provider value={{ saveNote, removeSelected, items, toggleStock, toggleArticle, mergeBackup }}>{children}
    <Toaster position="bottom-right" theme="light" className="anthracite-toaster" closeButton expand visibleToasts={3}
      offset={{ bottom: 'calc(var(--mobile-nav-clearance, 18px) + 8px)', right: '18px' }}
      mobileOffset={{ bottom: 'calc(var(--mobile-nav-clearance, 18px) + 8px)', left: '14px', right: '14px' }}
      containerAriaLabel="저장 알림" toastOptions={{ className: 'anthracite-toast', closeButtonAriaLabel: '알림 닫기' }} />
    {message && <div className="saved-error" role="alert">{message}<button type="button" onClick={() => setMessage('')} aria-label="저장 오류 알림 닫기">닫기</button></div>}
  </Context.Provider>
}
export function WatchButton({ ticker, name = ticker }: SavedStock | { ticker: string; name?: string }) {
  const { items, toggleStock } = useSavedItems()
  const saved = items.stocks.some(row => row.ticker === ticker)
  return <button type="button" className="save-button" aria-pressed={saved} aria-label={`${ticker} 관심 종목 ${saved ? '해제' : '저장'}`} onClick={() => toggleStock({ ticker, name })}><span aria-hidden="true">{saved ? '★' : '☆'}</span> {saved ? '관심 종목' : '관심 저장'}</button>
}
export function BookmarkButton({ article, iconOnly = false }: { article: SavedArticle; iconOnly?: boolean }) {
  const { items, toggleArticle } = useSavedItems()
  const animation = useAnimationControls()
  const reduced = useReducedMotion()
  const saved = items.articles.some(row => row.article_url === articleKey(article.article_url))
  return <motion.button type="button" className={`save-button${iconOnly ? ' save-button-icon' : ''}`} aria-pressed={saved}
    aria-label={`${article.title} 북마크 ${saved ? '해제' : '저장'}`} title={iconOnly ? saved ? '북마크 해제' : '기사 저장' : undefined}
    initial={false} animate={animation} onClick={() => {
      if (toggleArticle(article) && !reduced) void animation.start({ scale: [1, 0.9, 1], transition: { duration: 0.18 } })
    }}>
    {iconOnly ? <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z" /></svg> : saved ? '✓ 저장됨' : '+ 기사 저장'}
  </motion.button>
}

