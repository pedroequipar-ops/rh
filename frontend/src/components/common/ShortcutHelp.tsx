import { Dialog } from '../ui/Dialog'

function Atalho({ tecla, desc }: { tecla: string; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{desc}</dt>
      <dd className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700">
        {tecla}
      </dd>
    </div>
  )
}

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Atalhos de teclado" className="max-w-md">
      <dl className="flex flex-col gap-2.5 text-sm text-slate-600">
        <Atalho tecla="Ctrl/Cmd + K" desc="Busca global" />
        <Atalho tecla="?" desc="Esta ajuda" />
        <Atalho tecla="Esc" desc="Fecha painel, popover ou modal" />
        <Atalho tecla="↑ / ↓" desc="Navega listas e resultados de busca" />
        <Atalho tecla="Enter" desc="Abre o item selecionado" />
      </dl>
    </Dialog>
  )
}
