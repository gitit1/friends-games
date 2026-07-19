// Sync a CLEAN public mirror of this repo's code.
//
// What it does: takes the currently-committed files on this branch (git ls-files),
// EXCLUDES everything private (docs/, .claude/), swaps in README.public.md, and
// force-pushes a single fresh commit to the public mirror repo — so the mirror
// never carries planning docs, research, or any git history.
//
// Usage:  node scripts/sync-public.mjs
// Config: PUBLIC_REMOTE below (created once with: gh repo create <name> --public)
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PUBLIC_REMOTE = 'https://github.com/gitit1/friends-games.git'
const EXCLUDE = [/^docs\//, /^\.claude\//, /^README\.md$/, /^README\.public\.md$/]

const root = execSync('git rev-parse --show-toplevel').toString().trim()
process.chdir(root)

// snapshot MAIN's committed tree (not the current branch / working dir)
const files = execSync('git ls-tree -r --name-only -z main').toString().split('\0').filter(Boolean)
  .filter((f) => !EXCLUDE.some((re) => re.test(f)))

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'public-mirror-'))
for (const f of files) {
  const dest = path.join(tmp, f)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, execSync(`git show "main:${f}"`, { maxBuffer: 64 * 1024 * 1024 }))
}
// public README replaces the private one
fs.copyFileSync(path.join(root, 'README.public.md'), path.join(tmp, 'README.md'))

const run = (cmd) => execSync(cmd, { cwd: tmp, stdio: 'inherit' })
run('git init -b main')
run('git add -A')
run('git -c user.name="Gitit Regev" -c user.email="gitit1@msn.com" commit -q -m "public code mirror — snapshot"')
run(`git push --force "${PUBLIC_REMOTE}" main`)
console.log(`\nMirror synced: ${files.length} files -> ${PUBLIC_REMOTE}`)
fs.rmSync(tmp, { recursive: true, force: true })
