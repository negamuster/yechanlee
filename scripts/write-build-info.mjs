import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

let commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA
if (!commit) { try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { /* Source archives can have no Git metadata. */ } }
writeFileSync('dist/build-info.json', JSON.stringify({ commit: /^[a-f0-9]{40}$/.test(commit || '') ? commit : null }) + '\n')
