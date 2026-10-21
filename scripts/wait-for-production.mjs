import { waitForProductionCommit } from '../lib/deployment-health.js'
await waitForProductionCommit(process.argv[2])
console.log('Production commit verified')
