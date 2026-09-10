import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useEtapas } from '../../api/hooks/useEtapas'
import { useVagas, useMoverVagaEtapa } from '../../api/hooks/useVagas'
import { useCandidatos, useMoverEtapaCandidato } from '../../api/hooks/useCandidatos'
import { useUsuarios } from '../../api/hooks/useUsuarios'
import { queryKeys } from '../../api/queryKeys'
import { BoardFilters } from '../../components/board/BoardFilters'
import { BuscarButton } from '../../components/board/BuscarButton'
import { useBoardFilters } from '../../components/board/useBoardFilters'
import { BoardSwitcher } from '../../components/kanban/BoardSwitcher'
import { PessoasBoard } from '../../components/kanban/PessoasBoard'
import { EtapaColumnEditor } from '../../components/kanban/EtapaColumnEditor'
import type { EtapaKanban, Vaga } from '../../types'

export function PessoasBoardPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isRh = me?.role === 'RH'
  const base = isRh ? '/rh' : '/setor'
  const [editorOpen, setEditorOpen] = useState(false)

  const etapasQuery = useEtapas()
  const vagasQuery = useVagas()
  const candidatosQuery = useCandidatos()
  const usuariosQuery = useUsuarios(isRh)
  const moverVagaEtapa = useMoverVagaEtapa()
  const moverEtapaCandidato = useMoverEtapaCandidato()
  const filters = useBoardFilters('pessoas')

  const etapas = etapasQuery.data ?? []
  const vagas = vagasQuery.data ?? []
  const candidatos = candidatosQuery.data ?? []
  const candidatosFiltrados = filters.apply(candidatos)
  const setorNomes = [...new Set(candidatos.map((c) => c.vaga_setor))].sort()
  const loading = etapasQuery.isLoading || vagasQuery.isLoading || candidatosQuery.isLoading

  function handleMoveCandidato(candidatoId: string, etapaId: string) {
    moverEtapaCandidato.mutate({ id: candidatoId, etapaId })
  }

  function handleMoveVagaEtapa(vagaId: string, etapaId: string) {
    moverVagaEtapa.mutate({ id: vagaId, etapaId })
  }

  function handleRegistrarCandidato(vaga: Vaga, etapa: EtapaKanban) {
    navigate(`/rh/pessoas/novo-candidato?vaga=${vaga.id}&etapa=${etapa.id}`)
  }

  function handleEtapasChange() {
    qc.invalidateQueries({ queryKey: queryKeys.etapas })
    qc.invalidateQueries({ queryKey: queryKeys.vagas })
    qc.invalidateQueries({ queryKey: queryKeys.candidatos })
  }

  return (
    <div className="flex h-full flex-col bg-board">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-800">Pessoas</h1>
          <BoardSwitcher
            vagasHref={`${base}/vagas`}
            pessoasHref={`${base}/pessoas`}
            totalVagas={vagas.length}
            totalPessoas={candidatos.length}
          />
        </div>
        <div className="flex items-center gap-2">
          <BoardFilters
            filters={filters}
            etapas={etapas.map((e) => ({ value: e.id, label: e.nome }))}
            setorNomes={setorNomes}
            usuarios={(usuariosQuery.data ?? []).map((u) => ({ value: u.id, label: u.username }))}
          />
          {isRh && (
            <button
              onClick={() => setEditorOpen(true)}
              className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Settings size={14} />
              Editar etapas
            </button>
          )}
          <BuscarButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Carregando...
          </div>
        ) : (
          <div className="min-w-0 flex-1 overflow-hidden">
            <PessoasBoard
              etapas={etapas}
              candidatos={candidatosFiltrados}
              vagas={vagas}
              draggable={isRh}
              candidatoModalBase={`${base}/pessoas/candidato`}
              vagaModalBase={`${base}/pessoas/vaga`}
              onMoveCandidato={isRh ? handleMoveCandidato : undefined}
              onMoveVagaEtapa={isRh ? handleMoveVagaEtapa : undefined}
              onRegistrarCandidato={isRh ? handleRegistrarCandidato : undefined}
            />
          </div>
        )}
        <Outlet />
      </div>

      {editorOpen && (
        <EtapaColumnEditor
          etapas={etapas}
          onClose={() => setEditorOpen(false)}
          onChange={handleEtapasChange}
        />
      )}
    </div>
  )
}
