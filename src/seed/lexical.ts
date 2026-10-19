/**
 * Tiny builder for Lexical rich-text JSON so seed content stays readable.
 * Supports **bold** and [label](url) inline; headings, paragraphs and bullet lists.
 */
import type { RichTextBlock } from '../payload-types'

type Node = Record<string, unknown>

export type Block = { h2: string } | { h3: string } | { p: string } | { ul: string[] }

const base = { direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }

function inline(text: string): Node[] {
  const nodes: Node[] = []
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g
  let last = 0
  let m: RegExpExecArray | null
  const textNode = (t: string, format = 0): Node => ({
    type: 'text',
    text: t,
    format,
    detail: 0,
    mode: 'normal',
    style: '',
    version: 1,
  })
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(textNode(text.slice(last, m.index)))
    if (m[1]) nodes.push(textNode(m[1], 1))
    else
      nodes.push({
        ...base,
        type: 'link',
        version: 3,
        fields: { linkType: 'custom', url: m[3], newTab: m[3].startsWith('http') },
        children: [textNode(m[2])],
      })
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(textNode(text.slice(last)))
  return nodes
}

function block(b: Block): Node {
  if ('h2' in b) return { ...base, type: 'heading', tag: 'h2', children: inline(b.h2) }
  if ('h3' in b) return { ...base, type: 'heading', tag: 'h3', children: inline(b.h3) }
  if ('ul' in b)
    return {
      ...base,
      type: 'list',
      listType: 'bullet',
      tag: 'ul',
      start: 1,
      children: b.ul.map((item, i) => ({ ...base, type: 'listitem', value: i + 1, children: inline(item) })),
    }
  return { ...base, type: 'paragraph', textFormat: 0, textStyle: '', children: inline(b.p) }
}

export type RichTextContent = RichTextBlock['content']

export function lexical(blocks: Block[]): RichTextContent {
  return {
    root: { ...base, type: 'root', children: blocks.map(block) as RichTextContent['root']['children'] },
  }
}

export const md = (text: string) => lexical(text.split(/\n{2,}/).map((p) => ({ p: p.trim() })))
