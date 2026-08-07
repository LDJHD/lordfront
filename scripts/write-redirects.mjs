// Réécrit la règle de proxy Netlify dans le dossier publié (.next-local) :
// les appels /api/* du navigateur sont redirigés vers le backend AdonisJS.
// Nécessaire pour les déploiements par téléversement direct du dossier de build,
// où le fichier netlify.toml n'est pas relu.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const backendUrl = process.env.BACKEND_URL ?? 'https://floralwhite-chimpanzee-459944.hostingersite.com'
const publishDir = join(process.cwd(), '.next-local')
const rule = `/api/* ${backendUrl}/:splat 200`

mkdirSync(publishDir, { recursive: true })
writeFileSync(join(publishDir, '_redirects'), `${rule}\n`)
console.log(`[write-redirects] ${rule}`)
