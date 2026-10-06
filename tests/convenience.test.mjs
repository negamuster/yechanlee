import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRead, markRead, readUrl } from '../src/lib/readArticles.ts'
import { removedItems, restoreRemoved, removeSaved, updateSaved } from '../src/lib/savedItems.ts'
import { exportCalendar } from '../src/lib/calendarExport.ts'
const now = Date.parse('2026-10-06T00:00:00Z')
test('read history validates URLs, expires entries and normalizes fragments', () => {
 const data = markRead({}, 'https://example.com/news#section', now)
 assert.equal(data['https://example.com/news'], now)
 assert.equal(readUrl('javascript:alert(1)'), '')
 assert.deepEqual(parseRead(JSON.stringify(data), now + 91 * 86400000), {})
 assert.deepEqual(parseRead('broken'), {})
 assert.deepEqual(parseRead(JSON.stringify({'https://example.com/future':now+86400000}),now),{})
 const many=Object.fromEntries(Array.from({length:1005},(_,i)=>[`https://example.com/${i}`,now-i]))
 assert.equal(Object.keys(parseRead(JSON.stringify(many),now)).length,1000)
})
test('undo restores only deleted identities and preserves later additions and updates', () => {
 const before={version:1,stocks:[{ticker:'AAPL',name:'Apple'},{ticker:'MSFT',name:'Microsoft'}],articles:[]}
 const after=removeSaved(before,'stocks',['AAPL'])
 const removed=removedItems(before,after)
 const current={...after,stocks:[...after.stocks,{ticker:'NVDA',name:'Nvidia'}]}
 assert.deepEqual(restoreRemoved(current,before,removed).stocks.map(s=>s.ticker),['AAPL','MSFT','NVDA'])
 const newer={...current,stocks:[{ticker:'AAPL',name:'New name'},...current.stocks]}
 assert.equal(restoreRemoved(newer,before,removed).stocks[0].name,'New name')
 assert.deepEqual(before.stocks.map(s=>s.ticker),['AAPL','MSFT'])
 const full={...before,stocks:Array.from({length:200},(_,i)=>({ticker:`T${i}`,name:`Stock ${i}`}))}
 let writes=0
 assert.throws(()=>updateSaved({getItem:()=>JSON.stringify(full),setItem:()=>writes++},value=>restoreRemoved(value,before,removed)),/limit/)
 assert.equal(writes,0)
})
const event={id:'test:1',title:'FOMC, meeting',date:'2026-11-04',startAt:'2026-11-04T14:00:00-05:00',source:'Fed',sourceUrl:'https://example.com',estimated:false,session:null}
test('calendar export uses absolute UTC across DST and escapes injected text',()=>{
 const text=exportCalendar([{...event,title:'한글'.repeat(60)+';test\nBEGIN:VEVENT'}],new Date(now))
 assert.ok(text.includes('DTSTART:20261104T190000Z'))
 const unfolded=text.replace(/\r\n /g,'')
 assert.ok(unfolded.includes('\\;test\\nBEGIN:VEVENT'))
 assert.equal(text.split('\r\n').filter(line=>line==='BEGIN:VEVENT').length,1)
 for(const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line)<=75)
 assert.ok(text.endsWith('END:VCALENDAR\r\n'))
})
test('untimed earnings remain all-day estimates rather than invented timestamps',()=>{
 const text=exportCalendar([{...event,startAt:null,estimated:true,session:'pre'}],new Date(now)).replace(/\r\n /g,'')
 assert.ok(text.includes('DTSTART;VALUE=DATE:20261104'))
 assert.ok(text.includes('(예상)'))
 assert.ok(text.includes('장전'))
 assert.ok(text.includes('자동 갱신되지 않습니다'))
 assert.ok(!text.includes('DTEND'))
 assert.throws(()=>exportCalendar([{...event,date:'2026-02-30'}]),/Invalid event date/)
})
