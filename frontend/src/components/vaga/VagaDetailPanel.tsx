import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightCircle,
  Bell,
  CheckCircle2,
  Flame,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { ActivityFeed } from '../atividade/ActivityFeed'
import { BulkCurriculoDropzone } from '../candidato/BulkCurriculoDropzone'
import { ChatPanel } from '../candidato/ChatPanel'
import { ResponsavelPicker } from '../common/ResponsavelPicker'
import { TarefasSection } from '../tarefas/TarefasSection'
import { TriagemIaPanel } from './TriagemIaPanel'
import { Badge, Button, IconAction, InlineEdit, Select, Textarea, Tabs, TagInput, TagSuggestions } from '../ui'
import {
  useAprovarVaga,
  useCandidatosDaVaga,
  useCobrarVaga,
  useMoverVagaEtapa,
  useRecusarVaga,
  useRegistrarCandidaturas,
  useSugerirTagsVaga,
  useTransicionarVaga,
  useVagaHistorico,
  useUpdateVaga,
} from '../../api/hooks/useVagas'
import { useEtapas } from '../../api/hooks/useEtapas'
import { useSetores } from '../../api/hooks/useSetores'
import { useUsuarios } from '../../api/hooks/useUsuarios'
import { ordenarEtapas } from '../kanban/etapaNav'
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
  EM_TRIAGEM: 'Iniciar triagem',
  RECUSADA: 'Recusar',
}

/** Não viram botão de transição genérico aqui: já dá pra arrastar (chip
 * Congelada, dock Avançar/menu Cancelar do board Triagem). PREENCHIDA é só
 * arrastando de propósito — Publicada→Preenchida pulando Em Triagem é uma
 * ação grande demais pra um botão, só o dock Avançar (de Publicada ou de
 * Triagem) chega lá. CANCELADA/ENCERRADA também ficam de fora do loop
 * genérico, mas têm botão próprio (Lixeira, motivo obrigatório) — ver
 * `statusLixeira` abaixo — pra não precisar abrir o board só pra descartar
 * antes de publicar. */
const ACOES_SO_POR_DRAG: VagaStatus[] = ['CONGELADA', 'ENCERRADA', 'CANCELADA', 'PREENCHIDA']

const PRIORIDADE_OPCOES = [
  { value: '1', label: 'Baixa' },
  { value: '2', label: 'Média' },
  { value: '3', label: 'Alta' },
]

/** Data "YYYY-MM-DD" (sem hora, sem fuso) -> "DD/MM/AAAA". */
function fmtDataCurta(data: string | null): string {
  if (!data) return 'Não informado'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
  const sugerirTagsVaga = useSugerirTagsVaga()
  const transicionar = useTransicionarVaga()
  const aprovar = useAprovarVaga()
  const recusar = useRecusarVaga()
  const registrarCandidaturas = useRegistrarCandidaturas()
  const cobrar = useCobrarVaga()
  const moverEtapa = useMoverVagaEtapa()
  const setoresQuery = useSetores(isRh)
  const usuariosQuery = useUsuarios(isRh)
  const candidatosQuery = useCandidatosDaVaga(vaga.id)
  const historicoQuery = useVagaHistorico(vaga.id)
  const etapasQuery = useEtapas(isRh && vaga.status === 'EM_TRIAGEM')

  const [aba, setAba] = useState<'detalhes' | 'candidatos' | 'triagem-ia' | 'chat' | 'atividade'>(
    'detalhes',
  )
  const [acaoPendente, setAcaoPendente] = useState<'aprovar' | 'recusar' | 'cobrar' | 'lixeira' | null>(
    null,
  )
  const [importOpen, setImportOpen] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [mensagemCobranca, setMensagemCobranca] = useState('')
  const [motivoLixeira, setMotivoLixeira] = useState('')
  const [aprovarPrioridade, setAprovarPrioridade] = useState<VagaPrioridade>(vaga.prioridade)
  const [aprovarUrgente, setAprovarUrgente] = useState(vaga.urgente)

  async function salvar(input: Partial<VagaInput>): Promise<void> {
    await updateVaga.mutateAsync({ id: vaga.id, input })
  }

  async function registrarCandidaturasRecebidas(quantidade: number): Promise<void> {
    await registrarCandidaturas.mutateAsync({ id: vaga.id, quantidade })
  }

  function abrirAprovar() {
    setAprovarPrioridade(vaga.prioridade)
    setAprovarUrgente(vaga.urgente)
    setAcaoPendente('aprovar')
  }

  async function handleAprovar(event: FormEvent) {
    event.preventDefault()
    await aprovar.mutateAsync({
      id: vaga.id,
      input: {
        prioridade: aprovarPrioridade,
        urgente: aprovarUrgente,
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

  async function handleCobrar(event: FormEvent) {
    event.preventDefault()
    await cobrar.mutateAsync({ id: vaga.id, mensagem: mensagemCobranca.trim() || undefined })
    setAcaoPendente(null)
    setMensagemCobranca('')
  }

  async function handleLixeira(event: FormEvent) {
    event.preventDefault()
    if (!statusLixeira || !motivoLixeira.trim()) return
    await transicionar.mutateAsync({ id: vaga.id, para: statusLixeira, observacao: motivoLixeira.trim() })
    setAcaoPendente(null)
    setMotivoLixeira('')
  }

  function handlePreencher() {
    transicionar.mutate({ id: vaga.id, para: 'PREENCHIDA' })
  }

  function handleAvancarEtapa() {
    if (proximaEtapaPreCadastro) {
      moverEtapa.mutate({ id: vaga.id, etapaId: proximaEtapaPreCadastro.id })
    } else if (naUltimaEtapaPreCadastro && etapaCadastroInicial) {
      navigate(
        `${isRh ? '/rh' : '/setor'}/triagem/novo-candidato?vagaId=${vaga.id}&etapaId=${etapaCadastroInicial.id}`,
      )
    }
  }

  const statusMeta = VAGA_STATUS_META[vaga.status]
  const historicoCandidaturas = (historicoQuery.data ?? []).filter((h) =>
    h.observacao.startsWith('Candidaturas recebidas'),
  )
  /** Publicada não mostra Recusar nem o arrow genérico pra Em Triagem — vira
   * o botão dedicado Preenchida (podePreencherDireto), pulando a Triagem de
   * propósito quando o candidato já foi decidido fora do funil. */
  const acoes = vaga.transicoes_disponiveis.filter(
    (s) =>
      s !== 'APROVADA' &&
      s !== 'RECUSADA' &&
      !ACOES_SO_POR_DRAG.includes(s) &&
      !(vaga.status === 'PUBLICADA' && s === 'EM_TRIAGEM'),
  )
  const podeAprovar = vaga.transicoes_disponiveis.includes('APROVADA') && isRh
  const podeRecusar =
    vaga.transicoes_disponiveis.includes('RECUSADA') && isRh && vaga.status !== 'PUBLICADA'
  const podePreencherDireto =
    vaga.status === 'PUBLICADA' && vaga.transicoes_disponiveis.includes('PREENCHIDA') && isRh
  /** Mesma prioridade do statusLixeiraDe do VagasBoard: ENCERRADA quando
   * disponível (vaga já publicada/em andamento), senão CANCELADA. */
  const statusLixeira = vaga.transicoes_disponiveis.includes('ENCERRADA')
    ? 'ENCERRADA'
    : vaga.transicoes_disponiveis.includes('CANCELADA')
      ? 'CANCELADA'
      : null
  const podeLixeira = !!statusLixeira && isRh
  /** Etapas pré-cadastro (aba Triagem) ordenadas — mesmo filtro do
   * PessoasBoardPage pra soTriagem=true: sem exigir cadastro completo, sem
   * ser a etapa de saída negativa (essa nunca é "próxima etapa" de avanço). */
  const etapasPreCadastro = ordenarEtapas(
    (etapasQuery.data ?? []).filter((e) => !e.exige_cadastro_completo && !e.is_saida_negativa),
  )
  const etapaCadastroInicial =
    (etapasQuery.data ?? [])
      .filter((e) => e.exige_cadastro_completo && !e.is_saida_negativa)
      .sort((a, b) => a.ordem - b.ordem)[0] ?? null
  const etapaAtualIndex =
    vaga.status === 'EM_TRIAGEM'
      ? etapasPreCadastro.findIndex((e) => e.id === vaga.etapa_atual?.id)
      : -1
  const proximaEtapaPreCadastro =
    etapaAtualIndex >= 0 && etapaAtualIndex + 1 < etapasPreCadastro.length
      ? etapasPreCadastro[etapaAtualIndex + 1]
      : null
  const naUltimaEtapaPreCadastro = etapaAtualIndex >= 0 && etapaAtualIndex === etapasPreCadastro.length - 1
  /** Quando ainda tem etapa pré-cadastro seguinte, avança só o card (mesmo
   * `onMoveVagaEtapa` do drag). Na última (ex.: Primeira Entrevista), avançar
   * abre o cadastro completo do candidato — mesma ação do dock "Avançar". */
  const podeAvancarEtapa =
    isRh && vaga.status === 'EM_TRIAGEM' && (!!proximaEtapaPreCadastro || (naUltimaEtapaPreCadastro && !!etapaCadastroInicial))
  const emPessoas = pathname.includes('/pessoas/')
  const podeRegistrarCandidato =
    isRh &&
    emPessoas &&
    (vaga.status === 'PUBLICADA' || vaga.status === 'ENCERRADA' || vaga.status === 'EM_TRIAGEM')

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-2">
          <InlineEdit
            value={vaga.titulo}
            disabled={!isRh}
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
        <div className="mt-1.5">
          <TagSuggestions
            nomesAtuais={vaga.tags.map((t) => t.nome)}
            onSugerir={() => sugerirTagsVaga.mutateAsync(vaga.id)}
            onAplicar={(nomes) => updateVaga.mutate({ id: vaga.id, input: { tags: nomes } })}
          />
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-200 px-4 py-2.5">
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
            <p className="text-xs text-slate-500">
              Prazo p/ preencher (pedido pelo setor):{' '}
              <span className="font-medium text-slate-700">
                {fmtDataCurta(vaga.data_alvo_preenchimento)}
              </span>
            </p>
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
              autoFocus
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
        ) : acaoPendente === 'cobrar' ? (
          <form onSubmit={handleCobrar} className="space-y-2">
            <Textarea
              rows={3}
              autoFocus
              value={mensagemCobranca}
              onChange={(e) => setMensagemCobranca(e.target.value)}
              placeholder="Mensagem da cobrança (opcional)"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={cobrar.isPending} className="flex-1">
                <Bell size={13} /> Cobrar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setAcaoPendente(null)
                  setMensagemCobranca('')
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : acaoPendente === 'lixeira' ? (
          <form onSubmit={handleLixeira} className="space-y-2">
            <Textarea
              required
              rows={3}
              autoFocus
              value={motivoLixeira}
              onChange={(e) => setMotivoLixeira(e.target.value)}
              placeholder="Motivo do descarte"
            />
            <div className="flex gap-2">
              <Button type="submit" variant="danger" disabled={transicionar.isPending} className="flex-1">
                Mandar pra lixeira
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setAcaoPendente(null)
                  setMotivoLixeira('')
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {podeAprovar && (
              <IconAction icon={CheckCircle2} label="Aprovar" variant="success" onClick={abrirAprovar} />
            )}
            {podeRecusar && (
              <IconAction
                icon={XCircle}
                label="Recusar"
                variant="danger"
                onClick={() => setAcaoPendente('recusar')}
              />
            )}
            {podeLixeira && (
              <IconAction
                icon={Trash2}
                label="Lixeira"
                variant="danger"
                onClick={() => setAcaoPendente('lixeira')}
              />
            )}
            {podePreencherDireto && (
              <IconAction
                icon={UserCheck}
                label="Preenchida"
                variant="success"
                disabled={transicionar.isPending}
                onClick={handlePreencher}
              />
            )}
            {podeAvancarEtapa && (
              <IconAction
                icon={ArrowRightCircle}
                label={proximaEtapaPreCadastro ? proximaEtapaPreCadastro.nome : 'Avançar'}
                variant="primary"
                disabled={moverEtapa.isPending}
                onClick={handleAvancarEtapa}
              />
            )}
            {acoes.map((destino) => {
              const label =
                vaga.status === 'CONGELADA' && destino === vaga.status_pre_congelamento
                  ? 'Descongelar'
                  : ACAO_LABEL[destino] ?? statusLabel(destino)
              return (
                <IconAction
                  key={destino}
                  icon={ArrowRightCircle}
                  label={label}
                  variant="primary"
                  disabled={transicionar.isPending}
                  onClick={() => transicionar.mutate({ id: vaga.id, para: destino })}
                />
              )
            })}
            <IconAction icon={Bell} label="Cobrar responsável" onClick={() => setAcaoPendente('cobrar')} />
          </div>
        )}
      </div>

      <Tabs
        className="shrink-0 px-4"
        value={aba}
        onChange={(v) => setAba(v as typeof aba)}
        tabs={[
          { value: 'detalhes', label: 'Detalhes' },
          ...(emPessoas ? [{ value: 'candidatos', label: 'Candidatos' }] : []),
          ...(isRh ? [{ value: 'triagem-ia', label: 'Triagem IA' }] : []),
          { value: 'chat', label: 'Chat' },
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
              disabled={!isRh}
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
              disabled={!isRh}
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
                disabled={!isRh}
                onSave={(v) => salvar({ quantidade_vagas: Number(v) })}
              />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Salário
              </h3>
              <InlineEdit
                value={vaga.salario != null ? String(vaga.salario) : ''}
                disabled={!isRh}
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
                disabled={!isRh}
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
                disabled={!isRh}
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
                disabled={!isRh}
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
                {historicoCandidaturas.length > 0 && (
                  <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto text-xs text-slate-500">
                    {historicoCandidaturas.map((h) => {
                      const m = h.observacao.match(/:\s*(\d+)(?:\s*\(\+(\d+)\))?/)
                      const quantidade = m?.[1] ?? h.observacao
                      const delta = m?.[2]
                      return (
                        <li key={h.id} className="flex items-center justify-between gap-2">
                          <span className="flex items-baseline gap-1">
                            <span className="font-medium text-slate-700">{quantidade}</span>
                            {delta && <span className="text-emerald-600">+{delta}</span>}
                          </span>
                          <span className="shrink-0 text-slate-400">{fmtDataHora(h.created_at)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <TarefasSection alvoTipo="VAGA" alvoId={vaga.id} />
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
                    `${pathname.replace(/\/vaga\/[^/]+$/, '')}/novo-candidato?vagaId=${vaga.id}`,
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

      {aba === 'triagem-ia' && (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
          <TriagemIaPanel vagaId={vaga.id} />
        </div>
      )}

      {aba === 'chat' && (
        <div className="min-h-0 flex-1">
          <ChatPanel kind="vaga" id={vaga.id} title={`Chat com ${vaga.setor.nome}`} />
        </div>
      )}

      {aba === 'atividade' && (
        <div className="min-h-0 flex-1">
          <ActivityFeed alvoTipo="vaga" alvoId={vaga.id} />
        </div>
      )}

      {importOpen && (
        <BulkCurriculoDropzone
          vagaId={vaga.id}
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
