import { useReadArticles } from '../hooks/useReadArticles'
import { useState } from 'react'
import { SelectionTools } from '../components/SavedSelection'
import { useSavedSelection } from '../hooks/useSavedSelection'
import { JUDGMENTS } from '../lib/thesis'
import '../pages/Thesis.css'
import SavedBackup from '../components/SavedBackup'
import WatchlistPanel from '../components/WatchlistPanel'
import WatchlistNews from '../components/WatchlistNews'
import WatchlistEarnings from '../components/WatchlistEarnings'
import { Link, useNavigate } from 'react-router-dom'
import { BookmarkButton, useSavedItems } from '../components/SavedItemsProvider'
export default function Saved() {
  const navigate = useNavigate()
  const { isRead, mark } = useReadArticles()
  const { items } = useSavedItems()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('saved')
  const selection = useSavedSelection('articles', items.articles.map(a => a.article_url))
  const articles = items.articles.filter(a => `${a.title} ${a.publisher}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => sort === 'latest' ? Date.parse(b.published_utc) - Date.parse(a.published_utc) : sort === 'publisher' ? a.publisher.localeCompare(b.publisher) || Date.parse(b.published_utc) - Date.parse(a.published_utc) : 0)
  return <main className="saved-page">
    <p className="saved-eyebrow">MY COLLECTION</p><h1>저장한 항목</h1>
    <p className="saved-description">다시 살펴볼 종목과 읽고 싶은 기사를 한곳에 모아보세요.</p>
    <p className="saved-note">이 브라우저에만 저장됩니다. 다른 기기와 동기화되지 않으며, 사이트 데이터를 삭제하면 목록도 지워집니다. 관심 종목 최대 200개 · 기사 최대 500개.</p>
    <SavedBackup />
    <section className="thesis-overview" aria-labelledby="thesis-title"><h2 id="thesis-title">투자 논점 추적 <span>{items.theses?.length || 0}/50</span></h2><p className="saved-note">투자 근거·반대 근거·다음 확인 사항을 기록하고 판단의 변화를 남겨보세요. 관심 종목을 해제해도 노트는 유지됩니다.</p>
      {!!items.stocks.length && <label>노트 만들기·열기 <select aria-label="투자 노트를 작성할 관심 종목" value="" onChange={e => { if(e.target.value) navigate(`/saved/thesis/${encodeURIComponent(e.target.value)}`) }}><option value="">관심 종목 선택</option>{items.stocks.map(s=><option value={s.ticker} key={s.ticker}>{s.ticker} · {s.name}</option>)}</select></label>}
      {items.theses?.length ? <ul className="thesis-note-list">{[...items.theses].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(n=><li key={n.ticker}><Link to={`/saved/thesis/${encodeURIComponent(n.ticker)}`}><strong>{n.ticker}</strong><span>{n.name}</span><small>{n.history.length ? JUDGMENTS[n.history[n.history.length-1].judgment] : '판단 기록 없음'} · 수정 {new Date(n.updatedAt).toLocaleDateString('ko-KR')}{n.reviewDate ? ` · 확인 예정 ${n.reviewDate}` : ''}</small></Link></li>)}</ul>:<p className="saved-note">관심 종목을 선택해 첫 투자 노트를 만들어 보세요.</p>}
    </section>
    <WatchlistPanel />
    {!!items.stocks.length && <><WatchlistNews /><WatchlistEarnings /></>}
    <section aria-labelledby="saved-articles"><h2 id="saved-articles">기사 북마크 <span>{items.articles.length}</span></h2>
      {!!items.articles.length && <><div className="saved-manage-toolbar"><label>기사 검색 <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="제목·언론사" /></label><label>정렬 <select value={sort} onChange={e => setSort(e.target.value)}><option value="saved">저장순</option><option value="latest">발행일 최신순</option><option value="publisher">언론사순</option></select></label></div><SelectionTools selection={selection} visible={articles.map(a => a.article_url)} />{!articles.length && <p role="status">검색 결과가 없습니다.</p>}</>}
      {items.articles.length ? <ul className="saved-list">{articles.map(article => <li key={article.article_url}><label className="saved-checkbox"><input type="checkbox" aria-label={`${article.title} 선택`} checked={selection.selected.includes(article.article_url)} onChange={() => selection.toggle(article.article_url)} /></label>
        <a className={`saved-content${isRead(article.article_url) ? ' is-read' : ''}`} onClick={() => mark(article.article_url)} onAuxClick={e => { if (e.button === 1) mark(article.article_url) }} href={article.article_url} target="_blank" rel="noopener noreferrer"><small>{article.publisher} · {new Date(article.published_utc).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</small><strong>{article.title}</strong><span>{isRead(article.article_url) ? '읽음 · ' : ''}원문 읽기 ↗</span></a><BookmarkButton article={article} />
      </li>)}</ul> : <div className="saved-empty"><Link to="/">Latest News</Link>에서 ‘기사 저장’을 누르면 여기에 모입니다. 뉴스 목록에서 사라진 기사도 북마크는 유지됩니다.</div>}
      <p className="saved-note">기사 본문은 저장하지 않습니다. 원문이 삭제되거나 유료로 전환되면 열람이 제한될 수 있습니다.</p>
    </section>
  </main>
}

