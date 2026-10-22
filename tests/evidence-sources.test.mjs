import test from 'node:test'
import assert from 'node:assert/strict'
import { newsEvidence, financialEvidence, holdingEvidence, comparisonEvidence, briefingEvidence } from '../src/lib/evidenceSources.ts'
import { parseEvidenceSource } from '../src/lib/evidence.ts'
import { filingFixture } from './fixtures/form13f.mjs'
test('news stores only original title, publisher and date rather than article text',()=>{
 const source=newsEvidence({title:'News',publisher:'Reuters',published_utc:'2026-10-22T00:00:00Z',article_url:'https://example.com/news',body:'Do not store this'},true)
 assert.equal(source.stale,true);assert.equal(source.body,undefined);assert.deepEqual(source.facts,[]);parseEvidenceSource(source)
})
test('financial snapshots preserve raw zero/negative values, units, calculation inputs and receipt time',()=>{
 const source={accession:'1',form:'10-Q',filing_date:'2026-08-01',start_date:'2026-04-01',end_date:'2026-06-30',tag:'OperatingCashFlow',value:0,unit:'USD',url:'https://www.sec.gov/Archives/original.htm',revised:true}
 const row={start_date:'2026-04-01',end_date:'2026-06-30',filing_date:'2026-08-01',fiscal_period:'Q',accounting_standard:'us-gaap',source_filing_url:source.url,financials:{income_statement:{revenues:{value:123456789,unit:'USD'}},balance_sheet:{},cash_flow_statement:{operating_cash_flow:{value:0,unit:'USD',calculation:'difference',sources:[source]},capital_expenditures:{value:5,unit:'USD',basis:'ppe'},free_cash_flow:{value:-5,unit:'USD',calculation:'ocf_minus_capex',sources:[source]}}}}
 const result=financialEvidence(row,'SATL',Date.parse('2026-10-22T00:00:00Z'),true)
 assert.match(result.facts.find(f=>f.label==='매출').value,/123456789 USD/);assert.match(result.facts.find(f=>f.label==='영업현금흐름').value,/^0 USD/)
 assert.match(result.facts.find(f=>f.label==='FCF').value,/^-5 USD/);assert.equal(result.links[0].url,source.url);assert.equal(result.stale,true);parseEvidenceSource(result)
})
test('13F evidence retains CUSIP, raw USD, each denominator and explicit unreported data without ticker guesses',()=>{
 const left=filingFixture(), right=filingFixture({holdings:[{name:'Other',cusip:'999999999',title:'CL C',shares:2,prevShares:1,value:400}]})
 const source=holdingEvidence(left,left.holdings[0],'0001067983')
 assert.equal(source.facts.find(f=>f.label==='CUSIP').value,'000000001');assert.equal(source.facts.find(f=>f.label==='평가액 (USD)').value,'300');assert.equal(source.ticker,undefined)
 const comparison=comparisonEvidence(left,right,{cusip:'000000001',name:'Alpha',title:'COM',left:left.holdings[0],right:null,difference:50},{cik:'0001067983',firm:'A'},{cik:'0002012383',firm:'B'})
 assert.equal(comparison.facts.find(f=>f.label==='B 수량').value,'표시 대상 SH 미기재');assert.equal(comparison.facts.find(f=>f.label==='B 수집 보유금액 (USD)').value,'400');parseEvidenceSource(comparison)
})
test('briefing snapshots retain referenced sources beyond the first thirty plus cutoff and corrections',()=>{
 const item={id:'2026-10-22',title:'Daily Briefing',publishedAt:'2026-10-22T00:00:00Z',cutoffAt:'2026-10-21T22:00:00Z',sessionDate:'2026-10-21',summary:['Claim[35]'],sources:Array.from({length:40},(_,i)=>({id:i+1,label:`Source ${i+1}`,url:`https://example.com/${i+1}`})),corrections:[{at:'2026-10-22T01:00:00Z',text:'Correction'}],dataNote:'Closing prices'}
 const result=briefingEvidence(item);assert.equal(result.links[0].url,'https://example.com/35');assert.match(result.caveat,/Correction/);assert.equal(result.observedAt,item.cutoffAt);parseEvidenceSource(result)
})
