import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/financialMath.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { projectAssets, portfolioSlices, portfolioPercent } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const input = overrides => ({ age:30, retireAge:60, assets:[{ balance:100, rate:10 }], debts:[], income:0, expense:0, incomeGrowth:0, expenseGrowth:0, ...overrides })
test('13F denominator includes holdings outside the table and Other, including sub-0.5% slices', () => {
 const holdings = Array.from({length:40},(_,i)=>({name:`Holding ${i}`,value:1}))
 const slices = portfolioSlices(holdings.slice(0,30),40)
 assert.equal(slices[0].pct,2.5); assert.equal(slices.at(-1).pct,75)
 assert.equal(slices.reduce((sum,s)=>sum+s.value,0),40)
 assert.equal(portfolioPercent(1,40),slices[0].pct)
 assert.equal(portfolioSlices([{name:'A',value:99.9}],100).length,2)
 assert.deepEqual(portfolioSlices([],0),[])
 assert.equal(portfolioSlices([{name:'A',value:100}],100)[0].fraction,1)
})
test('assets earn a return independently of debt; interest is a separate cost', () => {
 const rows=projectAssets(input({debts:[{balance:50,rate:4,annualPrincipal:0}]}))
 assert.equal(rows[0].asset,50); assert.equal(rows[0].interest,2)
 assert.equal(rows[1].grossAssets,108); assert.equal(rows[1].debt,50); assert.equal(rows[1].asset,58)
})
test('principal payment reduces cash and debt equally, capped at outstanding balance', () => {
 const rows=projectAssets(input({assets:[{balance:100,rate:0}], debts:[{balance:50,rate:10,annualPrincipal:80}]}))
 assert.equal(rows[0].principal,50); assert.equal(rows[0].interest,5)
 assert.equal(rows[1].grossAssets,45); assert.equal(rows[1].debt,0); assert.equal(rows[1].asset,45)
 assert.equal(rows[1].interest,0); assert.equal(rows[1].principal,0)
})
test('negative assets never earn positive returns, shortage is disclosed and later surplus fills it', () => {
 const rows=projectAssets(input({assets:[{balance:10,rate:10}],income:0,expense:20}))
 assert.equal(rows[1].grossAssets,0); assert.equal(rows[1].fundingGap,9); assert.equal(rows[1].asset,-9)
 assert.equal(rows[2].fundingGap,29); assert.equal(rows[2].investmentReturn,0)
 const recovery=projectAssets(input({assets:[{balance:0,rate:10}],income:0,expense:0}))
 assert.equal(recovery[1].asset,0)
})
test('retirement starts at specified age; initial year is a snapshot; zero and negative rates are supported', () => {
 const rows=projectAssets(input({retireAge:31,income:20,expense:10,assets:[{balance:100,rate:-10}]}))
 assert.equal(rows[0].asset,100); assert.equal(rows[1].asset,100); assert.equal(rows[2].asset,80)
 assert.equal(rows.at(-1).age,100)
 assert.equal(projectAssets(input({age:-1})).length,0)
 assert.equal(projectAssets(input({age:30.5})).length,0)
 assert.equal(projectAssets(input({assets:[{balance:100,rate:-101}]})).length,0)
 assert.equal(projectAssets(input({debts:[{balance:1,rate:-1,annualPrincipal:0}]})).length,0)
})
