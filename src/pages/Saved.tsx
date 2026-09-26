import { Link } from 'react-router-dom'
import { BookmarkButton, WatchButton, useSavedItems } from '../components/SavedItemsProvider'
export default function Saved() {
  const { items } = useSavedItems()
  return <main className="saved-page">
    <p className="saved-eyebrow">MY COLLECTION</p><h1>저장한 항목</h1>
    <p className="saved-description">다시 살펴볼 종목과 읽고 싶은 기사를 한곳에 모아보세요.</p>
    <p className="saved-note">이 브라우저에만 저장됩니다. 다른 기기와 동기화되지 않으며, 사이트 데이터를 삭제하면 목록도 지워집니다. 관심 종목 최대 200개 · 기사 최대 500개.</p>
    <section aria-labelledby="saved-stocks"><h2 id="saved-stocks">관심 종목 <span>{items.stocks.length}</span></h2>
      {items.stocks.length ? <ul className="saved-list">{items.stocks.map(stock => <li key={stock.ticker}>
        <Link to={`/stock/${encodeURIComponent(stock.ticker)}`} className="saved-content"><strong>{stock.ticker}</strong><span>{stock.name !== stock.ticker ? stock.name : '종목 상세 보기 →'}</span></Link><WatchButton {...stock} />
      </li>)}</ul> : <div className="saved-empty">아직 저장한 종목이 없습니다. 상단에서 종목을 검색하거나 <Link to="/">홈의 Market Movers</Link>에서 ‘관심 저장’을 눌러 주세요.</div>}
    </section>
    <section aria-labelledby="saved-articles"><h2 id="saved-articles">기사 북마크 <span>{items.articles.length}</span></h2>
      {items.articles.length ? <ul className="saved-list">{items.articles.map(article => <li key={article.article_url}>
        <a className="saved-content" href={article.article_url} target="_blank" rel="noopener noreferrer"><small>{article.publisher} · {new Date(article.published_utc).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</small><strong>{article.title}</strong><span>원문 읽기 ↗</span></a><BookmarkButton article={article} />
      </li>)}</ul> : <div className="saved-empty"><Link to="/">Latest News</Link>에서 ‘기사 저장’을 누르면 여기에 모입니다. 뉴스 목록에서 사라진 기사도 북마크는 유지됩니다.</div>}
      <p className="saved-note">기사 본문은 저장하지 않습니다. 원문이 삭제되거나 유료로 전환되면 열람이 제한될 수 있습니다.</p>
    </section>
  </main>
}
