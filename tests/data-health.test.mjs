import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectHealth } from '../lib/data-health.js'
const now = Date.parse('2026-10-05T12:00:00Z')
test('weekend closing data is valid; stale and missing rankings fail', () => {
 const data = { tradingDate: '2026-10-02', fetchedAt: now, rankings: {turnover:[],gainers:[],losers:[]}, stale:false }
 assert.equal(inspectHealth('movers',data,now).errors.length,0)
 assert.ok(inspectHealth('movers',{...data,stale:true},now).errors.length)
 assert.ok(inspectHealth('movers',{},now).errors.length)
})
test('partial calendar outages warn without claiming complete failure', () => {
 const data={events:[],sources:[{name:'FRED',state:'snapshot',updatedAt:new Date(now).toISOString()},{name:'BLS',state:'unavailable'}]}
 const result=inspectHealth('calendar',data,now)
 assert.equal(result.errors.length,0);assert.equal(result.warnings.length,1)
 assert.ok(inspectHealth('calendar',{events:[],sources:[]},now).errors.length)
})
test('old news and all-missing quotes fail health checks',()=>{
 assert.ok(inspectHealth('news',{items:[{published_utc:'2026-09-01'}],fetchedAt:now,sources:[]},now).errors.length)
 assert.ok(inspectHealth('indices',{quotes:[{status:'unavailable'}],fetchedAt:now},now).errors.length)
})
