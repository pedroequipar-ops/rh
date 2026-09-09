import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { listEtapas } from '../../api/etapas'
import { listCandidatos } from '../../api/candidatos'
import { listVagas } from '../../api/vagas'
import { KanbanBoard } from '../../components/kanban/KanbanBoard'
import type { Candidato, EtapaKanban, Vaga } from '../../types'

export function KanbanReadOnlyPage() {
  const [etapas, setEtapas] = useState<EtapaKanban[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [etapasData, candidatosData, vagasData] = await Promise.all([
      listEtapas(),
      listCandidatos(),
      listVagas(),
    ])
    setEtapas(etapasData)
    setCandidatos(candidatosData)
    setVagas(vagasData)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

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

      <Outlet context={{ onVagaChange: load }} />
    </div>
  )
}
