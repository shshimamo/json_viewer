import { useEffect, useState, useCallback, useMemo } from 'react'
import './index.css'
import Sidebar, { type FileEntry } from './Sidebar'
import JsonViewer from './JsonViewer'
import TableViewer from './TableViewer'
import TemplateSelector from './TemplateSelector'
import { parseTemplate, applyTemplate, type Template } from './transform'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type ViewMode = 'tree' | 'table'

export default function App() {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [data, setData] = useState<JsonValue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [treeDepth, setTreeDepth] = useState(2)
  const [tableDepth, setTableDepth] = useState(3)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandSignal, setExpandSignal] = useState<{ version: number; open: boolean } | null>(null)

  const handleExpandAll = useCallback(() => {
    setExpandSignal(s => ({ version: (s?.version ?? 0) + 1, open: true }))
  }, [])

  const handleCollapseAll = useCallback(() => {
    setExpandSignal(s => ({ version: (s?.version ?? 0) + 1, open: false }))
  }, [])

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((cfg: { treeDepth: number; tableDepth: number }) => {
        setTreeDepth(cfg.treeDepth)
        setTableDepth(cfg.tableDepth)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/files')
      .then(r => r.json())
      .then((es: FileEntry[]) => {
        setEntries(es)
        if (es.length > 0) setSelectedId(es[0].id)
      })
      .catch(e => setError(String(e)))
  }, [])

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then((files: { filename: string; content: string }[]) => {
        const parsed = files.flatMap(f => {
          const t = parseTemplate(f.filename, f.content)
          return t ? [t] : []
        })
        setTemplates(parsed)
      })
      .catch(() => {/* templates optional */})
  }, [])

  useEffect(() => {
    if (!selectedId) { setData(null); return }
    setError(null)
    fetch(`/api/content?id=${selectedId}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return r.json()
      })
      .then(setData)
      .catch(e => setError(String(e)))
  }, [selectedId])

  const saveJson = useCallback(async (jsonText: string, name: string) => {
    const res = await fetch(`/api/save?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonText,
    })
    if (!res.ok) {
      setError(await res.text())
      return
    }
    const entry: FileEntry = await res.json()
    setEntries(prev => [...prev, entry])
    setSelectedId(entry.id)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/delete?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id)
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null)
      }
      return next
    })
  }, [selectedId])

  // Drag & drop
  useEffect(() => {
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true) }
    const onDragLeave = (e: DragEvent) => { if (!e.relatedTarget) setIsDragging(false) }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer?.files[0]
      if (!file) return
      const text = await file.text()
      await saveJson(text, file.name.replace(/\.json$/i, ''))
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [saveJson])

  // Paste
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const text = e.clipboardData?.getData('text')
      if (!text) return
      try { JSON.parse(text) } catch { return }
      await saveJson(text, 'paste')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [saveJson])

  const displayData = useMemo(() => {
    if (data === null) return null
    const tmpl = templates.find(t => t.filename === selectedTemplate)
    if (!tmpl) return data
    return applyTemplate(data, tmpl)
  }, [data, selectedTemplate, templates])

  const handleCopy = useCallback(async () => {
    if (displayData === null) return
    await navigator.clipboard.writeText(JSON.stringify(displayData, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [displayData])

  return (
    <div className="app">
      <header className="header">
        <span className="logo">json_viewer</span>
        {displayData !== null && (
          <>
            <div className="view-toggle">
              <button
                className={`view-btn${viewMode === 'tree' ? ' active' : ''}`}
                onClick={() => setViewMode('tree')}
              >Tree</button>
              <button
                className={`view-btn${viewMode === 'table' ? ' active' : ''}`}
                onClick={() => setViewMode('table')}
              >Table</button>
            </div>
            {viewMode === 'tree' && (
              <>
                <div className="view-toggle">
                  <button className="view-btn" onClick={handleExpandAll}>Expand All</button>
                  <button className="view-btn" onClick={handleCollapseAll}>Collapse All</button>
                </div>
                <div className="search-wrap">
                  <div className="search-input-wrap">
                    <input
                      className="search-input"
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
                    )}
                  </div>
                  <div className="search-help">
                    <span className="help-icon">?</span>
                    <div className="help-tooltip">
                      <div className="help-row"><code>name</code>キーワード検索</div>
                      <div className="help-row"><code>user.name</code>パス指定（部分一致）</div>
                      <div className="help-row"><code>users.*.name</code>ワイルドカード</div>
                      <div className="help-row"><code>users.0.name</code>インデックス指定</div>
                    </div>
                  </div>
                </div>
              </>
            )}
            <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </>
        )}
        <TemplateSelector
          templates={templates}
          selectedFilename={selectedTemplate}
          onChange={setSelectedTemplate}
        />
      </header>
      <div className="body">
        <Sidebar
          entries={entries}
          selectedId={selectedId}
          onSelect={e => setSelectedId(e.id)}
          onDelete={handleDelete}
          onAdd={saveJson}
        />
        <main className="main">
          {isDragging && <div className="drop-overlay">Drop JSON file here</div>}
          {error && <div className="error">{error}</div>}
          {displayData !== null && viewMode === 'tree' && <div className="tree"><JsonViewer value={displayData} expandSignal={expandSignal} searchQuery={searchQuery} defaultDepth={treeDepth} /></div>}
          {displayData !== null && viewMode === 'table' && <TableViewer value={displayData} maxDepth={tableDepth} />}
          {!isDragging && !error && displayData === null && entries.length === 0 && (
            <div className="empty-hint">Drop a JSON file or paste JSON (Ctrl+V / Cmd+V)</div>
          )}
        </main>
      </div>
    </div>
  )
}
