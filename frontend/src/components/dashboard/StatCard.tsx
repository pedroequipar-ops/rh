import type { ReactNode } from 'react'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'danger'
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  const perigo = tone === 'danger'
  return (
    <Card className={cn('flex flex-col gap-1 p-4', perigo && 'border-red-200 bg-red-50')}>
      <span className={cn('text-xs', perigo ? 'text-red-600' : 'text-slate-500')}>{label}</span>
      <span className={cn('text-2xl font-bold', perigo ? 'text-red-700' : 'text-slate-800')}>{value}</span>
      {hint && <span className={cn('text-xs', perigo ? 'text-red-600' : 'text-slate-400')}>{hint}</span>}
    </Card>
  )
}
