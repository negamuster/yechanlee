import { Link } from 'react-router-dom'
import MarketCalendar from '../components/MarketCalendar'
export default function Calendar() {
  return <main className="calendar-page"><Link to="/">← Home</Link><MarketCalendar full /></main>
}
