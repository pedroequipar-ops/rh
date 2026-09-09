import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Settings, SlidersHorizontal } from 'lucide-react'
import { listEtapas } from '../../api/etapas'
import { listCandidatos, moverEtapa } from '../../api/candidatos'
import { listVagas, moverVagaEtapa, transicionarVaga } from '../../api/vagas'
import { KanbanBoard } from '../../components/kanban/KanbanBoard'
import { EtapaColumnEditor } from '../../components/kanban/EtapaColumnEditor'
import { ConfigVagasModal } from '../../components/vaga/ConfigVagasModal'
import { useToast } from '../../context/ToastContext'
import { statusLabel } from '../../constants/vagaStatus'
import type { Candidato, EtapaKanban, Vaga, VagaStatus } from '../../types'

export function KanbanPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [etapas, setEtapas] = useState<EtapaKanban[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)

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

  async function handleMoveVaga(vagaId: string, status: VagaStatus) {
    const anterior = vagas
    setVagas((prev) => prev.map((v) => (v.id === vagaId ? { ...v, status } : v)))
    try {
      const atualizada = await transicionarVaga(vagaId, status)
      setVagas((prev) => prev.map((v) => (v.id === vagaId ? atualizada : v)))
      showToast(`Vaga movida para "${statusLabel(status)}"`)
      if (status === 'EM_TRIAGEM') load()
    } catch {
      setVagas(anterior)
      showToast('Não foi possível mover a vaga', 'error')
    }
  }

  async function handleMoveVagaEtapa(vagaId: string, etapaId: string) {
    const anterior = vagas
    const etapa = etapas.find((e) => e.id === etapaId) ?? null
    setVagas((prev) => prev.map((v) => (v.id === vagaId ? { ...v, etapa_atual: etapa } : v)))
    try {
      const atualizada = await moverVagaEtapa(vagaId, etapaId)
      setVagas((prev) => prev.map((v) => (v.id === vagaId ? atualizada : v)))
    } catch {
      setVagas(anterior)
      showToast('Não foi possível mover o card da vaga', 'error')
    }
  }

  function handleRegistrarCandidato(vaga: Vaga, etapa: EtapaKanban) {
    navigate(`/rh/candidatos/novo?vaga=${vaga.id}&etapa=${etapa.id}`)
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-lg font-semibold text-slate-800">Fluxo de vagas e candidatos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal size={14} />
            Config. de vagas
          </button>
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
        <EtapaColumnEditor etapas={etapas} onClose={() => setEditorOpen(false)} onChange={load} />
      )}
      {configOpen && <ConfigVagasModal onClose={() => setConfigOpen(false)} />}

      <Outlet context={{ onVagaChange: load }} />
    </div>
  )
}
