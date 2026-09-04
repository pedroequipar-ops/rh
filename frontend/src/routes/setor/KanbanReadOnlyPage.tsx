import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { listEtapas } from '../../api/etapas'
import { listCandidatos } from '../../api/candidatos'
import { KanbanBoard } from '../../components/kanban/KanbanBoard'
import type { Candidato, EtapaKanban } from '../../types'

export function KanbanReadOnlyPage() {
  const [etapas, setEtapas] = useState<EtapaKanban[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listEtapas(), listCandidatos()])
      .then(([etapasData, candidatosData]) => {
        setEtapas(etapasData)
        setCandidatos(candidatosData)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold text-slate-800">Candidatos das minhas vagas</h1>
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
          />
        </div>
      )}

      <Outlet />
    </div>
  )
}
