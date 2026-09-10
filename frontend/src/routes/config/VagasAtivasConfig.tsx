import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useVagas, useDeleteVaga } from '../../api/hooks/useVagas'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { VagasTable } from '../listagem/VagasTable'
import type { Vaga } from '../../types'

export function VagasAtivasConfig() {
  const vagasQuery = useVagas()
  const excluirVaga = useDeleteVaga()
  const [paraExcluir, setParaExcluir] = useState<Vaga | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [confirmarExclusaoEmMassa, setConfirmarExclusaoEmMassa] = useState(false)

  const vagasAtivas = (vagasQuery.data ?? []).filter(
    (v) => v.status !== 'CANCELADA' && v.status !== 'PREENCHIDA',
  )

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos(ids: string[]) {
    setSelecionados((prev) => {
      const todosJaSelecionados = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (todosJaSelecionados) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  async function excluirSelecionados() {
    await Promise.all([...selecionados].map((id) => excluirVaga.mutateAsync(id)))
    setSelecionados(new Set())
    setConfirmarExclusaoEmMassa(false)
  }

  return (
    <div className="flex h-full flex-col">
      {vagasQuery.isLoading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <VagasTable
          vagas={vagasAtivas}
          basePath=""
          onDelete={setParaExcluir}
          editavel={false}
          selecionados={selecionados}
          onToggleSelecionado={toggleSelecionado}
          onToggleTodos={toggleTodos}
          toolbarExtra={
            selecionados.size > 0 && (
              <button
                onClick={() => setConfirmarExclusaoEmMassa(true)}
                className="flex h-8 items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 text-sm text-red-700 hover:bg-red-100"
              >
                <Trash2 size={14} />
                Excluir {selecionados.size} selecionada{selecionados.size === 1 ? '' : 's'}
              </button>
            )
          }
        />
      )}

      {paraExcluir && (
        <ConfirmDialog
          title="Excluir vaga"
          description={`Tem certeza que deseja excluir a vaga "${paraExcluir.titulo}"?`}
          onConfirm={() => {
            excluirVaga.mutate(paraExcluir.id)
            setParaExcluir(null)
          }}
          onCancel={() => setParaExcluir(null)}
        />
      )}

      {confirmarExclusaoEmMassa && (
        <ConfirmDialog
          title="Excluir vagas selecionadas"
          description={`Tem certeza que deseja excluir ${selecionados.size} vaga${selecionados.size === 1 ? '' : 's'}?`}
          onConfirm={excluirSelecionados}
          onCancel={() => setConfirmarExclusaoEmMassa(false)}
        />
      )}
    </div>
  )
}
