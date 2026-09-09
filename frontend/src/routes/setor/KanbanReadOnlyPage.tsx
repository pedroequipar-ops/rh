import { Outlet } from 'react-router-dom'
import { KanbanBoard } from '../../components/kanban/KanbanBoard'
import { useEtapas } from '../../api/hooks/useEtapas'
import { useCandidatos } from '../../api/hooks/useCandidatos'
import { useVagas } from '../../api/hooks/useVagas'

export function KanbanReadOnlyPage() {
  const etapasQuery = useEtapas()
  const candidatosQuery = useCandidatos()
  const vagasQuery = useVagas()
  const etapas = etapasQuery.data ?? []
  const candidatos = candidatosQuery.data ?? []
  const vagas = vagasQuery.data ?? []
  const loading = etapasQuery.isLoading || candidatosQuery.isLoading || vagasQuery.isLoading

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold text-slate-800">Fluxo das minhas vagas</h1>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Carregando...</div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            etapas={etapas}
            candidatos={candidatos}
            draggable={false}
            candidatoModalBase="/setor/kanban/candidato"
            vagas={vagas}
            vagaModalBase="/setor/kanban/vaga"
          />
        </div>
      )}

      <Outlet />
    </div>
  )
}
