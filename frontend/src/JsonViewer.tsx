import { useState } from 'react'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function JsonNode({ value, depth = 0 }: { value: JsonValue; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)

  if (value === null) return <span className="null">null</span>
  if (typeof value === 'boolean') return <span className="bool">{String(value)}</span>
  if (typeof value === 'number') return <span className="num">{value}</span>
  if (typeof value === 'string') return <span className="str">"{value}"</span>

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="bracket">[]</span>
    return (
      <span>
        <button className="toggle" onClick={() => setOpen(v => !v)}>
          {open ? '▾' : '▸'}
        </button>
        <span className="bracket">[</span>
        {open ? (
          <div className="indent">
            {value.map((item, i) => (
              <div key={i} className="row">
                <span className="index">{i}</span>
                <span className="colon">:</span>
                <JsonNode value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        ) : (
          <span className="summary">{value.length} items</span>
        )}
        <span className="bracket">]</span>
      </span>
    )
  }

  const entries = Object.entries(value)
  if (entries.length === 0) return <span className="bracket">{'{}'}</span>
  return (
    <span>
      <button className="toggle" onClick={() => setOpen(v => !v)}>
        {open ? '▾' : '▸'}
      </button>
      <span className="bracket">{'{'}</span>
      {open ? (
        <div className="indent">
          {entries.map(([k, v]) => (
            <div key={k} className="row">
              <span className="key">"{k}"</span>
              <span className="colon">:</span>
              <JsonNode value={v} depth={depth + 1} />
            </div>
          ))}
        </div>
      ) : (
        <span className="summary">{entries.length} keys</span>
      )}
      <span className="bracket">{'}'}</span>
    </span>
  )
}

export default function JsonViewer({ value }: { value: JsonValue }) {
  return <JsonNode value={value} />
}
