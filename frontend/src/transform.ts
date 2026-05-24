import yaml from 'js-yaml'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// YAML format:
// common:
//   status:
//     active: 稼働中
//     planning: 計画中
//
// fields:
//   - path: "company.departments.status"  # ドット区切り、* でワイルドカード
//     map:
//       active: 進行中
interface FieldEntry {
  path: string
  map: Record<string, string>
}

interface TemplateSpec {
  common?: Record<string, Record<string, string>>
  fields?: FieldEntry[]
}

export interface Template {
  filename: string
  spec: TemplateSpec
}

export function parseTemplate(filename: string, content: string): Template | null {
  try {
    const spec = yaml.load(content) as TemplateSpec
    return { filename, spec }
  } catch {
    return null
  }
}

// "company.*.status" → ["company", "*", "status"]
function parsePattern(path: string): string[] {
  return path.split('.')
}

// segments の文字列キー部分がパターンと末尾一致するか
function matchesPattern(segments: (string | number)[], pattern: string[]): boolean {
  const keys = segments.filter((s): s is string => typeof s === 'string')
  if (keys.length < pattern.length) return false
  const offset = keys.length - pattern.length
  return pattern.every((p, i) => p === '*' || p === keys[offset + i])
}

function transformValue(
  value: JsonValue,
  common: Record<string, Record<string, string>> | undefined,
  fields: Array<{ pattern: string[]; map: Record<string, string> }>,
  segments: (string | number)[]
): JsonValue {
  if (value === null || typeof value !== 'object') {
    const strVal = String(value)

    // fields が優先（パスの末尾一致）
    for (const { pattern, map } of fields) {
      if (matchesPattern(segments, pattern) && map[strVal] !== undefined) {
        return map[strVal]
      }
    }

    // common（直近のキー名で一致）
    const key = segments.length > 0 ? segments[segments.length - 1] : ''
    if (typeof key === 'string' && common?.[key]?.[strVal] !== undefined) {
      return common[key][strVal]
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.map((v, i) => transformValue(v, common, fields, [...segments, i]))
  }

  const result: { [key: string]: JsonValue } = {}
  for (const [k, v] of Object.entries(value)) {
    result[k] = transformValue(v, common, fields, [...segments, k])
  }
  return result
}

export function applyTemplate(data: JsonValue, template: Template): JsonValue {
  const { spec } = template
  const fields = (spec.fields ?? []).map(({ path, map }) => ({
    pattern: parsePattern(path),
    map,
  }))
  return transformValue(data, spec.common, fields, [])
}
