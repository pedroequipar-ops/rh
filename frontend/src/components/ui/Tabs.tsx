import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from './cn'

export interface TabItem {
  value: string
  label: ReactNode
}

interface TabsProps {
  tabs: TabItem[]
  value?: string
  onChange?: (value: string) => void
  searchParamKey?: string
  className?: string
}

export function Tabs({ tabs, value, onChange, searchParamKey, className }: TabsProps) {
  const [params, setParams] = useSearchParams()
  const fallback = tabs.length > 0 ? tabs[0].value : ''
  const active = searchParamKey
    ? params.get(searchParamKey) ?? fallback
    : value ?? fallback

  function select(next: string) {
    if (searchParamKey) {
      const updated = new URLSearchParams(params)
      updated.set(searchParamKey, next)
      setParams(updated, { replace: true })
    }
    onChange?.(next)
  }

  return (
    <div className={cn('flex gap-1 border-b border-slate-200', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => select(tab.value)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            active === tab.value
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
