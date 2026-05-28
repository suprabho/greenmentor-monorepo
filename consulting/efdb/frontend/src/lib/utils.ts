import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function confColor(score: number | null | undefined): string {
  if (score == null) return 'text-muted-foreground'
  if (score >= 75) return 'conf-high'
  if (score >= 50) return 'conf-medium'
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

export function geoLabel(global: boolean, country: string | null, region: string | null): string {
  if (region) return region
  if (country) return country
  if (global) return 'Global'
  return '—'
}

export function scopeShort(scopes: string[] | null): string {
  if (!scopes || scopes.length === 0) return '—'
  const short = scopes[0]
    .replace('Scope 3 — Category ', 'S3C')
    .replace('Scope ', 'S')
  return scopes.length > 1 ? `${short} +${scopes.length - 1}` : short
}
