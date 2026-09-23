import fs from 'node:fs'
import { collect13F } from '../lib/form13f.js'
const root='tests/fixtures/sec/'
const manifest=JSON.parse(fs.readFileSync(root+'manifest.json'))
const results=[]
for (const cik of process.argv.slice(2).length ? process.argv.slice(2) : ['0001067983','0002026053','0001423053']) {
 try {
  const d=await collect13F(cik,{fetchImpl:async url=>{ if(!manifest[url])throw new Error(`Missing fixture: ${url}`); return new Response(fs.readFileSync(root+manifest[url],'utf8')) }})
  const report={cik,name:d.managerName,period:d.period,total:d.reportedTotal,excluded:d.excludedValue,displayedTotal:d.totalValue,holdingCount:d.holdingCount,sources:d.sources,previousAvailable:d.previousAvailable}
  results.push(report);console.log(JSON.stringify(report))
 }catch(e){console.log(cik,e.message);process.exitCode=1}
}
fs.writeFileSync(root+'verification-report.json',JSON.stringify(results,null,2))
