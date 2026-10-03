import { dataTime } from '../utils/dataTime'
import './DataStatus.css'
type Props = { basis: string; collectedAt?: string | number | null; stale?: boolean; source?: string }
export default function DataStatus({ basis, collectedAt, stale = false, source }: Props) {
  return <div className={`data-status${stale ? ' data-status-stale' : ''}`}>
    <span><strong>데이터 기준</strong> {basis}</span>
    {source && <span><strong>출처</strong> {source}</span>}
    <span><strong>{stale ? '마지막 정상 수집' : '수집 시각'}</strong> {dataTime(collectedAt)}</span>
    {stale && <span role="status">갱신 실패 · 이전 데이터 표시 중</span>}
  </div>
}
