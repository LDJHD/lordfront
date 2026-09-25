// Génère les fiches règles PDF des 4 jeux de THE LORD GAMES.
// Encodage PDF écrit à la main (aucune dépendance), dans l'esprit de generate-pwa-icons.mjs.
// Usage : node scripts/generate-rules-pdf.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = join(frontendRoot, 'public', 'regles')

// ---------------------------------------------------------------- encodage texte
// Les polices de base (Helvetica…) utilisent WinAnsi (proche Latin-1).
function winAnsi(text) {
  const map = { '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u00a0': ' ', '\u202f': ' ', '\u20ac': '\u0080' }
  return text.replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026\u00a0\u202f]/g, (ch) => map[ch] ?? ch)
}
function escapePdf(text) {
  return winAnsi(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}
// Découpe un texte en lignes qui tiennent dans la largeur utile (~0.5 em par caractère).
function wrap(text, size, maxWidth) {
  const maxChars = Math.max(10, Math.floor(maxWidth / (size * 0.5)))
  const lines = []
  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim()) { lines.push(''); continue }
    let current = ''
    for (const word of rawLine.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length <= maxChars) current = candidate
      else {
        if (current) lines.push(current)
        if (word.length <= maxChars) current = word
        else {
          let rest = word
          while (rest.length > maxChars) { lines.push(rest.slice(0, maxChars)); rest = rest.slice(maxChars) }
          current = rest
        }
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

// ---------------------------------------------------------------- modèle de page
const PAGE_W = 595.28 // A4 en points
const PAGE_H = 841.89
const MARGIN_X = 54
const CONTENT_W = PAGE_W - 2 * MARGIN_X
const PAGE_TOP = PAGE_H - 70 // sous le bandeau d'en-tête
const PAGE_BOTTOM = 60

const COLORS = {
  ink: [32 / 255, 26 / 255, 42 / 255], // #201a2a
  pink: [233 / 255, 86 / 255, 130 / 255], // #e95682
  gold: [243 / 255, 169 / 255, 79 / 255], // #f3a94f
  purple: [117 / 255, 86 / 255, 238 / 255], // #7556ee
  muted: [118 / 255, 111 / 255, 125 / 255], // #766f7d
  cream: [255 / 255, 250 / 255, 244 / 255], // #fffaf4
  pill: [0.88, 0.86, 0.97], // violet très clair
  band: [0.94, 0.92, 0.96], // fond de ligne de tableau
}
function rgbs(color) {
  const [r, g, b] = color
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`
}

// Construit les opérations de dessin de chaque page (découpage automatique).
// Opérations : {t:'text'|'rect'|'circle', ...}
function renderDoc(doc) {
  const pages = []
  let ops = []
  let y = PAGE_TOP

  const newPage = () => { pages.push(ops); ops = []; y = PAGE_TOP - 6 }
  const ensure = (needed) => { if (y - needed < PAGE_BOTTOM) newPage() }

  const text = (x, yy, value, font, size, color, align) => ops.push({ t: 'text', x, y: yy, text: value, font, size, color, align })

  // Titre + accroche
  text(MARGIN_X, y - 20, doc.title, 'bold', 25, COLORS.ink)
  y -= 36
  ops.push({ t: 'rect', color: COLORS.gold, rect: [MARGIN_X, y + 2, 34, 2.5] })
  y -= 12
  for (const line of wrap(doc.tagline, 11, CONTENT_W)) {
    text(MARGIN_X, y, line, 'italic', 11, COLORS.muted)
    y -= 15
  }
  y -= 8

  for (const section of doc.sections) {
    ensure(56)
    y -= 10
    ops.push({ t: 'rect', color: COLORS.ink, rect: [MARGIN_X, y - 22, CONTENT_W, 22] })
    text(MARGIN_X + 10, y - 15, section.title.toUpperCase(), 'bold', 11.5, [1, 1, 1])
    y -= 34

    for (const item of section.items) {
      switch (item.kind) {
        case 'para': {
          const lines = wrap(item.text, 10.5, CONTENT_W)
          ensure(lines.length * 14 + 10)
          for (const line of lines) {
            text(MARGIN_X, y - 11, line, 'regular', 10.5, COLORS.ink)
            y -= 14
          }
          y -= 5
          break
        }
        case 'bullets': {
          for (const entry of item.items) {
            const lines = wrap(entry, 10, CONTENT_W - 16)
            ensure(lines.length * 13.5 + 4)
            ops.push({ t: 'circle', x: MARGIN_X + 4, y: y - 6.5, r: 2, color: COLORS.pink })
            for (const line of lines) {
              text(MARGIN_X + 14, y - 10, line, 'regular', 10, COLORS.ink)
              y -= 13.5
            }
          }
          y -= 5
          break
        }
        case 'numbered': {
          let n = 0
          for (const entry of item.items) {
            n += 1
            const lines = wrap(entry, 10, CONTENT_W - 22)
            ensure(lines.length * 13.5 + 6)
            ops.push({ t: 'circle', x: MARGIN_X + 7, y: y - 6.5, r: 6.5, color: COLORS.purple })
            text(MARGIN_X + 7, y - 9.3, String(n), 'bold', 7.5, [1, 1, 1], 'center')
            for (const line of lines) {
              text(MARGIN_X + 22, y - 10, line, 'regular', 10, COLORS.ink)
              y -= 13.5
            }
          }
          y -= 5
          break
        }
        case 'roles': {
          for (const [role, desc] of item.rows) {
            const lines = wrap(desc, 9.5, CONTENT_W - 140)
            const rowH = Math.max(22, lines.length * 12.5 + 10)
            ensure(rowH + 4)
            ops.push({ t: 'rect', color: COLORS.band, rect: [MARGIN_X, y - rowH, CONTENT_W, rowH - 2] })
            text(MARGIN_X + 8, y - 12, role, 'bold', 9.5, COLORS.pink)
            let ly = y - 12
            for (const line of lines) {
              text(MARGIN_X + 130, ly, line, 'regular', 9.5, COLORS.ink)
              ly -= 12.5
            }
            y -= rowH + 3
          }
          y -= 4
          break
        }
        case 'flow': {
          const size = 9.5
          const pillH = 20
          const arrowW = 16
          const widths = item.items.map((label) => 20 + label.length * size * 0.55)
          const total = widths.reduce((a, b) => a + b, 0) + arrowW * (item.items.length - 1)
          const pillY = y - pillH - 8
          ensure(pillH + 26)
          ops.push({ t: 'rect', color: COLORS.band, rect: [MARGIN_X, pillY - 6, CONTENT_W, pillH + 12] })
          let x = MARGIN_X + Math.max(0, (CONTENT_W - total) / 2)
          item.items.forEach((label, index) => {
            ops.push({ t: 'rect', color: COLORS.pill, rect: [x, pillY, widths[index], pillH] })
            text(x + widths[index] / 2, pillY + 6.5, label, 'bold', size, COLORS.purple, 'center')
            x += widths[index]
            if (index < item.items.length - 1) {
              text(x + arrowW / 2, pillY + 6.5, '>', 'bold', size, COLORS.pink, 'center')
              x += arrowW
            }
          })
          y = pillY - 16
          break
        }
        case 'quote': {
          const lines = wrap(item.text, 10, CONTENT_W - 24)
          ensure(lines.length * 14 + 12)
          ops.push({ t: 'rect', color: COLORS.gold, rect: [MARGIN_X, y - lines.length * 14 - 4, 3, lines.length * 14 + 8] })
          let ly = y - 12
          for (const line of lines) {
            text(MARGIN_X + 14, ly, line, 'italic', 10, COLORS.ink)
            ly -= 14
          }
          y = ly - 4
          break
        }
      }
    }
  }

  // Pied de document
  ensure(48)
  ops.push({ t: 'rect', color: COLORS.gold, rect: [MARGIN_X, y, CONTENT_W, 1.2] })
  y -= 16
  for (const line of wrap(`THE LORD GAMES — ${doc.footer} Bonne partie !`, 8.5, CONTENT_W)) {
    text(MARGIN_X, y, line, 'regular', 8.5, COLORS.muted)
    y -= 11
  }

  pages.push(ops)
  return pages
}

function approxTextWidth(text, font, size) {
  const factor = font === 'bold' ? 0.58 : 0.5
  return text.length * size * factor
}

const FONT_IDS = { bold: 'F1', regular: 'F2', italic: 'F3' }

function serializePage(ops, pageIndex, pageCount, docTitle) {
  const parts = []
  // Bandeau d'en-tête (chaque page)
  parts.push(`q ${rgbs(COLORS.cream)} 0 ${PAGE_H - 46} ${PAGE_W} 46 re f Q`)
  parts.push(`q ${rgbs(COLORS.gold)} ${MARGIN_X} ${PAGE_H - 47.5} ${CONTENT_W} 2.5 re f Q`)
  parts.push(`BT ${rgbs(COLORS.ink)} /F1 11 Tf 1 0 0 1 ${MARGIN_X} ${PAGE_H - 29} Td (THE LORD) Tj ET`)
  parts.push(`BT ${rgbs(COLORS.pink)} /F1 11 Tf 1 0 0 1 ${MARGIN_X + 60} ${PAGE_H - 29} Td (GAMES) Tj ET`)
  parts.push(`BT ${rgbs(COLORS.muted)} /F3 9 Tf 1 0 0 1 ${PAGE_W - MARGIN_X} ${PAGE_H - 29} Td (Fiche regles) Tj ET`)
  // Contenu
  for (const op of ops) {
    switch (op.t) {
      case 'text': {
        const width = op.align === 'center' || op.align === 'right' ? approxTextWidth(op.text, op.font ?? 'regular', op.size) : 0
        const dx = op.align === 'center' ? -width / 2 : op.align === 'right' ? -width : 0
        parts.push(`BT ${rgbs(op.color ?? COLORS.ink)} /${FONT_IDS[op.font ?? 'regular']} ${op.size} Tf 1 0 0 1 ${(op.x + dx).toFixed(2)} ${op.y.toFixed(2)} Td (${escapePdf(op.text)}) Tj ET`)
        break
      }
      case 'rect': {
        const [rx, ry, rw, rh] = op.rect
        parts.push(`q ${rgbs(op.color)} ${rx.toFixed(2)} ${ry.toFixed(2)} ${rw.toFixed(2)} ${rh.toFixed(2)} re f Q`)
        break
      }
      case 'circle': {
        const { x, y: cy, r } = op
        const k = 0.5523 * r
        parts.push(`q ${rgbs(op.color)}`)
        parts.push(`${x.toFixed(2)} ${(cy + r).toFixed(2)} m`)
        parts.push(`${(x + k).toFixed(2)} ${(cy + r).toFixed(2)} ${(x + r).toFixed(2)} ${(cy + k).toFixed(2)} ${(x + r).toFixed(2)} ${cy.toFixed(2)} c`)
        parts.push(`${(x + r).toFixed(2)} ${(cy - k).toFixed(2)} ${(x + k).toFixed(2)} ${(cy - r).toFixed(2)} ${x.toFixed(2)} ${(cy - r).toFixed(2)} c`)
        parts.push(`${(x - k).toFixed(2)} ${(cy - r).toFixed(2)} ${(x - r).toFixed(2)} ${(cy - k).toFixed(2)} ${(x - r).toFixed(2)} ${cy.toFixed(2)} c`)
        parts.push(`${(x - r).toFixed(2)} ${(cy + k).toFixed(2)} ${(x - k).toFixed(2)} ${(cy + r).toFixed(2)} ${x.toFixed(2)} ${(cy + r).toFixed(2)} c f Q`)
        break
      }
    }
  }
  // Pied de page : pagination
  parts.push(`BT ${rgbs(COLORS.muted)} /F2 8 Tf 1 0 0 1 ${MARGIN_X} 34 Td (${escapePdf(docTitle)}) Tj ET`)
  parts.push(`BT ${rgbs(COLORS.muted)} /F2 8 Tf 1 0 0 1 ${PAGE_W - MARGIN_X} 34 Td (Page ${pageIndex + 1}/${pageCount}) Tj ET`)
  return parts.join('\n')
}

function buildPdf(doc) {
  const pages = renderDoc(doc)
  const pageStreams = pages.map((ops, index) => serializePage(ops, index, pages.length, doc.title))

  const n = pageStreams.length
  const pageIds = pageStreams.map((_, i) => 3 + i)
  const contentIds = pageStreams.map((_, i) => 3 + n + i)
  const fontBoldId = 3 + 2 * n
  const fontRegId = fontBoldId + 1
  const fontItalicId = fontRegId + 1

  const objects = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Count ${n} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`)
  for (let i = 0; i < n; i++) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontBoldId} 0 R /F2 ${fontRegId} 0 R /F3 ${fontItalicId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`)
  }
  for (let i = 0; i < n; i++) {
    const stream = pageStreams[i]
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>')

  const chunks = []
  let position = 0
  const push = (buf) => { chunks.push(buf); position += buf.length }
  push(Buffer.from('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n', 'latin1'))
  const offsets = []
  objects.forEach((body, index) => {
    offsets.push(position)
    push(Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, 'latin1'))
  })
  const xrefStart = position
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  push(Buffer.from(xref, 'latin1'))
  return Buffer.concat(chunks)
}

// ---------------------------------------------------------------- contenus des 4 fiches
const docs = [
  // ------------------------------------------------------------------ VERITE
  {
    id: 'verites-en-jeu',
    title: 'Vérités en Jeu',
    tagline: 'Le jeu de questions qui fait rire, rougir et rapprocher — sans jamais dépasser les limites.',
    footer: 'Jeu de questions et réponses pour 2 à 12 joueurs.',
    sections: [
      {
        title: 'Présentation',
        items: [
          { kind: 'para', text: "Vérités en Jeu (aussi appelé « Dis-moi en un peu plus ») est un jeu de questions-réponses en ligne. À chaque tour, un joueur choisit une question et la pose à un autre joueur désigné automatiquement. La réponse est ensuite soumise à l'approbation de celui qui a posé la question." },
          { kind: 'bullets', items: ["Nombre de joueurs : 2 à 12 (en ligne, via lien d'invitation).", 'Durée : session payante de 1 à 5 heures (500 FCFA par heure).', 'Support : navigateur web, sur téléphone ou ordinateur.', 'Ambiance : complicité, fous rires, petites confidences — aucun contenu explicite.'] },
        ],
      },
      {
        title: 'Les niveaux de questions',
        items: [
          { kind: 'para', text: "Le jeu contient 100 questions réparties en 4 niveaux de difficulté croissante. Le niveau s'affiche avant chaque question pour prévenir l'ambiance à venir." },
          { kind: 'bullets', items: [
            'Niveau 1 — Brise-glace : questions légères pour découvrir les autres en douceur.',
            'Niveau 2 — Drôle et embarrassant : petits moments de honte et confidences amusantes.',
            'Niveau 3 — Coquin et taquin : questions de séduction, sans jamais être explicites.',
            'Niveau 4 — Vérités piquantes : les questions les plus intimes pour les plus courageux.',
          ] },
          { kind: 'quote', text: "Règle anti-répétition : une question déjà posée dans la partie ne peut plus revenir. Chaque question n'apparaît qu'une seule fois par session." },
        ],
      },
      {
        title: 'Les acteurs',
        items: [
          { kind: 'roles', rows: [
            ['Le poseur', "Joueur dont c'est le tour : il choisit la question (au hasard ou dans la liste). Il valide ou refuse la réponse reçue."],
            ['La cible', "Joueur désigné pour répondre à la question. Il rédige sa réponse librement puis l'envoie au poseur."],
            ["L'organisateur", "Joueur qui a créé la partie : il partage le lien d'invitation et approuve chaque participant avant le lancement."],
            ['Les participants', "Joueurs invités qui entrent leur e-mail puis leur nom sur le lien ; le nom saisi est utilisé pendant toute la partie."],
          ] },
        ],
      },
      {
        title: "Déroulement d'une partie",
        items: [
          { kind: 'numbered', items: [
            "L'organisateur active la session avec le code reçu après paiement, puis copie le lien d'invitation.",
            "Chaque joueur ouvre le lien, saisit son e-mail puis son nom, et attend l'approbation de l'organisateur.",
            "Une fois tous les joueurs approuvés, la partie commence : l'ordre des tours est établi automatiquement.",
            "Au tour d'un joueur : le niveau de la question s'affiche, puis il tire une question (aléatoire ou choisie dans la liste).",
            "La question est envoyée à la cible désignée (le joueur suivant), qui rédige sa réponse.",
            "Le poseur lit la réponse : il l'approuve (le tour suivant démarre) ou la refuse (la cible modifie et renvoie).",
            "Le tour passe au joueur suivant, jusqu'à la fin du temps de session.",
          ] },
          { kind: 'para', text: "Si un joueur met du temps à répondre, une alerte rappelle à tous les participants que la partie attend encore sa réponse." },
          { kind: 'flow', items: ['Tour', 'Niveau', 'Question', 'Réponse', 'Validation'] },
        ],
      },
      {
        title: 'Connexion et sécurité',
        items: [
          { kind: 'bullets', items: [
            "Le lien d'invitation expire à la fin du temps payé (de 1 à 5 heures selon le code).",
            "En cas de déconnexion, le joueur revient sur le même lien avec son code : il retrouve la partie en cours s'il reste du temps.",
            "Les questions ne peuvent pas être copiées depuis l'interface.",
            "Le nom saisi à la connexion identifie le joueur pendant toute la session.",
          ] },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ WEREWOLF
  {
    id: 'village-secret',
    title: 'Village Secret (Loups-Garous)',
    tagline: 'La nuit tombe sur le village. Trouvez les loups avant que le village ne disparaisse.',
    footer: 'Jeu de rôles et de bluff pour 5 à 18 joueurs.',
    sections: [
      {
        title: 'Présentation',
        items: [
          { kind: 'para', text: "Village Secret est la version en ligne du jeu des Loups-Garous. Chaque joueur reçoit un rôle secret : la majorité forme le village, une minorité cachée est constituée de Loups-Garous. La partie alterne nuits (les rôles agissent en secret) et jours (le village débat et vote)." },
          { kind: 'bullets', items: [
            "Nombre de joueurs : 5 à 18 (en ligne, via lien d'invitation).",
            'Durée : session payante de 1 à 5 heures (500 FCFA par heure).',
            'Communication : chat du village le jour, chat privé entre Loups la nuit.',
            'Objectif : le village doit éliminer tous les Loups ; les Loups doivent devenir aussi nombreux que les villageois.',
          ] },
        ],
      },
      {
        title: 'Les rôles selon le nombre de joueurs',
        items: [
          { kind: 'para', text: 'Le jeu distribue automatiquement les rôles en fonction du nombre de participants :' },
          { kind: 'roles', rows: [
            ['Loup-Garou', "1 Loup (5-8 joueurs), 2 Loups (9-14), 3 Loups (15 et plus). Chaque nuit, ils choisissent ensemble une victime via leur chat privé."],
            ['Voyante', "Présente dès 6 joueurs. Chaque nuit, elle découvre le rôle (Villageois ou Loup) d'un joueur de son choix."],
            ['Cupidon', "Présent dès 6 joueurs. La première nuit, il désigne deux amoureux : si l'un meurt, l'autre meurt de chagrin. Le couple peut former un troisième camp vainqueur."],
            ['Chasseur', "Présent dès 7 joueurs. S'il meurt, il a le droit de tirer une dernière balle sur le joueur de son choix, qui meurt avec lui."],
            ['Sorcière', "Présente dès 8 joueurs. Elle possède une potion de vie (sauver la victime des Loups) et une potion de mort (éliminer un joueur), chacune utilisable une seule fois par partie."],
            ['Petite Fille', "Présente dès 11 joueurs. La nuit, elle peut espionner discrètement l'identité des Loups actifs."],
            ['Chef du village', "Présent dès 12 joueurs. En cas d'égalité au vote du jour, c'est lui qui décide seul du joueur éliminé."],
            ['Villageois', "Complètent le village. Sans pouvoir la nuit, leur force : observer, débattre et voter le jour."],
          ] },
        ],
      },
      {
        title: "Déroulement d'une partie",
        items: [
          { kind: 'numbered', items: [
            "Révélation des rôles : chaque joueur consulte seul son rôle secret sur son écran et le mémorise.",
            "Nuit 1 : Cupidon désigne les deux amoureux. Puis, chaque nuit : la Voyante observe, la Petite Fille espionne, les Loups se concertent et désignent une victime, la Sorcière décide d'utiliser (ou non) ses potions.",
            "Le jour se lève : le jeu annonce les morts de la nuit. Les joueurs débattent via le chat du village pendant 5 minutes.",
            "Vote du jour : chaque survivant vote pour éliminer un suspect. Si tout le monde vote avant la fin des 5 minutes, le résultat est appliqué immédiatement.",
            "Résultat du vote : le joueur désigné est éliminé. En cas d'égalité, le Chef du village tranche.",
            "Mort du Chasseur : s'il est éliminé, il tire une dernière balle avant que la partie ne continue.",
            "La partie alterne nuit et jour jusqu'à la victoire d'un camp.",
          ] },
          { kind: 'flow', items: ['Rôles', 'Nuit', 'Annonce', 'Débat 5 min', 'Vote'] },
          { kind: 'para', text: "Alerte de participation : si des joueurs n'ont pas agi pendant la nuit, une alerte indique à tous les noms des personnes encore attendues." },
        ],
      },
      {
        title: 'Conditions de victoire',
        items: [
          { kind: 'bullets', items: [
            'Victoire du village : tous les Loups-Garous ont été éliminés.',
            'Victoire des Loups : les Loups sont aussi nombreux que les villageois survivants.',
            "Victoire des amoureux : le couple formé par Cupidon est le dernier survivant.",
            "L'organisateur peut relancer une nouvelle partie avec le même groupe tant que la session est active.",
          ] },
        ],
      },
      {
        title: 'Connexion et sécurité',
        items: [
          { kind: 'bullets', items: [
            "Rôles strictement secrets : chaque rôle n'apparaît que sur l'écran de son propriétaire.",
            "Le lien d'invitation expire à la fin du temps payé ; en cas de déconnexion, on revient sur le même lien tant qu'il reste du temps.",
            "Les joueurs éliminés restent observateurs silencieux : ils ne peuvent plus agir ni voter.",
          ] },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ A3
  {
    id: 'a3',
    title: 'À 3',
    tagline: 'Pierre, feuille, ciseaux… puis le gagnant pose sa question. Duel rapide, éclats de rire garantis.',
    footer: 'Duel de rapidité et de culot pour 2 joueurs.',
    sections: [
      {
        title: 'Présentation',
        items: [
          { kind: 'para', text: "À 3 est un duel en ligne à deux joueurs. Chaque manche commence par un décompte de 3 : les deux joueurs choisissent simultanément entre Pierre, Feuille et Ciseaux. Le résultat s'affiche avec une petite phrase justifiant le vainqueur, puis le gagnant obtient le droit de poser une question ou une demande à l'autre joueur." },
          { kind: 'bullets', items: [
            "Nombre de joueurs : 2 (en ligne, via lien d'invitation approuvé par le créateur).",
            'Durée : session payante de 1 à 5 heures (500 FCFA par heure).',
            'Rythme : manches courtes et enchaînées, à volonté tant que la session est active.',
          ] },
        ],
      },
      {
        title: 'Les acteurs',
        items: [
          { kind: 'roles', rows: [
            ['Le créateur', "Joueur qui a payé la session : il active le code, copie le lien et approuve l'arrivée du second joueur avant le premier coup."],
            ["L'invité", "Joueur qui rejoint via le lien : il saisit son e-mail puis son nom, et attend l'approbation du créateur."],
            ['Le gagnant', "Joueur vainqueur de la manche : il rédige la question ou la demande posée à son adversaire."],
            ['Le perdant', 'Joueur vaincu : il doit répondre honnêtement à la question reçue.'],
          ] },
        ],
      },
      {
        title: 'Qui bat qui ?',
        items: [
          { kind: 'bullets', items: [
            'La Pierre écrase les Ciseaux.',
            'Les Ciseaux coupent la Feuille.',
            'La Feuille enveloppe la Pierre.',
            "Choix identiques : égalité, la manche est immédiatement rejouée.",
          ] },
        ],
      },
      {
        title: "Déroulement d'une manche",
        items: [
          { kind: 'numbered', items: [
            "Décompte : 3, 2, 1… puis « Choisissez ! » s'affiche chez les deux joueurs en même temps.",
            "Chaque joueur sélectionne Pierre, Feuille ou Ciseaux ; son choix reste secret jusqu'à ce que les deux aient joué.",
            "Révélation : les deux choix s'affichent côte à côte, avec la phrase de victoire expliquant l'élément gagnant.",
            "En cas d'égalité, la manche est relancée automatiquement.",
            "Le gagnant rédige sa question (ou sa demande) et l'envoie à l'adversaire.",
            "Le perdant écrit sa réponse et l'envoie.",
            "Le gagnant examine la réponse : s'il est satisfait, il lance la manche suivante ; sinon, il demande une nouvelle réponse.",
            "Le bouton « Rejouer » relance une manche à tout moment après la révélation.",
          ] },
          { kind: 'flow', items: ['Décompte', 'Choix', 'Révélation', 'Question', 'Réponse'] },
        ],
      },
      {
        title: 'Connexion et sécurité',
        items: [
          { kind: 'bullets', items: [
            "Les choix restent secrets jusqu'à ce que les deux joueurs aient joué.",
            "En cas de déconnexion, chaque joueur retrouve sa partie via le même lien tant que la session est active.",
            "Le lien expire à la fin du temps payé (1 à 5 heures).",
          ] },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ DAMES
  {
    id: 'dames-internationales',
    title: 'Dames Internationales',
    tagline: 'Damier 10×10, 20 pions par joueur. Capturez, devenez Dame, remportez la partie.',
    footer: 'Jeu de stratégie pour 2 joueurs — règles internationales.',
    sections: [
      {
        title: 'Présentation et mise en place',
        items: [
          { kind: 'para', text: "Le jeu de dames international se joue à deux sur un damier de 10 lignes × 10 colonnes (100 cases). Seules les cases foncées sont utilisées. Chaque joueur dispose de 20 pions posés sur les quatre premières rangées de son côté. Le joueur aux pions clairs (Blancs) commence toujours." },
          { kind: 'bullets', items: [
            "Nombre de joueurs : 2 (en ligne, via lien d'invitation approuvé par le créateur).",
            'Damier : 100 cases, seules les 50 cases foncées sont jouables.',
            'Matériel : 20 pions par joueur (Blancs et Noirs).',
            'Durée : session payante de 1 à 5 heures (500 FCFA par heure).',
          ] },
        ],
      },
      {
        title: 'Déplacement des pions',
        items: [
          { kind: 'bullets', items: [
            "Un pion avance d'une case en diagonale vers l'avant, sur une case libre.",
            "Un pion ne recule jamais (sauf pendant une capture, selon les règles internationales).",
          ] },
        ],
      },
      {
        title: 'Captures',
        items: [
          { kind: 'bullets', items: [
            "Si un pion adverse est en diagonale devant lui et que la case derrière est libre, le pion saute par-dessus et capture : le pion adverse est retiré.",
            'La prise est OBLIGATOIRE : si une capture existe, le joueur doit la jouer.',
            "Prises multiples : après une capture, si le même pion peut encore capturer, il doit continuer jusqu'au bout de la chaîne.",
            "Meilleure prise : si plusieurs captures sont possibles, le joueur doit choisir la séquence qui capture le plus grand nombre de pièces.",
            "Capture en arrière : lors d'une prise, un pion peut sauter vers l'arrière (règle internationale).",
          ] },
        ],
      },
      {
        title: 'La Dame',
        items: [
          { kind: 'bullets', items: [
            "Promotion : un pion qui atteint la dernière rangée adverse devient une Dame (marquée d'une couronne).",
            "Déplacement : la Dame glisse librement en diagonale, vers l'avant ou l'arrière, sur plusieurs cases tant que le chemin est libre.",
            "Capture : la Dame saute un pion adverse situé à distance et atterrit sur n'importe quelle case libre derrière ce pion.",
            "Comme pour les pions, la capture avec la Dame est obligatoire et peut s'enchaîner plusieurs fois dans le même tour.",
          ] },
        ],
      },
      {
        title: 'Fin de la partie',
        items: [
          { kind: 'bullets', items: [
            "Un joueur gagne si son adversaire n'a plus de pièces ou ne peut plus jouer aucun coup légal.",
            "La partie est nulle si aucun joueur ne peut progresser, si une même position se répète, ou si les deux joueurs acceptent le match nul (proposition à confirmer des deux côtés).",
          ] },
        ],
      },
      {
        title: 'Rythme et outils en ligne',
        items: [
          { kind: 'bullets', items: [
            "Chrono par tour : chaque joueur dispose de 5 minutes maximum pour jouer son coup. Un avertissement s'affiche à l'approche de l'expiration.",
            "Pause : chaque joueur dispose d'un bouton Pause. La pause n'est effective qu'après confirmation de l'adversaire ; le bouton devient « Continuer », lui aussi soumis à confirmation. Personne ne peut jouer pendant la pause.",
            "Chat intégré : les deux joueurs peuvent s'écrire à tout moment, même pendant la pause.",
            "Coups gagnants : quand une capture est possible pour le joueur qui a la main, le jeu lui montre les coups disponibles.",
            'Historique : la liste des coups joués est consultable pendant la partie.',
          ] },
        ],
      },
      {
        title: "Déroulement d'une partie",
        items: [
          { kind: 'numbered', items: [
            "Le créateur active la session, copie le lien d'invitation ; l'invité rejoint et est approuvé.",
            "Les Blancs (pions clairs) commencent ; les joueurs jouent chacun leur tour.",
            "À chaque tour : s'il existe une capture, elle est obligatoire ; sinon, le joueur déplace un pion ou une Dame.",
            "Les pions atteignant la dernière rangée adverse sont promus Dames.",
            "La partie se poursuit jusqu'à la victoire d'un joueur ou au match nul.",
            "S'il reste du temps de session, le bouton « Rejouer » permet de relancer une nouvelle partie avec confirmation des deux joueurs.",
          ] },
        ],
      },
      {
        title: 'Conseils de jeu',
        items: [
          { kind: 'bullets', items: [
            "Contrôlez le centre du damier : c'est là que se jouent les prises.",
            'Évitez de laisser des pions isolés sur les ailes.',
            "Cherchez à obtenir une Dame rapidement, mais sans sacrifier votre structure.",
            "Anticipez plusieurs coups à l'avance et comptez les prises avant de bouger.",
            "N'échangez pas vos pions sans raison : chaque pion compte en fin de partie.",
            'Protégez vos Dames : elles sont souvent décisives.',
          ] },
        ],
      },
    ],
  },
]

// ---------------------------------------------------------------- main
mkdirSync(OUT_DIR, { recursive: true })
for (const doc of docs) {
  const pdf = buildPdf(doc)
  const out = join(OUT_DIR, `${doc.id}.pdf`)
  writeFileSync(out, pdf, 'latin1')
  console.log(`[regles] ${out} (${(pdf.length / 1024).toFixed(1)} Ko, ${doc.title})`)
}
