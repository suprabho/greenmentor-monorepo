import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Pedigree DQ score → color class. Lower is better (1 = best, 5 = worst).
 * Returned classes match the same conf-high/medium/low semantics so existing
 * styles keep working.
 */
export function dqColor(score: number | null | undefined): string {
  if (score == null) return 'text-muted-foreground'
  if (score <= 2) return 'conf-high'
  if (score <= 3) return 'conf-medium'
  return 'conf-low'
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).getFullYear().toString()
}

export function formatValidity(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const s = start ? new Date(start).getFullYear() : '?'
  const e = end ? new Date(end).getFullYear() : 'present'
  return `${s} – ${e}`
}

export function geoLabel(geographyType: string | null, countryIso: string | null, regionName: string | null): string {
  if (geographyType === 'global' || (!countryIso && !regionName)) return 'Global'
  if (regionName) return regionName
  if (countryIso) return countryIso
  return '—'
}

export function scopeShort(scope: string | null): string {
  if (!scope) return '—'
  return `S${scope}`
}
