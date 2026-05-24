import { type Template } from './transform'

interface Props {
  templates: Template[]
  selectedFilename: string | null
  onChange: (filename: string | null) => void
}

export default function TemplateSelector({ templates, selectedFilename, onChange }: Props) {
  if (templates.length === 0) return null

  return (
    <div className="template-selector">
      <label className="template-label">Template</label>
      <select
        className="template-select"
        value={selectedFilename ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">— none —</option>
        {templates.map(t => (
          <option key={t.filename} value={t.filename}>{t.filename.replace(/\.yaml$/, '')}</option>
        ))}
      </select>
    </div>
  )
}
