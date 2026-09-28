// Quotes are checked against the source text so a claim can't cite words
// the document never said. Markdown tables and line wraps are flattened
// before comparing.

export function flattenText(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function quoteAppearsIn(body: string, quote: string): boolean {
  const needle = flattenText(quote)
  return needle.length > 0 && flattenText(body).includes(needle)
}
