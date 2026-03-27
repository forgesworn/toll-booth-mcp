import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Read and convert the ext-apps browser bundle to a global assignment
const bundle = readFileSync(
  require.resolve('@modelcontextprotocol/ext-apps/app-with-deps'), 'utf8',
).replace(/export\{([^}]+)\};?\s*$/, (_, body) =>
  'globalThis.ExtApps={' +
  body.split(',').map((p) => {
    const [local, exported] = p.split(' as ').map((s) => s.trim())
    return `${exported ?? local}:${local}`
  }).join(',') + '};',
)

const outDir = join(__dirname, '..', 'dist', 'widgets')
mkdirSync(outDir, { recursive: true })

const widgets = ['payment-history', 'services-table', 'revenue-dashboard']

for (const name of widgets) {
  const html = readFileSync(
    join(__dirname, '..', 'widgets', name, 'index.html'), 'utf8',
  ).replace('/*__EXT_APPS_BUNDLE__*/', () => bundle)
  writeFileSync(join(outDir, `${name}.html`), html)
}

console.error(`Built ${widgets.length} widgets to ${outDir}`)
