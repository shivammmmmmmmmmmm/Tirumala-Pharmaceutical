import fs from 'fs'
import path from 'path'

function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p)
    else if (f.name === 'page.tsx') fix(p)
  }
}

function fix(file) {
  let c = fs.readFileSync(file, 'utf8')
  const orig = c

  // Remove orphan extra closing divs (from bad strip)
  c = c.replace(/\n      <\/div>\n    <\/div>\n  \)/g, '\n  )')
  c = c.replace(/\n        <\/div>\n      <\/div>\n    <\/div>\n  \)/g, '\n        </div>\n      </div>\n  )')

  const m = c.match(/return \(\s*\n([\s\S]*?)\n  \)\n\}/)
  if (!m) return
  const body = m[1].trim()
  if (!body || body.startsWith('<div className="contents">') || body.startsWith('<>')) return

  // Multiple top-level nodes: wrap
  const lines = body.split('\n')
  const first = lines[0].trim()
  if (first.startsWith('<') && !first.startsWith('<div className="contents"')) {
    const wrapped = `    <div className="contents">\n${body}\n    </div>`
    c = c.replace(m[0], `return (\n${wrapped}\n  )\n}`)
  }

  if (c !== orig) {
    fs.writeFileSync(file, c)
    console.log('wrapped', file)
  }
}

for (const r of ['app/admin', 'app/user', 'app/sp']) {
  if (fs.existsSync(r)) walk(r)
}
