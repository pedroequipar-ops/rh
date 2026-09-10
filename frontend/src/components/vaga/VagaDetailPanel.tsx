import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, Flame, MessageCircle, Upload, UserPlus, X } from 'lucide-react'
import clsx from 'clsx'
import { ActivityFeed } from '../atividade/ActivityFeed'
import { BulkCurriculoDropzone } from '../candidato/BulkCurriculoDropzone'
import { ChatPanel } from '../candidato/ChatPanel'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ResponsavelPicker } from '../common/ResponsavelPicker'
import { TarefasSection } from '../tarefas/TarefasSection'
import { Badge, Button, InlineEdit, Select, Textarea, Tabs, TagInput } from '../ui'
import {
  useAprovarVaga,
  useCandidatosDaVaga,
  useCobrarVaga,
  useRecusarVaga,
  useRegistrarCandidaturas,
  useTransicionarVaga,
  useUpdateVaga,
} from '../../api/hooks/useVagas'
import { useSetores } from '../../api/hooks/useSetores'
import { useUsuarios } from '../../api/hooks/useUsuarios'
import { queryKeys } from '../../api/queryKeys'
import { useAuth } from '../../context/AuthContext'
import { notificacaoHref } from '../../lib/notificacaoHref'
import {
  MOTIVO_SOLICITACAO_OPCOES,
  PRIORIDADE_META,
  VAGA_STATUS_META,
  statusLabel,
} from '../../constants/vagaStatus'
import type { VagaInput } from '../../api/vagas'
import type { Vaga, VagaPrioridade, VagaStatus } from '../../types'

const ACAO_LABEL: Partial<Record<VagaStatus, string>> = {
  SOLICITADA: 'Enviar solicitação',
  APROVADA: 'Aprovar',
  PUBLICADA: 'Publicar',
  ENCERRADA: 'Encerrar candidaturas',
  EM_TRIAGEM: 'Iniciar triagem',
  CONGELADA: 'Congelar',
  CANCELADA: 'Cancelar vaga',
  PREENCHIDA: 'Marcar preenchida',
  RECUSADA: 'Recusar',
}

const PRIORIDADE_OPCOES = [
  { value: '1', label: 'Baixa' },
  { value: '2', label: 'Média' },
  { value: '3', label: 'Alta' },
]

interface VagaDetailPanelProps {
  vaga: Vaga
  onClose: () => void
}

export function VagaDetailPanel({ vaga, onClose }: VagaDetailPanelProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const qc = useQueryClient()
  const { me } = useAuth()
  const isRh = me?.role === 'RH'

  const updateVaga = useUpdateVaga()
  const transicionar = useTransicionarVaga()
  const aprovar = useAprovarVaga()
  const recusar = useRecusarVaga()
  const registrarCandidaturas = useRegistrarCandidaturas()
  const cobrar = useCobrarVaga()
  const setoresQuery = useSetores(isRh)
  const usuariosQuery = useUsuarios(isRh)
  const candidatosQuery = useCandidatosDaVaga(vaga.id)

  const [aba, setAba] = useState<'detalhes' | 'candidatos' | 'atividade'>('detalhes')
  const [acaoPendente, setAcaoPendente] = useState<'aprovar' | 'recusar' | null>(null)
  const [confirmar, setConfirmar] = useState<VagaStatus | null>(null)
  const [mostrarChat, setMostrarChat] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [aprovarPrioridade, setAprovarPrioridade] = useState<VagaPrioridade>(vaga.prioridade)
  const [aprovarUrgente, setAprovarUrgente] = useState(vaga.urgente)
  const [aprovarDataAlvo, setAprovarDataAlvo] = useState(vaga.data_alvo_preenchimento ?? '')

  async function salvar(input: Partial<VagaInput>): Promise<void> {
    await updateVaga.mutateAsync({ id: vaga.id, input })
  }

  async function registrarCandidaturasRecebidas(quantidade: number): Promise<void> {
    await registrarCandidaturas.mutateAsync({ id: vaga.id, quantidade })
  }

  function abrirAprovar() {
    setAprovarPrioridade(vaga.prioridade)
    setAprovarUrgente(vaga.urgente)
    setAprovarDataAlvo(vaga.data_alvo_preenchimento ?? '')
    setAcaoPendente('aprovar')
  }

  async function handleAprovar(event: FormEvent) {
    event.preventDefault()
    await aprovar.mutateAsync({
      id: vaga.id,
      input: {
        prioridade: aprovarPrioridade,
        urgente: aprovarUrgente,
        data_alvo_preenchimento: aprovarDataAlvo || null,
      },
    })
    setAcaoPendente(null)
  }

  async function handleRecusar(event: FormEvent) {
    event.preventDefault()
    if (!motivoRecusa.trim()) return
    await recusar.mutateAsync({ id: vaga.id, motivo: motivoRecusa.trim() })
    setAcaoPendente(null)
    setMotivoRecusa('')
  }

  async function handleCobrar() {
    const msg = window.prompt('Mensagem da cobrança (opcional):') ?? undefined
    if (msg === undefined) return
    await cobrar.mutateAsync({ id: vaga.id, mensagem: msg || undefined })
  }

  const statusMeta = VAGA_STATUS_META[vaga.status]
  const acoes = vaga.transicoes_disponiveis.filter((s) => s !== 'APROVADA' && s !== 'RECUSADA')
  const podeAprovar = vaga.transicoes_disponiveis.includes('APROVADA') && isRh
  const podeRecusar = vaga.transicoes_disponiveis.includes('RECUSADA') && isRh
  const podeRegistrarCandidato =
    isRh && (vaga.status === 'PUBLICADA' || vaga.status === 'ENCERRADA' || vaga.status === 'EM_TRIAGEM')

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-2">
          <InlineEdit
            value={vaga.titulo}
            onSave={(v) => salvar({ titulo: v })}
            className="text-base font-semibold text-slate-800"
          />
          <button
            onClick={onClose}
            className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Setor: {vaga.setor.nome} · Criada por {vaga.criado_por ?? '—'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={clsx('rounded border px-2 py-0.5 text-xs font-medium', statusMeta?.badge)}>
            {statusMeta?.label}
          </span>
          <button
            type="button"
            onClick={() => salvar({ urgente: !vaga.urgente })}
            className={clsx(
              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium transition-fast',
              vaga.urgente
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-slate-200 text-slate-400 hover:bg-slate-50',
            )}
          >
            <Flame size={12} /> Urgente
          </button>
          <span
            className={clsx(
              'rounded border px-2 py-0.5 text-xs font-medium',
              PRIORIDADE_META[vaga.prioridade].badge,
            )}
          >
            Prioridade {PRIORIDADE_META[vaga.prioridade].label}
          </span>
          {vaga.atrasada && <Badge tone="amber">Atrasada</Badge>}
          <ResponsavelPicker
            value={vaga.responsavel}
            usuarios={
              isRh
                ? usuariosQuery.data ?? []
                : me
                  ? [{ id: me.id, username: me.username, first_name: '', last_name: '' }]
                  : []
            }
            onChange={(usuarioId) => salvar({ responsavel_id: usuarioId })}
          />
        </div>
        <TagInput
          tags={vaga.tags}
          onChange={(nomes) => updateVaga.mutate({ id: vaga.id, input: { tags: nomes } })}
          className="mt-2"
        />
      </div>

      <Tabs
        className="shrink-0 px-4"
        value={aba}
        onChange={(v) => setAba(v as typeof aba)}
        tabs={[
          { value: 'detalhes', label: 'Detalhes' },
          { value: 'candidatos', label: 'Candidatos' },
          { value: 'atividade', label: 'Atividade' },
        ]}
      />

      {aba === 'detalhes' && (
        <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {vaga.status === 'RECUSADA' && vaga.motivo_recusa && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              Motivo da recusa: {vaga.motivo_recusa}
            </p>
          )}

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Descrição
            </h3>
            <InlineEdit
              value={vaga.descricao}
              type="textarea"
              placeholder="Sem descrição."
              onSave={(v) => salvar({ descricao: v })}
            />
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Requisitos
            </h3>
            <InlineEdit
              value={vaga.requisitos}
              type="textarea"
              placeholder="Sem requisitos informados."
              onSave={(v) => salvar({ requisitos: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Quantidade
              </h3>
              <InlineEdit
                value={String(vaga.quantidade_vagas)}
                type="number"
                onSave={(v) => salvar({ quantidade_vagas: Number(v) })}
              />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Salário
              </h3>
              <InlineEdit
                value={vaga.salario != null ? String(vaga.salario) : ''}
                placeholder="Não informado"
                onSave={(v) => salvar({ salario: v || null })}
              />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Início previsto
              </h3>
              <InlineEdit
                value={vaga.data_inicio_prevista ?? ''}
                type="date"
                onSave={(v) => salvar({ data_inicio_prevista: v || null })}
              />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Prazo p/ preencher
              </h3>
              <InlineEdit
                value={vaga.data_alvo_preenchimento ?? ''}
                type="date"
                onSave={(v) => salvar({ data_alvo_preenchimento: v || null })}
              />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Prioridade
              </h3>
              <InlineEdit
                value={String(vaga.prioridade)}
                type="select"
                options={PRIORIDADE_OPCOES}
                onSave={(v) => salvar({ prioridade: Number(v) as VagaPrioridade })}
              />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Motivo
              </h3>
              <InlineEdit
                value={vaga.motivo_solicitacao}
                type="select"
                options={MOTIVO_SOLICITACAO_OPCOES}
                onSave={(v) => salvar({ motivo_solicitacao: v })}
              />
            </div>
            {isRh && (
              <div className="col-span-2">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Setor solicitante
                </h3>
                <InlineEdit
                  value={vaga.setor.id}
                  type="select"
                  options={(setoresQuery.data ?? []).map((s) => ({ value: s.id, label: s.nome }))}
                  display={vaga.setor.nome}
                  onSave={(v) => salvar({ setor_id: v })}
                />
              </div>
            )}
            {vaga.status === 'EM_TRIAGEM' && (
              <div className="col-span-2">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {vaga.etapa_atual?.nome ?? 'Triagem'}: pessoas nesta fase
                </h3>
                <InlineEdit
                  value={String(vaga.qtd_pessoas_fase)}
                  type="number"
                  onSave={(v) => salvar({ qtd_pessoas_fase: Number(v) })}
                />
              </div>
            )}
            {vaga.status === 'PUBLICADA' && (
              <div className="col-span-2">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Candidaturas recebidas
                </h3>
                <InlineEdit
                  value={String(vaga.qtd_pessoas_fase)}
                  type="number"
                  onSave={(v) => registrarCandidaturasRecebidas(Number(v))}
                />
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ações</h3>

            {acaoPendente === 'aprovar' ? (
              <form onSubmit={handleAprovar} className="space-y-2">
                <Select
                  value={aprovarPrioridade}
                  onChange={(e) => setAprovarPrioridade(Number(e.target.value) as VagaPrioridade)}
                >
                  <option value={1}>Prioridade baixa</option>
                  <option value={2}>Prioridade média</option>
                  <option value={3}>Prioridade alta</option>
                </Select>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={aprovarUrgente}
                    onChange={(e) => setAprovarUrgente(e.target.checked)}
                  />
                  Urgente
                </label>
                <input
                  type="date"
                  value={aprovarDataAlvo}
                  onChange={(e) => setAprovarDataAlvo(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={aprovar.isPending} className="flex-1">
                    Confirmar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setAcaoPendente(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : acaoPendente === 'recusar' ? (
              <form onSubmit={handleRecusar} className="space-y-2">
                <Textarea
                  required
                  rows={3}
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  placeholder="Motivo da recusa"
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="danger" disabled={recusar.isPending} className="flex-1">
                    Recusar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setAcaoPendente(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-1.5">
                {podeAprovar && (
                  <Button onClick={abrirAprovar} className="w-full">
                    Aprovar
                  </Button>
                )}
                {podeRecusar && (
                  <Button variant="danger" onClick={() => setAcaoPendente('recusar')} className="w-full">
                    Recusar
                  </Button>
                )}
                {acoes.map((destino) => {
                  const label =
                    vaga.status === 'CONGELADA' && destino === vaga.status_pre_congelamento
                      ? 'Descongelar'
                      : ACAO_LABEL[destino] ?? statusLabel(destino)
                  const perigo = destino === 'CANCELADA'
                  return (
                    <Button
                      key={destino}
                      variant={perigo ? 'danger' : 'secondary'}
                      disabled={transicionar.isPending}
                      onClick={() =>
                        perigo
                          ? setConfirmar(destino)
                          : transicionar.mutate({ id: vaga.id, para: destino })
                      }
                      className="w-full"
                    >
                      {label}
                    </Button>
                  )
                })}
                <Button
                  variant="secondary"
                  onClick={handleCobrar}
                  disabled={cobrar.isPending}
                  className="w-full"
                >
                  <Bell size={13} /> Cobrar responsável
                </Button>
                {acoes.length === 0 && !podeAprovar && !podeRecusar && (
                  <p className="text-xs text-slate-400">Sem transições disponíveis.</p>
                )}
              </div>
            )}
          </div>

          <TarefasSection alvoTipo="VAGA" alvoId={vaga.id} />

          <Button
            variant="secondary"
            onClick={() => setMostrarChat((v) => !v)}
            className="w-full"
          >
            <MessageCircle size={13} /> Chat com o setor
          </Button>
          {mostrarChat && (
            <div className="h-80 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <ChatPanel kind="vaga" id={vaga.id} />
            </div>
          )}
        </div>
      )}

      {aba === 'candidatos' && (
        <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {podeRegistrarCandidato && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() =>
                  navigate(
                    `${pathname.replace(/\/vaga\/[^/]+$/, '')}/novo-candidato?vaga=${vaga.id}`,
                  )
                }
              >
                <UserPlus size={14} /> Novo candidato
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setImportOpen(true)}>
                <Upload size={14} /> Importar em massa
              </Button>
            </div>
          )}

          {(vaga.total_por_etapa ?? []).length > 0 && (
            <div className="space-y-1">
              {(vaga.total_por_etapa ?? []).map((e) => (
                <div key={e.etapa_id} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-28 shrink-0 truncate">{e.nome}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-blue-500"
                      style={{ width: `${(e.total / Math.max(vaga.total_candidatos, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right">{e.total}</span>
                </div>
              ))}
            </div>
          )}

          {candidatosQuery.isLoading && <p className="text-sm text-slate-400">Carregando...</p>}
          {!candidatosQuery.isLoading && (candidatosQuery.data ?? []).length === 0 && (
            <p className="text-sm text-slate-400">Nenhum candidato ainda.</p>
          )}
          {(candidatosQuery.data ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(notificacaoHref(me?.role ?? 'SETOR', 'candidato', c.id))}
              className="flex w-full items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="min-w-0 truncate font-medium text-slate-800">{c.nome}</span>
              <span className="shrink-0 text-xs text-slate-400">{c.etapa_atual.nome}</span>
            </button>
          ))}
        </div>
      )}

      {aba === 'atividade' && (
        <div className="min-h-0 flex-1">
          <ActivityFeed alvoTipo="vaga" alvoId={vaga.id} />
        </div>
      )}

      {confirmar && (
        <ConfirmDialog
          title={ACAO_LABEL[confirmar] ?? statusLabel(confirmar)}
          description={`Confirmar mudança da vaga para "${statusLabel(confirmar)}"?`}
          confirmLabel="Confirmar"
          onConfirm={() => {
            transicionar.mutate({ id: vaga.id, para: confirmar })
            setConfirmar(null)
          }}
          onCancel={() => setConfirmar(null)}
        />
      )}

      {importOpen && (
        <BulkCurriculoDropzone
          vagaId={vaga.id}
          cpfsExistentes={
            new Set(
              (candidatosQuery.data ?? [])
                .map((c) => c.cpf.replace(/\D/g, ''))
                .filter(Boolean),
            )
          }
          onCandidatoCriado={() => {
            qc.invalidateQueries({ queryKey: queryKeys.vagaCandidatos(vaga.id) })
            qc.invalidateQueries({ queryKey: queryKeys.candidatosList })
            qc.invalidateQueries({ queryKey: queryKeys.vaga(vaga.id) })
          }}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  )
}
