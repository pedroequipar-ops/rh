import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useCandidatos, useDeleteCandidato } from '../../api/hooks/useCandidatos'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { CandidatosTable } from '../listagem/CandidatosTable'
import type { Candidato } from '../../types'

export function CandidatosConfig() {
  const location = useLocation()
  const candidatosQuery = useCandidatos()
  const excluirCandidato = useDeleteCandidato()
  const [paraExcluir, setParaExcluir] = useState<Candidato | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [confirmarExclusaoEmMassa, setConfirmarExclusaoEmMassa] = useState(false)

  const candidatos = candidatosQuery.data ?? []

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
    await Promise.all([...selecionados].map((id) => excluirCandidato.mutateAsync(id)))
    setSelecionados(new Set())
    setConfirmarExclusaoEmMassa(false)
  }

  return (
    <div className="flex h-full flex-col">
      {candidatosQuery.isLoading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <CandidatosTable
          candidatos={candidatos}
          basePath={location.pathname}
          isRh
          onDelete={setParaExcluir}
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
                Excluir {selecionados.size} selecionado{selecionados.size === 1 ? '' : 's'}
              </button>
            )
          }
        />
      )}

      {paraExcluir && (
        <ConfirmDialog
          title="Excluir candidato"
          description={`Tem certeza que deseja excluir "${paraExcluir.nome}"?`}
          onConfirm={() => {
            excluirCandidato.mutate(paraExcluir.id)
            setParaExcluir(null)
          }}
          onCancel={() => setParaExcluir(null)}
        />
      )}

      {confirmarExclusaoEmMassa && (
        <ConfirmDialog
          title="Excluir candidatos selecionados"
          description={`Tem certeza que deseja excluir ${selecionados.size} candidato${selecionados.size === 1 ? '' : 's'}?`}
          onConfirm={excluirSelecionados}
          onCancel={() => setConfirmarExclusaoEmMassa(false)}
        />
      )}

      <Outlet />
    </div>
  )
}
