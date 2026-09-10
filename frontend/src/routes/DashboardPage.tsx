import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../api/hooks/useDashboard'
import { useSetores } from '../api/hooks/useSetores'
import { useConcluirTarefa, useTarefas } from '../api/hooks/useTarefas'
import { BuscarButton } from '../components/board/BuscarButton'
import { StatCard } from '../components/dashboard/StatCard'
import { StatusBarList } from '../components/dashboard/StatusBarList'
import { FunnelChart } from '../components/dashboard/FunnelChart'
import { AtrasadasList } from '../components/dashboard/AtrasadasList'
import { Card } from '../components/ui/Card'

function fmtData(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtHoras(horas: number): string {
  if (horas >= 24) return `${(horas / 24).toFixed(1)}d`
  return `${horas.toFixed(1)}h`
}

export function DashboardPage() {
  const { me } = useAuth()
  const isRh = me?.role === 'RH'
  const [params, setParams] = useSearchParams()
  const setoresQuery = useSetores(isRh)

  const setorParam = params.get('setor') ?? ''
  const { data, isLoading } = useDashboard({ setor: setorParam || undefined })
  const tarefasQuery = useTarefas({ responsavel: me?.id, pendentes: true })
  const concluirTarefa = useConcluirTarefa()
  const tarefasVencendo = [...(tarefasQuery.data ?? [])]
    .sort((a, b) => {
      if (!a.due_at) return 1
      if (!b.due_at) return -1
      return a.due_at.localeCompare(b.due_at)
    })
    .slice(0, 5)

  function setSetor(valor: string) {
    const updated = new URLSearchParams(params)
    if (valor) updated.set('setor', valor)
    else updated.delete('setor')
    setParams(updated, { replace: true })
  }

  return (
    <div className="flex h-full flex-col bg-board">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
        <h1 className="text-lg font-semibold text-slate-800">
          {me ? `Olá, ${me.username}` : 'Dashboard'}
        </h1>
        <div className="flex items-center gap-2">
          {isRh && (
            <select
              value={setorParam}
              onChange={(e) => setSetor(e.target.value)}
              className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
            >
              <option value="">Todos os setores</option>
              {(setoresQuery.data ?? []).map((setor) => (
                <option key={setor.id} value={setor.id}>
                  {setor.nome}
                </option>
              ))}
            </select>
          )}
          <BuscarButton />
        </div>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
        {isLoading || !data ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Vagas ativas" value={data.resumo.ativas} />
              <StatCard label="Aguardando aprovação" value={data.resumo.aguardando_aprovacao} />
              <StatCard label="Preenchidas" value={data.resumo.preenchidas} />
              <StatCard
                label="Vagas atrasadas"
                value={data.resumo.atrasadas}
                tone={data.resumo.atrasadas > 0 ? 'danger' : 'default'}
              />
              <StatCard
                label="Tempo médio de preenchimento"
                value={data.tempo_medio_preenchimento != null ? fmtHoras(data.tempo_medio_preenchimento) : '—'}
              />
              <StatCard
                label="Chats aguardando resposta"
                value={data.chats_sem_resposta}
                tone={data.chats_sem_resposta > 0 ? 'danger' : 'default'}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Vagas por status</h2>
                <StatusBarList
                  items={data.vagas_por_status
                    .filter((s) => s.total > 0)
                    .map((s) => ({ key: s.status, label: s.status_display, total: s.total }))}
                />
              </Card>

              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Funil de etapas</h2>
                <FunnelChart etapas={data.funil_etapas} />
              </Card>

              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Prazos vencidos</h2>
                <AtrasadasList vagas={data.vagas_atrasadas} />
              </Card>

              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">Minhas tarefas (vencendo)</h2>
                  <Link to="/tarefas" className="text-xs text-blue-600 hover:underline">
                    Ver todas
                  </Link>
                </div>
                {tarefasQuery.isLoading && <p className="text-sm text-slate-400">Carregando...</p>}
                {!tarefasQuery.isLoading && tarefasVencendo.length === 0 && (
                  <p className="text-sm text-slate-400">Nenhuma tarefa vencendo.</p>
                )}
                <div className="flex flex-col gap-1.5">
                  {tarefasVencendo.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => concluirTarefa.mutate(t.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-700">{t.titulo}</span>
                      {t.due_at && <span className="shrink-0 text-xs text-red-500">{fmtData(t.due_at)}</span>}
                    </label>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">
                  Candidaturas informadas x cadastradas
                </h2>
                {data.candidaturas_vs_cadastrados.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma vaga publicada.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {data.candidaturas_vs_cadastrados.map((item) => (
                      <div key={item.vaga_id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-700">{item.titulo}</span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {item.candidaturas} informadas · {item.cadastrados} cadastradas
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Tempo médio por status</h2>
                <StatusBarList
                  items={data.tempo_medio_por_status.map((s) => ({
                    key: s.status,
                    label: s.status_display,
                    total: s.horas_media,
                  }))}
                  emptyMessage="Ainda sem transições suficientes."
                />
              </Card>

              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">Cobranças</h2>
                  <span className="text-xs text-slate-400">{data.cobrancas.total} no total</span>
                </div>
                {data.cobrancas.top_vagas.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma cobrança registrada.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {data.cobrancas.top_vagas.map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-700">{v.titulo}</span>
                        <span className="shrink-0 text-xs text-slate-400">{v.total_cobrancas}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
