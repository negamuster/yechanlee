import { exchangeCalendar } from '../lib/exchange-calendar.js'
if (!exchangeCalendar.info) throw new Error('Invalid/incomplete reviewed exchange schedule')
console.log(`Verified NYSE schedule ${exchangeCalendar.info.from} through ${exchangeCalendar.info.to}`)
