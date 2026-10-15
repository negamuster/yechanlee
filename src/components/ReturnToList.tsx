import { Link, useLocation, useNavigate } from 'react-router-dom'
import { originLabel, readReturnOrigin, returnDelta } from '../lib/returnNavigation'
export default function ReturnToList() {
  const location = useLocation()
  const navigate = useNavigate()
  const origin = readReturnOrigin(location.state)
  const href = origin?.href ?? '/markets'
  return <Link className="stock-return-link" aria-label={origin ? `${originLabel(href)}에서 보던 위치로 돌아가기` : '시장으로 이동'} to={href} state={origin ? { restoreEntry: origin.key } : undefined} onClick={event => {
    const delta = returnDelta(origin, window.history.state?.idx)
    if (delta !== null && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); navigate(delta)
    }
  }}>← {originLabel(href)}</Link>
}
