import { readdir, readFile, writeFile } from 'node:fs/promises'
import { publishable } from './briefing-publication.mjs'
const dir = new URL('../content/briefings/', import.meta.url)
const items = await Promise.all((await readdir(dir)).filter(x=>x.endsWith('.json')).map(async name=>JSON.parse(await readFile(new URL(name,dir),'utf8'))))
const publicItems = publishable(items)
await writeFile(new URL('../src/data/published-briefings.json',import.meta.url),JSON.stringify(publicItems,null,2)+'\n')
console.log(`Briefings: ${publicItems.length} published; ${items.length-publicItems.length} withheld`)
