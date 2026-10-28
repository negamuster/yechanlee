import { readFileSync } from 'node:fs'
import { validMonitor, monitorIdentity } from '../lib/sec-monitor.js'
const snapshot = JSON.parse(readFileSync('public/data/sec-filings.json', 'utf8'))
const config = JSON.parse(readFileSync('config/sec-monitor.json', 'utf8'))
if (!validMonitor(snapshot) || JSON.stringify(snapshot.universe) !== JSON.stringify(config.universe) || JSON.stringify(snapshot.companies.map(monitorIdentity)) !== JSON.stringify(config.companies)) throw new Error('Invalid SEC monitor snapshot')
console.log('SEC snapshot contract and configured identities verified')
