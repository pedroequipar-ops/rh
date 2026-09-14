import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useVagas, useTransicionarVaga } from '../../api/hooks/useVagas'
import { useCandidatos } from '../../api/hooks/useCandidatos'
import { useSetores } from '../../api/hooks/useSetores'
import { useUsuarios } from '../../api/hooks/useUsuarios'
import { BoardFilters } from '../../components/board/BoardFilters'
import { BuscarButton } from '../../components/board/BuscarButton'
import { useBoardFilters } from '../../components/board/useBoardFilters'
import { BoardSwitcher } from '../../components/kanban/BoardSwitcher'
import { VagasBoard } from '../../components/kanban/VagasBoard'
import { vagaIdFromLocation } from '../../lib/selectedVaga'
import type { VagaStatus } from '../../types'

export function VagasBoardPage() {
  const { me } = useAuth()
  const location = useLocation()
  const isRh = me?.role === 'RH'
  const base = isRh ? '/rh' : '/setor'
  const selectedVagaId = vagaIdFromLocation(location.pathname, location.search)

  const vagasQuery = useVagas()
  const candidatosQuery = useCandidatos()
  const setoresQuery = useSetores()
  const usuariosQuery = useUsuarios(isRh)
  const transicionarVaga = useTransicionarVaga()
  const filters = useBoardFilters('vagas')

  const vagas = vagasQuery.data ?? []
  const vagasFiltradas = filters.apply(vagas)
  const totalPessoas = candidatosQuery.data?.length ?? 0
  const totalTriagem = vagas.filter((v) => v.status === 'EM_TRIAGEM').length
  const loading = vagasQuery.isLoading

  function handleMoveVaga(vagaId: string, status: VagaStatus, observacao?: string) {
    transicionarVaga.mutate({ id: vagaId, para: status, observacao })
  }

  return (
    <div className="flex h-full flex-col bg-board">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-4">
          <BoardSwitcher
            vagasHref={`${base}/vagas`}
            triagemHref={`${base}/triagem`}
            pessoasHref={`${base}/pessoas`}
            totalVagas={vagas.length}
            totalTriagem={totalTriagem}
            totalPessoas={totalPessoas}
          />
        </div>
        <div className="flex items-center gap-2">
          <BoardFilters
            filters={filters}
            setores={(setoresQuery.data ?? []).map((s) => ({ value: s.id, label: s.nome }))}
            usuarios={(usuariosQuery.data ?? []).map((u) => ({ value: u.id, label: u.username }))}
          />
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
            <VagasBoard
              vagas={vagasFiltradas}
              draggable={isRh}
              vagaModalBase={`${base}/vagas/vaga`}
              novaVagaHref={`${base}/vagas/nova-vaga`}
              onMoveVaga={isRh ? handleMoveVaga : undefined}
              selectedVagaId={selectedVagaId}
            />
          </div>
        )}
        <Outlet />
      </div>
    </div>
  )
}
