import fs from 'fs'
import path from 'path'

function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p)
    else if (f.name.endsWith('.tsx') && f.name !== 'layout.tsx') processFile(p)
  }
}

function processFile(file) {
  let c = fs.readFileSync(file, 'utf8')
  if (!c.includes('Navbar')) return
  c = c.replace(/import Navbar from '@\/components\/Navbar'\r?\n/g, '')
  c = c.replace(/import \{ (ADMIN_LINKS|USER_LINKS|SP_LINKS) \} from '@\/lib\/nav-links'\r?\n/g, '')
  c = c.replace(/\s*<Navbar user=\{user\} links=\{[^}]+\} \/>\r?\n/g, '\n')
  c = c.replace(/\s*<Navbar user=\{user\} \/>\r?\n/g, '\n')
  const hadWrapper = /<div className="min-h-screen bg-(gray|slate)-50">/.test(c)
  c = c.replace(/<div className="min-h-screen bg-gray-50">\r?\n/g, '<>\n')
  c = c.replace(/<div className="min-h-screen bg-slate-50">\r?\n/g, '<>\n')
  if (hadWrapper) {
    c = c.replace(/\r?\n    <\/div>\r?\n  \)\r?\n\}$/, '\n  )\n}')
  }
  fs.writeFileSync(file, c)
  console.log('updated', file)
}

for (const r of ['app/admin', 'app/user', 'app/sp']) {
  if (fs.existsSync(r)) walk(r)
}
