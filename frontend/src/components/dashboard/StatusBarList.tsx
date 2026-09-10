import { cn } from '../ui/cn'

export interface StatusBarItem {
  key: string
  label: string
  total: number
  colorClass?: string
}

interface StatusBarListProps {
  items: StatusBarItem[]
  emptyMessage?: string
}

/** Lista de barras horizontais proporcionais ao maior valor — CSS puro, zero dep. */
export function StatusBarList({ items, emptyMessage = 'Sem dados.' }: StatusBarListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>
  }

  const max = Math.max(1, ...items.map((item) => item.total))

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2.5 text-sm">
          <span className="w-32 shrink-0 truncate text-slate-600">{item.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full', item.colorClass ?? 'bg-blue-500')}
              style={{ width: `${(item.total / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-slate-500">{item.total}</span>
        </div>
      ))}
    </div>
  )
}
