import fs from 'fs'
import path from 'path'

const WRAPPER = /<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">/g

function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p)
    else if (f.name === 'page.tsx') processFile(p)
  }
}

function processFile(file) {
  let c = fs.readFileSync(file, 'utf8')
  if (!WRAPPER.test(c)) return
  WRAPPER.lastIndex = 0
  c = c.replace(WRAPPER, '')
  // remove one matching closing div before final );
  const idx = c.lastIndexOf('  )\n}')
  if (idx > 0) {
    const before = c.lastIndexOf('\n    </div>', idx)
    if (before > 0 && c.slice(before, idx).trim() === '</div>') {
      c = c.slice(0, before) + c.slice(before + '\n    </div>'.length)
    }
  }
  fs.writeFileSync(file, c)
  console.log('padding stripped', file)
}

for (const r of ['app/admin', 'app/user', 'app/sp']) {
  if (fs.existsSync(r)) walk(r)
}
