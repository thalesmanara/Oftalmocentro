import type { ReactNode } from 'react'

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|')
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim())
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim())
}

type Block =
  | { type: 'table'; rows: string[][] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string }

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    if (isTableRow(line)) {
      const rows: string[][] = []

      while (index < lines.length && isTableRow(lines[index])) {
        if (!isTableSeparator(lines[index])) {
          rows.push(parseTableRow(lines[index]))
        }
        index += 1
      }

      if (rows.length > 0) {
        blocks.push({ type: 'table', rows })
      }
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      })
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = []

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''))
        index += 1
      }

      blocks.push({ type: 'list', items })
      continue
    }

    const paragraphLines: string[] = []

    while (
      index < lines.length &&
      lines[index].trim() &&
      !isTableRow(lines[index]) &&
      !lines[index].match(/^#{1,3}\s+/) &&
      !/^[-*]\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index])
      index += 1
    }

    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') })
  }

  return blocks
}

function renderBlock(block: Block, key: number) {
  switch (block.type) {
    case 'table':
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {block.rows[0]?.map((cell, cellIndex) => (
                  <th key={cellIndex} className="px-3 py-2 font-semibold text-slate-700">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-100">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top text-slate-700">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'heading': {
      const className =
        block.level === 1
          ? 'text-lg font-bold text-slate-900'
          : block.level === 2
            ? 'text-base font-bold text-slate-900'
            : 'text-sm font-semibold text-slate-900'

      return (
        <p key={key} className={className}>
          {renderInline(block.text)}
        </p>
      )
    }

    case 'list':
      return (
        <ul key={key} className="list-disc space-y-1 pl-5 text-slate-700">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>
      )

    case 'paragraph':
      return (
        <p key={key} className="whitespace-pre-wrap text-slate-700">
          {renderInline(block.text)}
        </p>
      )
  }
}

export function SimpleMarkdown({ content }: { content: string }) {
  const blocks = parseBlocks(content)

  if (blocks.length === 0) {
    return <p className="whitespace-pre-wrap text-slate-500">—</p>
  }

  return <div className="space-y-3">{blocks.map(renderBlock)}</div>
}
