import type { Briefing } from '../lib/briefings'
import { eventTime, trendClass } from '../lib/briefingPresentation'
import type { BriefingSection } from '../lib/briefingPresentation'
import { SourceRefs } from './BriefingReferences'
import EvidenceAttachButton from './EvidenceAttachButton'
import { briefingEvidence } from '../lib/evidenceSources'
export default function BriefingDetails({ item, section, mobile = false }: { item: Briefing; section?: BriefingSection | null; mobile?: boolean }) {
  const home = item.homepage
  if (!home) return null
  if (section === 'stocks') return <section className="briefing-section" aria-labelledby="briefing-stocks-title">
    <div className="briefing-section-heading"><h4 id="briefing-stocks-title">주요 종목</h4></div>
    <ul className="briefing-stocks">{home.stocks.map(stock => <li key={stock.ticker}>
      <div className="briefing-stock-heading"><strong>{stock.name} <span>{stock.ticker}</span></strong><b className={trendClass(stock.change)}>{stock.change}</b></div>
      <p>{stock.reason}<SourceRefs item={item} ids={stock.sourceIds} /></p>
      <small>{stock.basis}</small>
      <EvidenceAttachButton source={briefingEvidence(item, stock)} stock={{ticker:stock.ticker,name:stock.name}} />
    </li>)}</ul>
  </section>
  if (section === 'assets') return <section className="briefing-section" aria-labelledby="briefing-assets-title">
    <div className="briefing-section-heading"><h4 id="briefing-assets-title">자산 흐름</h4></div>
    {mobile ? <><p className="mobile-briefing-basis-note">자산별 관측 시각과 비교 기준이 다릅니다.</p><dl className="mobile-briefing-assets">{home.assets.map(asset => <div key={asset.label}>
      <dt>{asset.label}<SourceRefs item={item} ids={asset.sourceIds} /></dt>
      <dd><strong>{asset.value}</strong><span className={trendClass(asset.change)}>변화 {asset.change}</span><small>{asset.basis}</small></dd>
    </div>)}</dl></> : <table className="briefing-assets"><caption>자산별 관측 시각과 비교 기준이 다릅니다.</caption>
      <thead><tr><th scope="col">자산 · 관측 기준</th><th scope="col">수치</th><th scope="col">변화</th></tr></thead>
      <tbody>{home.assets.map(asset => <tr key={asset.label}>
        <th scope="row">{asset.label}<SourceRefs item={item} ids={asset.sourceIds} /><span>{asset.basis}</span></th>
        <td>{asset.value}</td><td className={trendClass(asset.change)}>{asset.change}</td>
      </tr>)}</tbody>
    </table>}
  </section>
  if (section === 'events') return <section className="briefing-section" aria-labelledby="briefing-events-title">
    <div className="briefing-section-heading"><h4 id="briefing-events-title">오늘·다음 일정</h4><span>KST</span></div>
    <ol className="briefing-events">{home.events.map(event => <li key={`${event.at}-${event.label}`}>
      <time dateTime={event.at}>{eventTime(event.at)}</time>
      <p>{event.label}<SourceRefs item={item} ids={event.sourceIds} /></p>
      {event.detail && <small>{event.detail}</small>}
    </li>)}</ol>
  </section>
  return null
}
