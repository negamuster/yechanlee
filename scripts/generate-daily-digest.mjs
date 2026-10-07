import { readFile, readdir, writeFile, access } from 'node:fs/promises'
import { collectInputs, makeDigest, kstDate } from './briefing-rules.mjs'
import { contentHash, publishable } from './briefing-publication.mjs'
const cutoff=Date.now(), id=kstDate(cutoff), dry=process.argv.includes('--dry-run')
const path=new URL(`../content/briefings/${id}.json`,import.meta.url)
const exists=await access(path).then(()=>true,()=>false)
if(exists&&!dry){console.log(`${id} already exists; preserved.`);process.exit(0)}
const dir=new URL('../content/briefings/',import.meta.url)
const old=await Promise.all((await readdir(dir)).filter(n=>n.endsWith('.json')).map(async n=>JSON.parse(await readFile(new URL(n,dir),'utf8'))))
const input=await collectInputs(cutoff)
console.log(JSON.stringify({news:input.news.sources,rates:input.rateRows.map(r=>r.date),rateError:input.rateError,calendars:input.calendars.map(c=>({source:c.key,error:c.error||null,events:c.events.length}))},null,2))
const item=makeDigest(input,cutoff,old)
item.review.contentHash=contentHash(item)
publishable([item])
if(dry){
 const destination=process.env.DIGEST_PREVIEW_PATH
 if(destination)await writeFile(destination,JSON.stringify(item,null,2)+'\n')
 console.log(`Dry run passed: ${item.id}, ${item.sources.length} sources. No publication files changed.`)
}else{await writeFile(path,JSON.stringify(item,null,2)+'\n',{flag:'wx'}); console.log(`Created ${id}; build and deployment still required.`)}
