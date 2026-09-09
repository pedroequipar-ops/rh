import { Menu } from 'lucide-react'

export function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 md:hidden">
      <button
        onClick={onOpenMenu}
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>
      <span className="text-[15px] font-semibold text-slate-800">RH · Recrutamento</span>
    </div>
  )
}
