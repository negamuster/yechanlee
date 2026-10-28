import { dataTime } from '../utils/dataTime'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import { Skeleton } from './ui/Skeleton'
import './ResourceState.css'

export type SkeletonLayout = 'tiles' | 'rows' | 'news' | 'ticker'

export function DataSkeleton({ label, layout = 'rows' }: { label: string; layout?: SkeletonLayout }) {
  return <div className={`data-skeleton data-skeleton-${layout}`} role="status" aria-label={label}>
    <span className="data-sr-only">{label}</span>
    <div className="data-skeleton-shapes" aria-hidden="true">{Array.from({ length: layout === 'tiles' ? 6 : layout === 'ticker' ? 4 : 3 }, (_, index) => <div className="data-skeleton-item" key={index}><Skeleton /><Skeleton /><Skeleton /></div>)}</div>
  </div>
}

export function DataNotice({ message, detail, tone = 'warning', onRetry, busy = false, updatedAt }: {
  message: string; detail?: string; tone?: 'loading' | 'warning' | 'error'; onRetry?: () => void; busy?: boolean; updatedAt?: string | number | null
}) {
  const date = updatedAt == null ? null : new Date(updatedAt)
  const timestamp = date && Number.isFinite(date.getTime()) ? date.toISOString() : undefined
  return <div className={`data-notice data-notice-${tone}`} role="status" data-widget-interactive>
    <span className="data-notice-mark" aria-hidden="true">{tone === 'loading' ? <LoaderCircle size={18} /> : <AlertCircle size={18} />}</span>
    <div className="data-notice-content"><p>{message}</p>{detail && <p className="data-notice-detail">{detail}</p>}
      {timestamp && <p className="data-notice-time">표시 자료 조회 <time dateTime={timestamp}>{dataTime(updatedAt)}</time></p>}
    </div>
    {onRetry && <button className="data-retry" type="button" disabled={busy} onClick={onRetry} aria-label={`${message} 다시 시도`}>{busy ? '확인 중…' : '다시 시도'}</button>}
  </div>
}

export default function ResourceState({ label, loading, error, hasData, stale = false, updatedAt, onRetry, layout = 'rows', failureMessage, failureDetail }: {
  label: string; loading: boolean; error: boolean; hasData: boolean; stale?: boolean; updatedAt?: string | number | null
  onRetry: () => void; layout?: SkeletonLayout; failureMessage?: string; failureDetail?: string
}) {
  if (error || stale) return <DataNotice tone={hasData ? 'warning' : 'error'}
    message={failureMessage ?? (hasData ? '갱신 실패 · 이전 데이터 표시 중' : `${label} 조회에 실패했습니다.`)}
    detail={failureDetail} updatedAt={hasData ? updatedAt : undefined} onRetry={onRetry} busy={loading} />
  if (loading && !hasData) return <DataSkeleton label={`${label} 불러오는 중`} layout={layout} />
  if (loading) return <DataNotice message="업데이트 중…" tone="loading" />
  return null
}
