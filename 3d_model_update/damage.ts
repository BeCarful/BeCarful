import { canonicalKey } from './collections'

export type PartDamage = {
  part: string
  level: number
}

export function clampLevel(level: number) {
  if (!Number.isFinite(level)) return 0
  return Math.min(1, Math.max(0, level))
}

export function parseDamage(data: unknown): PartDamage[] {
  const source = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { parts?: unknown }).parts)
      ? (data as { parts: unknown[] }).parts
      : data && typeof data === 'object'
        ? [data]
        : []

  const parts: PartDamage[] = []
  for (const item of source) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const part = record.part ?? record.name ?? record.collection
    const level = record.level ?? record.severity
    if (typeof part !== 'string' || !part.trim() || typeof level !== 'number') continue
    parts.push({ part: part.trim(), level: clampLevel(level) })
  }
  return parts
}

export function damageLevels(parts: PartDamage[]) {
  const levels = new Map<string, number>()
  for (const item of parts) {
    const key = canonicalKey(item.part)
    levels.set(key, Math.max(levels.get(key) ?? 0, item.level))
  }
  return levels
}

export const DEMO_DAMAGE: PartDamage[] = [{ part: 'Right Door', level: 0.9 }]
