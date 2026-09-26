import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { SAVED_KEY, articleKey, emptySaved, parseSaved, updateSaved } from '../lib/savedItems'
import type { SavedItems, SavedStock, SavedArticle } from '../lib/savedItems'
import './SavedItems.css'
interface SavedContext { items: SavedItems; toggleStock: (stock: SavedStock) => void; toggleArticle: (article: SavedArticle) => void }
const Context = createContext<SavedContext | null>(null)
export function useSavedItems() { const value = useContext(Context); if (!value) throw new Error('SavedItemsProvider missing'); return value }
export default function SavedItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SavedItems>(emptySaved)
  const [message, setMessage] = useState('')
  useEffect(() => {
    function read() { try { setItems(parseSaved(localStorage.getItem(SAVED_KEY))) } catch { setMessage('저장 목록을 읽을 수 없습니다. 브라우저 저장 설정을 확인해 주세요.') } }
    read()
    function sync(event: StorageEvent) { if (event.key === SAVED_KEY || event.key === null) read() }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  function change(transform: (value: SavedItems) => SavedItems) {
    try { setItems(updateSaved(localStorage, transform)); setMessage('') }
    catch { setMessage('변경 사항을 저장하지 못했습니다. 브라우저 저장 공간·설정 또는 저장 한도를 확인해 주세요.') }
  }
  function toggleStock(stock: SavedStock) { change(value => ({ ...value, stocks: value.stocks.some(row => row.ticker === stock.ticker) ? value.stocks.filter(row => row.ticker !== stock.ticker) : [stock, ...value.stocks] })) }
  function toggleArticle(article: SavedArticle) { change(value => ({ ...value, articles: value.articles.some(row => row.article_url === articleKey(article.article_url)) ? value.articles.filter(row => row.article_url !== articleKey(article.article_url)) : [article, ...value.articles] })) }
  return <Context.Provider value={{ items, toggleStock, toggleArticle }}>{children}
    {message && <div className="saved-error" role="alert">{message}<button type="button" onClick={() => setMessage('')} aria-label="저장 오류 알림 닫기">닫기</button></div>}
  </Context.Provider>
}
export function WatchButton({ ticker, name = ticker }: SavedStock | { ticker: string; name?: string }) {
  const { items, toggleStock } = useSavedItems()
  const saved = items.stocks.some(row => row.ticker === ticker)
  return <button type="button" className="save-button" aria-pressed={saved} aria-label={`${ticker} 관심 종목 ${saved ? '해제' : '저장'}`} onClick={() => toggleStock({ ticker, name })}><span aria-hidden="true">{saved ? '★' : '☆'}</span> {saved ? '관심 종목' : '관심 저장'}</button>
}
export function BookmarkButton({ article }: { article: SavedArticle }) {
  const { items, toggleArticle } = useSavedItems()
  const saved = items.articles.some(row => row.article_url === articleKey(article.article_url))
  return <button type="button" className="save-button" aria-pressed={saved} aria-label={`${article.title} 북마크 ${saved ? '해제' : '저장'}`} onClick={() => toggleArticle(article)}>{saved ? '✓ 저장됨' : '+ 기사 저장'}</button>
}
