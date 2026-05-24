import { useState } from 'react'

export type FileEntry = {
  id: string
  name: string
  path: string
  source: 'cli' | 'saved'
}

type TreeNode = {
  name: string
  entry?: FileEntry
  children?: Map<string, TreeNode>
}

function commonDirPrefix(paths: string[]): string {
  if (paths.length === 0) return ''
  const parts = paths.map(p => p.split('/').slice(0, -1))
  const minLen = Math.min(...parts.map(p => p.length))
  let i = 0
  while (i < minLen && parts.every(p => p[i] === parts[0][i])) i++
  const prefix = parts[0].slice(0, i).join('/')
  return prefix ? prefix + '/' : ''
}

function buildTree(entries: FileEntry[], prefix: string): TreeNode {
  const root: TreeNode = { name: '', children: new Map() }
  for (const entry of entries) {
    const rel = entry.path.startsWith(prefix) ? entry.path.slice(prefix.length) : entry.path
    const parts = rel.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.children!.has(parts[i])) {
        node.children!.set(parts[i], { name: parts[i], children: new Map() })
      }
      node = node.children!.get(parts[i])!
    }
    const leaf = parts[parts.length - 1]
    node.children!.set(leaf, { name: leaf, entry })
  }
  return root
}

// Collapse dirs that contain only a single child dir
function collapseTree(node: TreeNode): TreeNode {
  if (!node.children) return node
  const newChildren = new Map<string, TreeNode>()
  for (const [key, child] of node.children) {
    let collapsed = collapseTree(child)
    let mergedKey = key
    // Merge if this dir has exactly one dir child
    while (!collapsed.entry && collapsed.children && collapsed.children.size === 1) {
      const [[subKey, subChild]] = collapsed.children.entries()
      if (subChild.entry) break
      mergedKey = `${mergedKey}/${subKey}`
      collapsed = collapseTree(subChild)
    }
    newChildren.set(mergedKey, { ...collapsed, name: mergedKey })
  }
  return { ...node, children: newChildren }
}

function TreeNodeView({ node, selectedId, onSelect, onDelete }: {
  node: TreeNode
  selectedId: string | null
  onSelect: (entry: FileEntry) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  if (node.entry) {
    return (
      <div
        className={`sidebar-item${node.entry.id === selectedId ? ' selected' : ''}`}
        onClick={() => onSelect(node.entry!)}
      >
        <span className="sidebar-file">{node.name}</span>
      </div>
    )
  }

  if (!node.children) return null

  const children = [...node.children.values()].map(child => (
    <TreeNodeView
      key={child.name}
      node={child}
      selectedId={selectedId}
      onSelect={onSelect}
      onDelete={onDelete}
    />
  ))

  // Root node: render children directly without a label
  if (!node.name) {
    return <>{children}</>
  }

  return (
    <div className="sidebar-dir">
      <div className="sidebar-dir-label" onClick={() => setOpen(v => !v)}>
        <span className="sidebar-dir-arrow">{open ? '▾' : '▸'}</span>
        <span>{node.name}</span>
      </div>
      {open && <div className="sidebar-dir-children">{children}</div>}
    </div>
  )
}

type Props = {
  entries: FileEntry[]
  selectedId: string | null
  onSelect: (entry: FileEntry) => void
  onDelete: (id: string) => void
  onAdd: (json: string, name: string) => void
}

export default function Sidebar({ entries, selectedId, onSelect, onDelete, onAdd }: Props) {
  const [showDialog, setShowDialog] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [fileName, setFileName] = useState('')
  const [addError, setAddError] = useState('')

  const cliEntries = entries.filter(e => e.source === 'cli')
  const savedEntries = entries.filter(e => e.source === 'saved')

  const prefix = commonDirPrefix(cliEntries.map(e => e.path))
  const cliTree = collapseTree(buildTree(cliEntries, prefix))

  const handleAdd = () => {
    try {
      JSON.parse(jsonText)
    } catch {
      setAddError('Invalid JSON')
      return
    }
    onAdd(jsonText, fileName || 'snippet')
    setShowDialog(false)
    setJsonText('')
    setFileName('')
    setAddError('')
  }

  const closeDialog = () => {
    setShowDialog(false)
    setJsonText('')
    setFileName('')
    setAddError('')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Files</span>
        <button className="add-btn" onClick={() => setShowDialog(true)} title="Add JSON">+</button>
      </div>

      <div className="sidebar-content">
        {cliEntries.length > 0 && (
          <div className="sidebar-group">
            <TreeNodeView
              node={cliTree}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          </div>
        )}

        {savedEntries.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-label">saved</div>
            {savedEntries.map(entry => (
              <div
                key={entry.id}
                className={`sidebar-item${entry.id === selectedId ? ' selected' : ''}`}
                onClick={() => onSelect(entry)}
              >
                <span className="sidebar-file">{entry.name}</span>
                <button
                  className="delete-btn"
                  onClick={e => { e.stopPropagation(); onDelete(entry.id) }}
                  title="Delete"
                >×</button>
              </div>
            ))}
          </div>
        )}

        {entries.length === 0 && (
          <div className="sidebar-empty">No files.<br />Drop a JSON file or paste JSON.</div>
        )}
      </div>

      {showDialog && (
        <div className="dialog-overlay" onClick={closeDialog}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <span>Add JSON</span>
              <button className="dialog-close" onClick={closeDialog}>×</button>
            </div>
            <input
              className="dialog-input"
              placeholder="filename (optional)"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
            />
            <textarea
              className="dialog-textarea"
              placeholder="Paste JSON here..."
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              autoFocus
            />
            {addError && <div className="dialog-error">{addError}</div>}
            <button className="dialog-submit" onClick={handleAdd}>Save</button>
          </div>
        </div>
      )}
    </aside>
  )
}
