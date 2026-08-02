import fs from 'fs'
import path from 'path'

const root = path.resolve('src')
const results = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(entry.name)) check(full)
  }
}

function check(file) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/')
  const text = fs.readFileSync(file, 'utf8')
  const issues = []

  if (/from ['"]@\/data\/mocks['"]/.test(text) || /from ['"].*\/mocks['"]/.test(text)) {
    issues.push('imports mocks module')
  }
  if (/mockUsers|mockDocuments|mockAuditLogs|mockSectors|mockCategories/.test(text)) {
    issues.push('references domain mock collections')
  }
  if (/mockDelay/.test(text)) issues.push('uses mockDelay')
  if (rel !== 'src/services/api.ts' && /\bfetch\s*\(/.test(text)) {
    issues.push('direct fetch outside api.ts')
  }
  if (issues.length) results.push({ file: rel, issues })
}

walk(root)

const mocksFile = fs.existsSync('src/data/mocks.ts')
console.log('mocks.ts exists:', mocksFile)
console.log('violations:', results.length)
for (const r of results) console.log('-', r.file, r.issues.join('; '))
fs.writeFileSync(
  'tmp/etapa9-mock-guard.json',
  JSON.stringify({ mocksFile, violations: results }, null, 2)
)
process.exit(mocksFile || results.length ? 1 : 0)
