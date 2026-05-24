import { useEffect, useState, useCallback } from 'react'
import './index.css'
import Sidebar, { type FileEntry } from './Sidebar'
import JsonViewer from './JsonViewer'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export default function App() {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [data, setData] = useState<JsonValue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

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

  return (
    <div className="app">
      <header className="header">
        <span className="logo">jo</span>
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
          {data !== null && <div className="tree"><JsonViewer value={data} /></div>}
          {!isDragging && !error && data === null && entries.length === 0 && (
            <div className="empty-hint">Drop a JSON file or paste JSON (Ctrl+V / Cmd+V)</div>
          )}
        </main>
      </div>
    </div>
  )
}
