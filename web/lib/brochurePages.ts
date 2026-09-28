// Turns a document's markdown into printed pages: measure, wrap, paginate,
// then draw each page onto a canvas that becomes a texture in the 3D book.

export interface PageTheme {
  paper: string
  ink: string
  muted: string
  rule: string
  stamp: string
  highlight: string
  display: string
  body: string
  mono: string
}

export const PAGE_WIDTH = 1000
export const PAGE_HEIGHT = 1360

const MARGIN_X = 86
const MARGIN_TOP = 96
const MARGIN_BOTTOM = 110

type Block =
  | {kind: 'h1'; text: string}
  | {kind: 'h2'; text: string}
  | {kind: 'meta'; text: string}
  | {kind: 'note'; text: string}
  | {kind: 'body'; text: string}
  | {kind: 'bullet'; text: string}
  | {kind: 'row'; cells: string[]}
  | {kind: 'rule'}

const clean = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()

export function parseDocument(markdown: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length) {
      blocks.push({kind: 'body', text: clean(paragraph.join(' '))})
      paragraph = []
    }
  }

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      flush()
      continue
    }
    if (/^\|[\s|:-]+\|$/.test(line) && line.includes('---')) continue // table separator row
    if (line.startsWith('# ')) {
      flush()
      blocks.push({kind: 'h1', text: clean(line.slice(2))})
    } else if (line.startsWith('## ')) {
      flush()
      blocks.push({kind: 'h2', text: clean(line.slice(3))})
    } else if (line.startsWith('> ')) {
      flush()
      blocks.push({kind: 'note', text: clean(line.slice(2))})
    } else if (line.startsWith('- ')) {
      flush()
      blocks.push({kind: 'bullet', text: clean(line.slice(2))})
    } else if (line.startsWith('|')) {
      flush()
      const cells = line.split('|').slice(1, -1).map(clean)
      if (cells.some(Boolean)) blocks.push({kind: 'row', cells})
    } else if (/^[-*_]{3,}$/.test(line)) {
      flush()
      blocks.push({kind: 'rule'})
    } else if (/^\*.+\*$/.test(line)) {
      flush()
      blocks.push({kind: 'meta', text: clean(line)})
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return blocks
}

interface Line {
  text: string
  x: number
  y: number
  font: string
  color: string
  highlight?: boolean
  align?: 'left' | 'right'
}

interface DrawnPage {
  lines: Line[]
  rules: Array<{y: number}>
  stamped: boolean
}

function wrap(context: CanvasRenderingContext2D, text: string, font: string, width: number): string[] {
  context.font = font
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (context.measureText(candidate).width > width && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Lays the document out across as many pages as it needs. */
export function paginate(
  context: CanvasRenderingContext2D,
  blocks: Block[],
  theme: PageTheme,
  highlight?: string,
): DrawnPage[] {
  const pages: DrawnPage[] = []
  let page: DrawnPage = {lines: [], rules: [], stamped: false}
  let y = MARGIN_TOP
  const width = PAGE_WIDTH - MARGIN_X * 2
  // A quote wraps across lines, so match on a short distinctive fragment
  // rather than the whole sentence.
  const words = (highlight ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9+\s.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const needle = words.length >= 2 ? words.slice(0, 3).join(' ') : undefined
  const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9+\s.,]/g, ' ').replace(/\s+/g, ' ')

  const fonts = {
    h1: `600 62px ${theme.display}`,
    h2: `600 34px ${theme.display}`,
    body: `24px ${theme.body}`,
    bullet: `24px ${theme.body}`,
    meta: `500 19px ${theme.mono}`,
    note: `italic 21px ${theme.body}`,
    row: `21px ${theme.mono}`,
  }

  const newPage = () => {
    pages.push(page)
    page = {lines: [], rules: [], stamped: false}
    y = MARGIN_TOP
  }

  const push = (text: string, font: string, color: string, lineHeight: number, options: Partial<Line> = {}) => {
    if (y + lineHeight > PAGE_HEIGHT - MARGIN_BOTTOM) newPage()
    const marked = Boolean(needle && normalise(text).includes(needle))
    if (marked) page.stamped = true
    page.lines.push({text, x: MARGIN_X, y, font, color, highlight: marked, ...options})
    y += lineHeight
  }

  for (const block of blocks) {
    switch (block.kind) {
      case 'h1':
        y += pages.length === 0 && page.lines.length === 0 ? 120 : 30
        for (const line of wrap(context, block.text, fonts.h1, width)) push(line, fonts.h1, theme.ink, 70)
        y += 14
        break
      case 'h2':
        y += 30
        for (const line of wrap(context, block.text, fonts.h2, width)) push(line, fonts.h2, theme.ink, 44)
        y += 8
        break
      case 'meta':
        for (const line of wrap(context, block.text.toUpperCase(), fonts.meta, width))
          push(line, fonts.meta, theme.muted, 30)
        y += 10
        break
      case 'note':
        for (const line of wrap(context, block.text, fonts.note, width - 40))
          push(line, fonts.note, theme.muted, 32, {x: MARGIN_X + 20})
        y += 12
        break
      case 'body':
        for (const line of wrap(context, block.text, fonts.body, width)) push(line, fonts.body, theme.ink, 36)
        y += 14
        break
      case 'bullet':
        for (const [index, line] of wrap(context, block.text, fonts.bullet, width - 34).entries())
          push(index === 0 ? `— ${line}` : `   ${line}`, fonts.bullet, theme.ink, 36)
        break
      case 'row': {
        const [label, ...rest] = block.cells
        if (y + 40 > PAGE_HEIGHT - MARGIN_BOTTOM) newPage()
        const marked = Boolean(needle && normalise(block.cells.join(' ')).includes(needle))
        if (marked) page.stamped = true
        page.lines.push({text: label, x: MARGIN_X, y, font: fonts.row, color: theme.ink, highlight: marked})
        if (rest.length) {
          page.lines.push({
            text: rest.join('   '),
            x: PAGE_WIDTH - MARGIN_X,
            y,
            font: fonts.row,
            color: theme.muted,
            align: 'right',
          })
        }
        y += 38
        page.rules.push({y: y - 12})
        break
      }
      case 'rule':
        y += 12
        page.rules.push({y})
        y += 22
        break
    }
  }
  pages.push(page)
  // Books have leaves, so pages come in pairs.
  if (pages.length % 2 === 1) pages.push({lines: [], rules: [], stamped: false})
  return pages
}

export function drawPage(
  canvas: HTMLCanvasElement,
  page: DrawnPage,
  pageNumber: number,
  theme: PageTheme,
  stampText: string,
) {
  const context = canvas.getContext('2d')
  if (!context) return
  canvas.width = PAGE_WIDTH
  canvas.height = PAGE_HEIGHT

  context.fillStyle = theme.paper
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

  for (const rule of page.rules) {
    context.strokeStyle = theme.rule
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(MARGIN_X, rule.y)
    context.lineTo(PAGE_WIDTH - MARGIN_X, rule.y)
    context.stroke()
  }

  for (const line of page.lines) {
    context.font = line.font
    context.textAlign = line.align === 'right' ? 'right' : 'left'
    context.textBaseline = 'alphabetic'
    if (line.highlight) {
      const width = context.measureText(line.text).width
      context.fillStyle = theme.highlight
      const left = line.align === 'right' ? line.x - width : line.x
      context.fillRect(left - 6, line.y - 24, width + 12, 34)
    }
    context.fillStyle = line.color
    context.fillText(line.text, line.x, line.y)
  }

  if (page.stamped) {
    context.save()
    context.translate(PAGE_WIDTH - 300, PAGE_HEIGHT - 190)
    context.rotate(-0.14)
    context.strokeStyle = theme.stamp
    context.fillStyle = theme.stamp
    context.lineWidth = 4
    context.strokeRect(-150, -42, 300, 84)
    context.font = `500 22px ${theme.mono}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const words = stampText.toUpperCase().split(' ')
    const half = Math.ceil(words.length / 2)
    context.fillText(words.slice(0, half).join(' '), 0, -14)
    context.fillText(words.slice(half).join(' '), 0, 16)
    context.restore()
  }

  if (page.lines.length) {
    context.font = `18px ${theme.mono}`
    context.fillStyle = theme.muted
    context.textAlign = 'center'
    context.fillText(String(pageNumber), PAGE_WIDTH / 2, PAGE_HEIGHT - 56)
  }
}
