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
  c = c.replace(/<\/main>\s*\n\s*<\/div>/g, '</main>')
  c = c.replace(/<>[\s\S]*?<\/main>\s*\n\s*<\/div>/g, m => m.replace(/<\/div>\s*$/, ''))
  // Fragment opened but closed with div
  if (c.includes('return (\n    <>') || c.includes('return (\r\n    <>')) {
    c = c.replace(/\n    <\/div>\n  \)/g, '\n  )')
    // if still unclosed fragment, add </> before final )
    if ((c.match(/<>/g) || []).length > (c.match(/<\/>/g) || []).length) {
      c = c.replace(/\n  \)\n\}$/, '\n    </>\n  )\n}')
    }
  }
  if (c !== orig) {
    fs.writeFileSync(file, c)
    console.log('fixed', file)
  }
}

for (const r of ['app/admin', 'app/user', 'app/sp']) {
  if (fs.existsSync(r)) walk(r)
}
