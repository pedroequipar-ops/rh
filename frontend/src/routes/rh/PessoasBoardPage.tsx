import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Settings, UserPlus, Upload, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useEtapas } from '../../api/hooks/useEtapas'
import { useVagas, useMoverVagaEtapa, useTransicionarVaga } from '../../api/hooks/useVagas'
import { useCandidatos, useMoverEtapaCandidato } from '../../api/hooks/useCandidatos'
import { useUsuarios } from '../../api/hooks/useUsuarios'
import { queryKeys } from '../../api/queryKeys'
import { BoardFilters } from '../../components/board/BoardFilters'
import { BuscarButton } from '../../components/board/BuscarButton'
import { useBoardFilters } from '../../components/board/useBoardFilters'
import { BoardSwitcher } from '../../components/kanban/BoardSwitcher'
import { PessoasBoard } from '../../components/kanban/PessoasBoard'
import { EtapaColumnEditor } from '../../components/kanban/EtapaColumnEditor'
import { BulkCurriculoDropzone } from '../../components/candidato/BulkCurriculoDropzone'
import { vagaIdFromLocation } from '../../lib/selectedVaga'
import type { EtapaKanban, Vaga, VagaStatus } from '../../types'

interface PessoasBoardPageProps {
  /** Aba "Triagem": só as etapas de pré-cadastro (vaga ainda sem candidato registrado). */
  soTriagem?: boolean
}

export function PessoasBoardPage({ soTriagem = false }: PessoasBoardPageProps) {
  const { me } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const isRh = me?.role === 'RH'
  const base = isRh ? '/rh' : '/setor'
  const rotaAtual = soTriagem ? 'triagem' : 'pessoas'
  const selectedVagaId = vagaIdFromLocation(location.pathname, location.search)
  const [editorOpen, setEditorOpen] = useState(false)
  const [registroAlvo, setRegistroAlvo] = useState<{ vaga: Vaga; etapa: EtapaKanban } | null>(null)
  const [importAlvo, setImportAlvo] = useState<{ vaga: Vaga; etapa: EtapaKanban } | null>(null)

  const etapasQuery = useEtapas()
  const vagasQuery = useVagas()
  const candidatosQuery = useCandidatos()
  const usuariosQuery = useUsuarios(isRh)
  const moverVagaEtapa = useMoverVagaEtapa()
  const moverEtapaCandidato = useMoverEtapaCandidato()
  const transicionarVaga = useTransicionarVaga()
  const filters = useBoardFilters('pessoas')

  const etapasTodas = etapasQuery.data ?? []
  const etapas = etapasTodas.filter((e) => e.exige_cadastro_completo !== soTriagem)
  const etapaCadastroInicial =
    etapasTodas
      .filter((e) => e.exige_cadastro_completo && !e.is_saida_negativa)
      .sort((a, b) => a.ordem - b.ordem)[0] ?? null
  const vagas = vagasQuery.data ?? []
  const candidatos = candidatosQuery.data ?? []
  const candidatosFiltrados = filters.apply(candidatos)
  const setorNomes = [...new Set(candidatos.map((c) => c.vaga_setor))].sort()
  const totalTriagem = vagas.filter((v) => v.status === 'EM_TRIAGEM').length
  const loading = etapasQuery.isLoading || vagasQuery.isLoading || candidatosQuery.isLoading

  function handleMoveCandidato(candidatoId: string, etapaId: string, motivo?: string) {
    moverEtapaCandidato.mutate({ id: candidatoId, etapaId, motivo })
  }

  function handleMoveVagaEtapa(vagaId: string, etapaId: string) {
    moverVagaEtapa.mutate({ id: vagaId, etapaId })
  }

  function handleTransicionarVaga(vagaId: string, status: VagaStatus) {
    transicionarVaga.mutate({ id: vagaId, para: status })
  }

  function handleRegistrarCandidato(vaga: Vaga, etapa: EtapaKanban) {
    setRegistroAlvo({ vaga, etapa })
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
          <h1 className="text-lg font-semibold text-slate-800">
            {soTriagem ? 'Triagem' : 'Pessoas'}
          </h1>
          <BoardSwitcher
            vagasHref={`${base}/vagas`}
            triagemHref={`${base}/triagem`}
            pessoasHref={`${base}/pessoas`}
            totalVagas={vagas.length}
            totalTriagem={totalTriagem}
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
              candidatoModalBase={`${base}/${rotaAtual}/candidato`}
              vagaModalBase={`${base}/${rotaAtual}/vaga`}
              onMoveCandidato={isRh ? handleMoveCandidato : undefined}
              onMoveVagaEtapa={isRh ? handleMoveVagaEtapa : undefined}
              onRegistrarCandidato={isRh ? handleRegistrarCandidato : undefined}
              onTransicionarVaga={isRh && soTriagem ? handleTransicionarVaga : undefined}
              etapaCadastroInicial={etapaCadastroInicial}
              selectedVagaId={selectedVagaId}
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
          scopeExigeCadastroCompleto={!soTriagem}
        />
      )}

      {registroAlvo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setRegistroAlvo(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">
                Cadastrar em "{registroAlvo.etapa.nome}"
              </h2>
              <button
                onClick={() => setRegistroAlvo(null)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  const { vaga, etapa } = registroAlvo
                  setRegistroAlvo(null)
                  navigate(`${base}/${rotaAtual}/novo-candidato?vaga=${vaga.id}&etapa=${etapa.id}`)
                }}
                className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <UserPlus size={15} /> Cadastrar um candidato
              </button>
              <button
                onClick={() => {
                  setImportAlvo(registroAlvo)
                  setRegistroAlvo(null)
                }}
                className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Upload size={15} /> Importar currículos em massa
              </button>
            </div>
          </div>
        </div>
      )}

      {importAlvo && (
        <BulkCurriculoDropzone
          vagaId={importAlvo.vaga.id}
          etapaId={importAlvo.etapa.id}
          cpfsExistentes={
            new Set(
              candidatos
                .filter((c) => c.vaga_id === importAlvo.vaga.id)
                .map((c) => c.cpf.replace(/\D/g, ''))
                .filter(Boolean),
            )
          }
          onCandidatoCriado={() => {
            qc.invalidateQueries({ queryKey: queryKeys.vagas })
            qc.invalidateQueries({ queryKey: queryKeys.candidatos })
          }}
          onClose={() => setImportAlvo(null)}
        />
      )}
    </div>
  )
}
