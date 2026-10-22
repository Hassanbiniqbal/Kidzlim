/** Plain-text excerpt of a Lexical rich-text value (first paragraph(s), trimmed to a length). */
type LexicalNode = { type?: string; text?: string; children?: LexicalNode[] }

function textOf(node: LexicalNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(textOf).join('')
}

export function plainExcerpt(value: unknown, maxLength = 180): string {
  const root = (value as { root?: LexicalNode } | null | undefined)?.root
  if (!root) return ''
  const paragraphs = (root.children ?? []).map((n) => textOf(n).trim()).filter(Boolean)
  const text = paragraphs[0] ?? ''
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
}
