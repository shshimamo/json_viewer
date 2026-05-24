import { useState } from 'react'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const MAX_DEPTH = 3

function isPrimitive(v: JsonValue): boolean {
  return v === null || typeof v !== 'object'
}

function formatPrimitive(v: JsonValue): string {
  if (v === null) return 'null'
  if (typeof v === 'string') return `"${v}"`
  return String(v)
}

function CollapsedValue({ value }: { value: JsonValue }) {
  const [expanded, setExpanded] = useState(false)

  const label = Array.isArray(value)
    ? `[ ${value.length} items ]`
    : `{ ${Object.keys(value as object).length} keys }`

  return (
    <span>
      <button className="collapsed-btn" onClick={() => setExpanded(v => !v)}>
        {expanded ? '▾' : '▸'} {label}
      </button>
      {expanded && (
        <pre className="inline-json">{JSON.stringify(value, null, 2)}</pre>
      )}
    </span>
  )
}

function TableCell({ value, depth }: { value: JsonValue; depth: number }) {
  if (isPrimitive(value)) {
    return <span className={`cell-${typeof value === 'string' ? 'str' : typeof value === 'number' ? 'num' : typeof value === 'boolean' ? 'bool' : 'null'}`}>
      {formatPrimitive(value)}
    </span>
  }

  if (depth >= MAX_DEPTH) {
    return <CollapsedValue value={value} />
  }

  return <TableNode value={value} depth={depth} />
}

function TableNode({ value, depth }: { value: JsonValue; depth: number }) {
  if (isPrimitive(value)) {
    return <TableCell value={value} depth={depth} />
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as [string, JsonValue])
    : Object.entries(value as { [key: string]: JsonValue })

  return (
    <table className="nested-table">
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td className="cell-key">{k}</td>
            <td><TableCell value={v} depth={depth + 1} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function TableViewer({ value }: { value: JsonValue }) {
  return (
    <div className="table-viewer">
      <TableNode value={value} depth={0} />
    </div>
  )
}
