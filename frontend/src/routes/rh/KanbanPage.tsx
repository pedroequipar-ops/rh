import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { listEtapas } from '../../api/etapas'
import { listCandidatos, moverEtapa } from '../../api/candidatos'
import { KanbanBoard } from '../../components/kanban/KanbanBoard'
import { EtapaColumnEditor } from '../../components/kanban/EtapaColumnEditor'
import type { Candidato, EtapaKanban } from '../../types'

export function KanbanPage() {
  const [etapas, setEtapas] = useState<EtapaKanban[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)

  const load = useCallback(async () => {
    const [etapasData, candidatosData] = await Promise.all([listEtapas(), listCandidatos()])
    setEtapas(etapasData)
    setCandidatos(candidatosData)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  async function handleMoveCandidato(candidatoId: string, etapaId: string) {
    const anterior = candidatos
    const novaEtapa = etapas.find((e) => e.id === etapaId)
    if (novaEtapa) {
      setCandidatos((prev) =>
        prev.map((c) => (c.id === candidatoId ? { ...c, etapa_atual: novaEtapa } : c)),
      )
    }
    try {
      await moverEtapa(candidatoId, etapaId)
    } catch {
      setCandidatos(anterior)
    }
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-lg font-semibold text-slate-800">Kanban de candidatos</h1>
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Settings size={14} />
          Editar etapas
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Carregando...</div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            etapas={etapas}
            candidatos={candidatos}
            draggable
            candidatoModalBase="/rh/kanban/candidato"
            onMoveCandidato={handleMoveCandidato}
          />
        </div>
      )}

      {editorOpen && (
        <EtapaColumnEditor etapas={etapas} onClose={() => setEditorOpen(false)} onChange={load} />
      )}

      <Outlet />
    </div>
  )
}
