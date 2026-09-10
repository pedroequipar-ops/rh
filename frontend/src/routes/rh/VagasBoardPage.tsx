import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useVagas, useTransicionarVaga } from '../../api/hooks/useVagas'
import { useCandidatos } from '../../api/hooks/useCandidatos'
import { BoardSwitcher } from '../../components/kanban/BoardSwitcher'
import { VagasBoard } from '../../components/kanban/VagasBoard'
import type { VagaStatus } from '../../types'

export function VagasBoardPage() {
  const { me } = useAuth()
  const isRh = me?.role === 'RH'
  const base = isRh ? '/rh' : '/setor'

  const vagasQuery = useVagas()
  const candidatosQuery = useCandidatos()
  const transicionarVaga = useTransicionarVaga()

  const vagas = vagasQuery.data ?? []
  const totalPessoas = candidatosQuery.data?.length ?? 0
  const loading = vagasQuery.isLoading

  function handleMoveVaga(vagaId: string, status: VagaStatus) {
    transicionarVaga.mutate({ id: vagaId, para: status })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
        <h1 className="text-lg font-semibold text-slate-800">Vagas</h1>
        <BoardSwitcher
          vagasHref={`${base}/vagas`}
          pessoasHref={`${base}/pessoas`}
          totalVagas={vagas.length}
          totalPessoas={totalPessoas}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Carregando...
          </div>
        ) : (
          <div className="min-w-0 flex-1 overflow-hidden">
            <VagasBoard
              vagas={vagas}
              draggable={isRh}
              vagaModalBase={`${base}/vagas/vaga`}
              onMoveVaga={isRh ? handleMoveVaga : undefined}
            />
          </div>
        )}
        <Outlet />
      </div>
    </div>
  )
}
