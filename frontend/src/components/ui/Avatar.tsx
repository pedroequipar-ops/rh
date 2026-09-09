import { cn } from './cn'

const COLORS = [
  'bg-slate-500',
  'bg-red-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-cyan-500',
]

const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function colorFor(name: string): string {
  let hash = 0
  for (const ch of name) {
    hash = (hash * 31 + ch.charCodeAt(0)) | 0
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        SIZES[size],
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
