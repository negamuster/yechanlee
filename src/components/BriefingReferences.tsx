import { Link } from 'react-router-dom'
import type { Briefing } from '../lib/briefings'
export function SourceRefs({ item, ids }: { item: Briefing; ids: number[] }) {
  return <sup className="briefing-citations">{ids.map(id => <Link key={id} to={`/briefings/${item.id}#source-${id}`} aria-label={`출처 ${id}: ${item.sources.find(s => s.id === id)?.label ?? ''}`}>[{id}]</Link>)}</sup>
}
export function CitedText({ item, text }: { item: Briefing; text: string }) {
  return <>{text.split(/(\[\d+\])/g).map((part, i) => /^\[\d+\]$/.test(part) ? <SourceRefs key={i} item={item} ids={[Number(part.slice(1, -1))]} /> : part)}</>
}
