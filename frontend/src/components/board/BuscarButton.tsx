import { Search } from 'lucide-react'
import { useCommandPalette } from '../../context/CommandPaletteContext'

export function BuscarButton() {
  const { openPalette } = useCommandPalette()
  return (
    <button
      onClick={openPalette}
      className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-500 transition-fast hover:bg-slate-50"
    >
      <Search size={14} />
      Buscar
      <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-400">Ctrl K</kbd>
    </button>
  )
}
