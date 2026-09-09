import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import { KanbanBoard } from '../../components/kanban/KanbanBoard'
import { EtapaColumnEditor } from '../../components/kanban/EtapaColumnEditor'
import { useEtapas } from '../../api/hooks/useEtapas'
import { useCandidatos, useMoverEtapaCandidato } from '../../api/hooks/useCandidatos'
import { useVagas, useMoverVagaEtapa, useTransicionarVaga } from '../../api/hooks/useVagas'
import { queryKeys } from '../../api/queryKeys'
import type { EtapaKanban, Vaga, VagaStatus } from '../../types'

export function KanbanPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editorOpen, setEditorOpen] = useState(false)

  const etapasQuery = useEtapas()
  const candidatosQuery = useCandidatos()
  const vagasQuery = useVagas()
  const etapas = etapasQuery.data ?? []
  const candidatos = candidatosQuery.data ?? []
  const vagas = vagasQuery.data ?? []
  const loading = etapasQuery.isLoading || candidatosQuery.isLoading || vagasQuery.isLoading

  const transicionarVaga = useTransicionarVaga()
  const moverVagaEtapa = useMoverVagaEtapa()
  const moverEtapaCandidato = useMoverEtapaCandidato()

  function handleMoveCandidato(candidatoId: string, etapaId: string) {
    moverEtapaCandidato.mutate({ id: candidatoId, etapaId })
  }

  function handleMoveVaga(vagaId: string, status: VagaStatus) {
    transicionarVaga.mutate({ id: vagaId, para: status })
  }

  function handleMoveVagaEtapa(vagaId: string, etapaId: string) {
    moverVagaEtapa.mutate({ id: vagaId, etapaId })
  }

  function handleRegistrarCandidato(vaga: Vaga, etapa: EtapaKanban) {
    navigate(`/rh/candidatos/novo?vaga=${vaga.id}&etapa=${etapa.id}`)
  }

  function handleEtapasChange() {
    qc.invalidateQueries({ queryKey: queryKeys.etapas })
    qc.invalidateQueries({ queryKey: queryKeys.vagas })
    qc.invalidateQueries({ queryKey: queryKeys.candidatos })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-lg font-semibold text-slate-800">Fluxo de vagas e candidatos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditorOpen(true)}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Settings size={14} />
            Editar etapas
          </button>
        </div>
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
            vagas={vagas}
            vagaModalBase="/rh/kanban/vaga"
            onMoveVaga={handleMoveVaga}
            onMoveVagaEtapa={handleMoveVagaEtapa}
            onRegistrarCandidato={handleRegistrarCandidato}
          />
        </div>
      )}

      {editorOpen && (
        <EtapaColumnEditor
          etapas={etapas}
          onClose={() => setEditorOpen(false)}
          onChange={handleEtapasChange}
        />
      )}

      <Outlet />
    </div>
  )
}
