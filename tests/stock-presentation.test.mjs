import test from 'node:test'
import assert from 'node:assert/strict'
import { stockMoney, stockNumber, stockPercent, stockChartWindow, nearestStockBar } from '../src/lib/stockPresentation.ts'
const bar=(date,c)=>({t:Date.parse(`${date}T04:00:00Z`),o:c,h:c,l:c,c})
test('financial formatting preserves losses and zero without turning missing values into numbers',()=>{
 assert.equal(stockMoney(-1.25e9,'USD',true),'-$1.25B')
 assert.equal(stockMoney(0),'$0.00')
 assert.equal(stockMoney(null),'—')
 assert.equal(stockMoney(Infinity),'—')
 assert.equal(stockNumber('12'),null)
 assert.equal(stockPercent(null),'—')
 assert.equal(stockPercent(-5.123,true),'-5.12%')
})
test('selected-period return can rise while the last daily move falls; single observations stay unknown',()=>{
 const bars=[bar('2026-07-01',50),bar('2026-09-10',100),bar('2026-10-13',120),bar('2026-10-14',110)]
 const month=stockChartWindow(bars,30)
 assert.deepEqual(month.bars.map(b=>b.c),[120,110])
 assert.ok(month.changePercent<0)
 const quarter=stockChartWindow(bars,90)
 assert.deepEqual(quarter.bars.map(b=>b.c),[100,120,110])
 assert.ok(Math.abs(quarter.changePercent-10)<1e-9)
 assert.equal(stockChartWindow([bars[3]],30).changePercent,null)
 assert.equal(stockChartWindow([],30).changePercent,null)
})
test('chart selection respects uneven trading-day gaps and clamps out-of-range pointers',()=>{
 const bars=[bar('2026-10-02',100),bar('2026-10-05',105),bar('2026-10-06',110)]
 assert.equal(nearestStockBar(bars,.7),1)
 assert.equal(nearestStockBar(bars,-1),0)
 assert.equal(nearestStockBar(bars,2),2)
 assert.equal(nearestStockBar([],0),-1)
})
