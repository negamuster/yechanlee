import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCover, parseTable, verifyTable, combineFilings, submissionRecords, previousQuarter } from '../lib/form13f.js'
const coverXML = (total=300,count=2,amendment='') => `<edgarSubmission><formData><coverPage><reportCalendarOrQuarter>06-30-2026</reportCalendarOrQuarter><amendmentInfo><amendmentType>${amendment}</amendmentType></amendmentInfo></coverPage><summaryPage><tableEntryTotal>${count}</tableEntryTotal><tableValueTotal>${total}</tableValueTotal></summaryPage></formData></edgarSubmission>`
const entry = (cusip,title,value,option='')=>`<infoTable><nameOfIssuer>ALPHABET INC</nameOfIssuer><titleOfClass>${title}</titleOfClass><cusip>${cusip}</cusip><value>${value}</value><shrsOrPrnAmt><sshPrnamt>10</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt><putCall>${option}</putCall></infoTable>`
const tableXML = (...entries)=>`<informationTable>${entries.join('')}</informationTable>`
test('official summary uses all raw entries, while different share classes remain separate',()=>{
 const rows=parseTable(tableXML(entry('001','CL A',100),entry('002','CL C',200)))
 assert.equal(verifyTable(parseCover(coverXML(),'2026-08-14'),rows).parsedTotal,300)
 const combined=combineFilings([{form:'13F-HR',rows}]); assert.equal(combined.holdings.length,2)
 assert.notEqual(combined.holdings[0].key,combined.holdings[1].key)
 assert.throws(()=>verifyTable(parseCover(coverXML(301),'2026-08-14'),rows),/summary_mismatch/)
 assert.throws(()=>verifyTable(parseCover(coverXML(300,3),'2026-08-14'),rows),/summary_mismatch/)
})
test('options counted for SEC verification and disclosed separately from displayed holdings',()=>{
 const rows=parseTable(tableXML(entry('001','CL A',100),entry('001','CL A',200,'Call')))
 verifyTable(parseCover(coverXML(),'2026-08-14'),rows)
 const combined=combineFilings([{form:'13F-HR',rows}]);assert.equal(combined.excludedValue,200);assert.equal(combined.holdings[0].value,100)
})
test('old dollar units depend on filing date, not report period',()=>{
 assert.equal(parseCover(coverXML(),'2022-11-15').reportedTotal,300000)
 assert.equal(parseCover(coverXML(),'2023-01-03').reportedTotal,300)
})
test('restatements replace and additional holdings append, unsupported amendments stop processing',()=>{
 const row=parseTable(tableXML(entry('001','CL A',100)))
 const replacement=parseTable(tableXML(entry('001','CL A',200)))
 const result=combineFilings([{form:'13F-HR',rows:row},{form:'13F-HR/A',amendment:'RESTATEMENT',rows:replacement},{form:'13F-HR/A',amendment:'NEW HOLDINGS',rows:row}])
 assert.equal(result.holdings[0].value,300)
 assert.throws(()=>combineFilings([{form:'13F-HR/A',amendment:'UNKNOWN',rows:row}]),/unsupported_amendment/)
})
test('report dates stay separate from filed dates, amendments retained and prior quarter exact',()=>{
 const records=submissionRecords({form:['13F-HR/A'],reportDate:['2026-03-31'],filingDate:['2026-08-14'],accessionNumber:['0000000001-26-000001'],primaryDocument:['primary.xml']})
 assert.equal(records[0].period,'2026-03-31');assert.equal(records[0].filedAt,'2026-08-14')
 assert.equal(previousQuarter('2026-06-30'),'2026-03-31');assert.equal(previousQuarter('2026-03-31'),'2025-12-31')
 assert.throws(()=>submissionRecords({form:['13F-HR']}),/invalid_filing_metadata/)
})

test('Berkshire official 2026 Q2 XML: 89 original rows, exact $299,253,556,246 total', async()=>{
 const { readFileSync } = await import('node:fs')
 const cover=parseCover(readFileSync(new URL('./fixtures/sec/000119312526352200-primary_doc.xml',import.meta.url),'utf8'),'2026-08-14')
 const rows=parseTable(readFileSync(new URL('./fixtures/sec/000119312526352200-56757.xml',import.meta.url),'utf8'),cover.multiplier)
 assert.equal(verifyTable(cover,rows).parsedTotal,299253556246)
 assert.equal(rows.length,89)
 const combined=combineFilings([{form:'13F-HR',rows}])
 assert.equal(combined.holdings.length,29)
 assert.equal(combined.holdings.reduce((sum,h)=>sum+h.value,0),299253556246)
})

test('handler refreshes after cache expiry, coalesces requests and retains last verified data on failure', async()=>{
 const { create13FHandler } = await import('../lib/form13f.js')
 const { readFileSync } = await import('node:fs')
 const cover=readFileSync(new URL('./fixtures/sec/000119312526352200-primary_doc.xml',import.meta.url),'utf8')
 const table=readFileSync(new URL('./fixtures/sec/000119312526352200-56757.xml',import.meta.url),'utf8')
 let time=Date.parse('2026-09-23T00:00:00Z'), calls=0, fail=false
 const handler=create13FHandler({now:()=>time,fetchImpl:async url=>{
  calls++;if(fail) return new Response('',{status:503})
  if(url.includes('/submissions/'))return Response.json({name:'Berkshire',filings:{recent:{form:['13F-HR'],reportDate:['2026-06-30'],filingDate:['2026-08-14'],accessionNumber:['0001193125-26-352200'],primaryDocument:['primary_doc.xml']}}})
  if(url.endsWith('index.htm'))return new Response('<tr><td>INFORMATION TABLE</td><td><a href="56757.xml">table</a></td></tr>')
  return new Response(url.endsWith('primary_doc.xml')?cover:table)
 }})
 const req=()=>new Request('https://example.com/api/form13f?cik=0001067983')
 const responses=await Promise.all([handler(req()),handler(req())]);assert.equal(calls,4)
 const first=await responses[0].json();assert.equal(first.verification,'matched');assert.equal(first.previousAvailable,false);assert.equal(first.holdings[0].prevShares,undefined)
 await handler(req());assert.equal(calls,4)
 time+=16*60000;const refreshed=await (await handler(req())).json();assert.equal(calls,8);assert.equal(refreshed.checkedAt,time)
 time+=16*60000;fail=true;const stale=await (await handler(req())).json();assert.equal(stale.stale,true);assert.equal(stale.checkedAt,refreshed.checkedAt)
 assert.equal((await handler(new Request('https://example.com/api/form13f?cik=not-allowed'))).status,400)
})

test('legacy metadata with no primary document does not block selection of modern filings',()=>{
 const records=submissionRecords({form:['13F-HR','13F-HR'],reportDate:['2026-06-30','1999-12-31'],filingDate:['2026-08-14','2000-02-11'],accessionNumber:['0000000001-26-000001','0000000001-00-000001'],primaryDocument:['primary_doc.xml','']})
 assert.equal(records.length,2);assert.equal(records[0].primary,'primary_doc.xml');assert.equal(records[1].primary,'')
})
