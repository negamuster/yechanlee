import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesCalendarFocus } from '../src/lib/calendarFilters.ts'
const fomc={category:'Fed',major:true}
const speech={category:'Fed',major:false}
const apple={category:'Earnings',major:false,ticker:'AAPL'}
const other={category:'Earnings',major:false,ticker:'MSFT'}
test('major-only excludes ordinary speeches and earnings; all preserves events',()=>{
 const watched=new Set(['AAPL'])
 assert.equal(matchesCalendarFocus(fomc,'major',watched),true)
 assert.equal(matchesCalendarFocus(speech,'major',watched),false)
 assert.equal(matchesCalendarFocus(apple,'major',watched),false)
 for(const e of [fomc,speech,apple,other]) assert.equal(matchesCalendarFocus(e,'all',watched),true)
})
test('watched-only matches saved earnings and handles empty watchlists',()=>{
 const watched=new Set(['AAPL'])
 assert.equal(matchesCalendarFocus(apple,'watched',watched),true)
 assert.equal(matchesCalendarFocus({...apple,ticker:'aapl'},'watched',watched),true)
 for(const e of [fomc,other,{...apple,ticker:undefined},{...apple,category:'Fed'}]) assert.equal(matchesCalendarFocus(e,'watched',watched),false)
 assert.equal(matchesCalendarFocus(apple,'watched',new Set()),false)
})
