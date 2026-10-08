import ts from 'typescript'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Pinned, explicitly redistributable encodings. Never execute upstream TypeScript.
const revision = '9d22701fb714ed6b3b4e8118f6337965bc54e1a9'
const base = `https://raw.githubusercontent.com/ya-luotao/dacapo/${revision}`
async function download(path) {
  const response = await fetch(`${base}/${path}`)
  if (!response.ok) throw new Error(`${response.status}: ${path}`)
  return response.text()
}
function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal)
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property)) throw new Error('Nonliteral source metadata')
    return [property.name.text, literal(property.initializer)]
  }))
  throw new Error(`Unsupported metadata node: ${node.kind}`)
}
const source = ts.createSourceFile('index.ts', await download('src/pieces/library/index.ts'), ts.ScriptTarget.Latest, true)
let pieces
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'BUILT_IN') pieces = literal(node.initializer)
  ts.forEachChild(node, visit)
}
visit(source)
if (pieces?.length !== 31) throw new Error('Unexpected collection size')
await mkdir('packages/repertoire/scores', { recursive: true })
await mkdir('public/repertoire-licenses', { recursive: true })
await writeFile('public/repertoire-licenses/dacapo-MIT.txt', await download('LICENSE'))
const catalog = []
for (const piece of pieces) {
  const xml = await download(`src/pieces/library/${piece.id}.musicxml`)
  if (!xml.includes('<score-partwise')) throw new Error(`Not MusicXML: ${piece.id}`)
  await writeFile(`packages/repertoire/scores/${piece.id}.musicxml`, xml)
  catalog.push({ ...piece, revision, sha256: createHash('sha256').update(xml).digest('hex') })
}
await writeFile('packages/repertoire/catalog.json', `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Imported ${catalog.length} unchanged scores from ${revision}`)
