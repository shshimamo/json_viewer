import { useState, useEffect, useContext, createContext, useMemo } from 'react'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type ExpandSignal = { version: number; open: boolean } | null
const ExpandContext = createContext<ExpandSignal>(null)

type SearchState = { query: string; isPath: boolean; segments: string[] }
const SearchContext = createContext<SearchState>({ query: '', isPath: false, segments: [] })
const DefaultDepthContext = createContext(2)

function matchesPathPattern(nodePath: string[], pattern: string[]): boolean {
  if (pattern.length > nodePath.length) return false
  for (let start = 0; start <= nodePath.length - pattern.length; start++) {
    if (pattern.every((seg, i) => seg === '*' || seg === nodePath[start + i])) return true
  }
  return false
}

function subtreeHasPathMatch(value: JsonValue, nodePath: string[], pattern: string[]): boolean {
  if (matchesPathPattern(nodePath, pattern)) return true
  if (Array.isArray(value)) {
    return value.some((item, i) => subtreeHasPathMatch(item, [...nodePath, String(i)], pattern))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).some(([k, v]) =>
      subtreeHasPathMatch(v, [...nodePath, k.toLowerCase()], pattern)
    )
  }
  return false
}

function hasMatch(value: JsonValue, query: string): boolean {
  if (!query) return false
  const q = query.toLowerCase()
  if (value === null) return false
  if (typeof value === 'boolean') return String(value).includes(q)
  if (typeof value === 'number') return String(value).includes(q)
  if (typeof value === 'string') return value.toLowerCase().includes(q)
  if (Array.isArray(value)) return value.some(item => hasMatch(item, query))
  return Object.entries(value).some(([k, v]) => k.toLowerCase().includes(q) || hasMatch(v, query))
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="hl">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function JsonNode({ value, depth = 0, currentPath = [] }: { value: JsonValue; depth?: number; currentPath?: string[] }) {
  const defaultDepth = useContext(DefaultDepthContext)
  const [open, setOpen] = useState(depth < defaultDepth)
  const signal = useContext(ExpandContext)
  const search = useContext(SearchContext)

  useEffect(() => {
    if (!signal) return
    setOpen(signal.open)
  }, [signal?.version])

  const isActive = !!search.query
  const subtreeMatches = isActive
    ? search.isPath
      ? subtreeHasPathMatch(value, currentPath, search.segments)
      : hasMatch(value, search.query)
    : false
  const effectiveOpen = isActive ? subtreeMatches : open

  if (value === null) return <span className="null">null</span>
  if (typeof value === 'boolean') return <span className="bool">{String(value)}</span>
  if (typeof value === 'number') {
    const text = String(value)
    return <span className="num">{search.isPath ? text : <Highlight text={text} query={search.query} />}</span>
  }
  if (typeof value === 'string') {
    return (
      <span className="str">
        {'"'}{search.isPath ? value : <Highlight text={value} query={search.query} />}{'"'}
      </span>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="bracket">[]</span>
    return (
      <span>
        <button className="toggle" onClick={() => setOpen(v => !v)}>
          {effectiveOpen ? '▾' : '▸'}
        </button>
        <span className="bracket">[</span>
        {effectiveOpen ? (
          <div className="indent">
            {value.map((item, i) => (
              <div key={i} className="row">
                <span className="index">{i}</span>
                <span className="colon">:</span>
                <JsonNode value={item} depth={depth + 1} currentPath={[...currentPath, String(i)]} />
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
        {effectiveOpen ? '▾' : '▸'}
      </button>
      <span className="bracket">{'{'}</span>
      {effectiveOpen ? (
        <div className="indent">
          {entries.map(([k, v]) => {
            const childPath = [...currentPath, k.toLowerCase()]
            const isPathMatch = isActive && search.isPath && matchesPathPattern(childPath, search.segments)
            return (
              <div key={k} className={`row${isPathMatch ? ' path-match' : ''}`}>
                <span className="key">
                  {'"'}{isPathMatch ? <mark className="hl">{k}</mark> : search.isPath ? k : <Highlight text={k} query={search.query} />}{'"'}
                </span>
                <span className="colon">:</span>
                <JsonNode value={v} depth={depth + 1} currentPath={childPath} />
              </div>
            )
          })}
        </div>
      ) : (
        <span className="summary">{entries.length} keys</span>
      )}
      <span className="bracket">{'}'}</span>
    </span>
  )
}

export default function JsonViewer({ value, expandSignal, searchQuery = '', defaultDepth = 2 }: { value: JsonValue; expandSignal?: ExpandSignal; searchQuery?: string; defaultDepth?: number }) {
  const searchState = useMemo<SearchState>(() => {
    if (!searchQuery) return { query: '', isPath: false, segments: [] }
    const isPath = searchQuery.includes('.')
    return { query: searchQuery, isPath, segments: isPath ? searchQuery.toLowerCase().split('.') : [] }
  }, [searchQuery])

  return (
    <ExpandContext.Provider value={expandSignal ?? null}>
      <SearchContext.Provider value={searchState}>
        <DefaultDepthContext.Provider value={defaultDepth}>
          <JsonNode value={value} />
        </DefaultDepthContext.Provider>
      </SearchContext.Provider>
    </ExpandContext.Provider>
  )
}
