import { useState } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import clsx from 'clsx'
import { useVagas, useDeleteVaga } from '../api/hooks/useVagas'
import { useCandidatos, useDeleteCandidato } from '../api/hooks/useCandidatos'
import { useAuth } from '../context/AuthContext'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { BuscaCandidatosIa, type BuscaCandidatosIaResultado } from '../components/candidato/BuscaCandidatosIa'
import { CandidatosTable } from './listagem/CandidatosTable'
import { VagasTable } from './listagem/VagasTable'
import type { Candidato, Vaga } from '../types'

type Aba = 'candidatos' | 'vagas'

/** `embedded`: renderizada dentro de Configurações (sem padding externo próprio). */
export function ListagemPage({ embedded = false }: { embedded?: boolean }) {
  const location = useLocation()
  const { me } = useAuth()
  const isRh = me?.role === 'RH'
  const base = isRh ? '/rh' : '/setor'

  const vagasQuery = useVagas()
  const candidatosQuery = useCandidatos()
  const deleteVagaMut = useDeleteVaga()
  const deleteCandidatoMut = useDeleteCandidato()

  const vagas = vagasQuery.data ?? []
  const candidatos = candidatosQuery.data ?? []
  const loading = vagasQuery.isLoading || candidatosQuery.isLoading

  const [mostrarEncerradas, setMostrarEncerradas] = useState(false)
  const [vagaParaExcluir, setVagaParaExcluir] = useState<Vaga | null>(null)
  const [candidatoParaExcluir, setCandidatoParaExcluir] = useState<Candidato | null>(null)
  const [buscaIa, setBuscaIa] = useState<BuscaCandidatosIaResultado | null>(null)

  const [params, setParams] = useSearchParams()
  const aba: Aba = params.get('aba') === 'vagas' ? 'vagas' : 'candidatos'

  function setAba(next: Aba) {
    const updated = new URLSearchParams(params)
    updated.set('aba', next)
    setParams(updated, { replace: true })
  }

  const vagasEncerradas = vagas.filter((v) => v.status === 'CANCELADA' || v.status === 'PREENCHIDA')
  const vagasAtivas = vagas.filter((v) => v.status !== 'CANCELADA' && v.status !== 'PREENCHIDA')
  const vagasVisiveis = mostrarEncerradas ? vagas : vagasAtivas

  const abas: { id: Aba; label: string; count: number }[] = [
    { id: 'candidatos', label: 'Candidatos cadastrados', count: candidatos.length },
    { id: 'vagas', label: 'Vagas ativas', count: vagasAtivas.length },
  ]

  if (loading) {
    return <p className="p-6 text-sm text-slate-400">Carregando...</p>
  }

  return (
    <div className={clsx('flex h-full flex-col gap-4', !embedded && 'p-4 sm:p-6')}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <nav className="flex gap-1">
          {abas.map((item) => (
            <button
              key={item.id}
              onClick={() => setAba(item.id)}
              className={clsx(
                'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                aba === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {item.label}
              <span
                className={clsx(
                  'rounded-full px-1.5 text-xs',
                  aba === item.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600',
                )}
              >
                {item.count}
              </span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {aba === 'candidatos' && <BuscaCandidatosIa onResultado={setBuscaIa} />}
          {aba === 'vagas' && vagasEncerradas.length > 0 && (
            <button
              onClick={() => setMostrarEncerradas((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
            >
              {mostrarEncerradas ? 'ocultar encerradas' : `+ ${vagasEncerradas.length} encerrada(s)`}
            </button>
          )}
          <Link
            to={aba === 'vagas' ? `${base}/vagas` : `${base}/pessoas`}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LayoutGrid size={14} />
            Ver no board
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {aba === 'candidatos' ? (
          <CandidatosTable
            candidatos={buscaIa ? buscaIa.resultados : candidatos}
            basePath={location.pathname}
            isRh={isRh}
            onDelete={setCandidatoParaExcluir}
          />
        ) : (
          <VagasTable vagas={vagasVisiveis} basePath={location.pathname} onDelete={setVagaParaExcluir} />
        )}
      </div>

      {candidatoParaExcluir && (
        <ConfirmDialog
          title="Excluir candidato"
          description={`Tem certeza que deseja excluir "${candidatoParaExcluir.nome}"?`}
          onConfirm={() => {
            deleteCandidatoMut.mutate(candidatoParaExcluir.id)
            setCandidatoParaExcluir(null)
          }}
          onCancel={() => setCandidatoParaExcluir(null)}
        />
      )}

      {vagaParaExcluir && (
        <ConfirmDialog
          title="Excluir vaga"
          description={`Tem certeza que deseja excluir a vaga "${vagaParaExcluir.titulo}"?`}
          onConfirm={() => {
            deleteVagaMut.mutate(vagaParaExcluir.id)
            setVagaParaExcluir(null)
          }}
          onCancel={() => setVagaParaExcluir(null)}
        />
      )}

      <Outlet />
    </div>
  )
}
