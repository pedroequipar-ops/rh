import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createVaga, listSetores } from '../../api/vagas'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { MOTIVO_SOLICITACAO_OPCOES } from '../../constants/vagaStatus'
import type { Setor, VagaPrioridade } from '../../types'

export function VagaFormPage() {
  const { me } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const isRh = me?.role === 'RH'

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [quantidadeVagas, setQuantidadeVagas] = useState(1)
  const [salario, setSalario] = useState('')
  const [setorId, setSetorId] = useState('')
  const [setores, setSetores] = useState<Setor[]>([])
  const [prioridade, setPrioridade] = useState<VagaPrioridade>(2)
  const [urgente, setUrgente] = useState(false)
  const [motivoSolicitacao, setMotivoSolicitacao] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataAlvo, setDataAlvo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isRh) return
    listSetores()
      .then(setSetores)
      .catch(() => setSetores([]))
  }, [isRh])

  async function enviar(rascunho: boolean) {
    setError(null)
    setSubmitting(true)
    try {
      await createVaga({
        titulo,
        descricao,
        requisitos,
        quantidade_vagas: quantidadeVagas,
        salario: salario || null,
        prioridade,
        urgente,
        motivo_solicitacao: motivoSolicitacao || undefined,
        data_inicio_prevista: dataInicio || null,
        data_alvo_preenchimento: dataAlvo || null,
        ...(rascunho ? { status: 'RASCUNHO' as const } : {}),
        ...(isRh ? { setor_id: setorId } : {}),
      })
      showToast(rascunho ? 'Rascunho salvo' : 'Vaga criada com sucesso')
      navigate(isRh ? '/rh/kanban' : '/setor/kanban')
    } catch {
      setError('Não foi possível criar a vaga. Confira os campos e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    enviar(false)
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-slate-800">Nova vaga</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Título</label>
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Descrição</label>
          <textarea
            required
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="min-h-[6rem] max-h-[20rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Requisitos</label>
          <textarea
            required
            rows={3}
            value={requisitos}
            onChange={(e) => setRequisitos(e.target.value)}
            className="min-h-[6rem] max-h-[16rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Quantidade de vagas</label>
            <input
              type="number"
              min={1}
              required
              value={quantidadeVagas}
              onChange={(e) => setQuantidadeVagas(Number(e.target.value))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Salário</label>
            <input
              value={salario}
              onChange={(e) => setSalario(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Prioridade</label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(Number(e.target.value) as VagaPrioridade)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value={1}>Baixa</option>
              <option value={2}>Média</option>
              <option value={3}>Alta</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Motivo</label>
            <select
              value={motivoSolicitacao}
              onChange={(e) => setMotivoSolicitacao(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              {MOTIVO_SOLICITACAO_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
            Urgente
          </label>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Início previsto</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Prazo p/ preencher</label>
            <input
              type="date"
              value={dataAlvo}
              onChange={(e) => setDataAlvo(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        {isRh && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Setor solicitante</label>
            <select
              required
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="" disabled>
                Selecione um setor
              </option>
              {setores.map((setor) => (
                <option key={setor.id} value={setor.id}>
                  {setor.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : isRh ? 'Criar vaga' : 'Enviar solicitação'}
          </button>
          <button
            type="button"
            disabled={submitting || !titulo}
            onClick={() => enviar(true)}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Salvar rascunho
          </button>
        </div>
      </form>
    </div>
  )
}
