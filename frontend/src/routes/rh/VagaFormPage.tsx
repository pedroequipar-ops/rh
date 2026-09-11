import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listSetores } from '../../api/vagas'
import { useCreateVaga } from '../../api/hooks/useVagas'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { MOTIVO_SOLICITACAO_OPCOES } from '../../constants/vagaStatus'
import { Button, Field, FormModal, Input, Select, Textarea } from '../../components/ui'
import type { Setor, VagaPrioridade } from '../../types'

const FORM_ID = 'vaga-form'

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h2>
  )
}

export function VagaFormPage() {
  const { me } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()
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
  const [error, setError] = useState<string | null>(null)
  const criarVaga = useCreateVaga()

  function fechar() {
    navigate(pathname.replace(/\/nova-vaga\/?$/, '') || (isRh ? '/rh/vagas' : '/setor/vagas'))
  }

  useEffect(() => {
    if (!isRh) return
    listSetores()
      .then(setSetores)
      .catch(() => setSetores([]))
  }, [isRh])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await criarVaga.mutateAsync({
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
        ...(isRh ? { setor_id: setorId } : {}),
      })
      showToast('Vaga criada com sucesso')
      navigate(isRh ? '/rh/vagas' : '/setor/vagas')
    } catch {
      setError('Não foi possível criar a vaga. Confira os campos e tente novamente.')
    }
  }

  return (
    <FormModal
      title="Nova vaga"
      description={
        isRh
          ? 'Preencha os dados para abrir a vaga no quadro.'
          : 'Descreva a necessidade e envie a solicitação para o RH.'
      }
      onClose={fechar}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} disabled={criarVaga.isPending}>
            {criarVaga.isPending ? 'Salvando...' : isRh ? 'Criar vaga' : 'Enviar solicitação'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <section className="space-y-4 border-t border-slate-100 pt-5 first:border-0 first:pt-0">
          <SectionTitle>Descrição</SectionTitle>
          <Field label="Título" htmlFor="vaga-titulo">
            <Input
              id="vaga-titulo"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </Field>
          <Field label="Descrição" htmlFor="vaga-descricao">
            <Textarea
              id="vaga-descricao"
              required
              rows={4}
              className="max-h-80 min-h-24"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </Field>
          <Field label="Requisitos" htmlFor="vaga-requisitos">
            <Textarea
              id="vaga-requisitos"
              required
              rows={3}
              className="max-h-64 min-h-24"
              value={requisitos}
              onChange={(e) => setRequisitos(e.target.value)}
            />
          </Field>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5 first:border-0 first:pt-0">
          <SectionTitle>Detalhes</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantidade de vagas" htmlFor="vaga-qtd">
              <Input
                id="vaga-qtd"
                type="number"
                min={1}
                required
                value={quantidadeVagas}
                onChange={(e) => setQuantidadeVagas(Number(e.target.value))}
              />
            </Field>
            <Field label="Salário" htmlFor="vaga-salario">
              <Input
                id="vaga-salario"
                value={salario}
                onChange={(e) => setSalario(e.target.value)}
                placeholder="Opcional"
              />
            </Field>
            <Field label="Prioridade" htmlFor="vaga-prioridade">
              <Select
                id="vaga-prioridade"
                value={prioridade}
                onChange={(e) => setPrioridade(Number(e.target.value) as VagaPrioridade)}
              >
                <option value={1}>Baixa</option>
                <option value={2}>Média</option>
                <option value={3}>Alta</option>
              </Select>
            </Field>
            <Field label="Motivo" htmlFor="vaga-motivo">
              <Select
                id="vaga-motivo"
                value={motivoSolicitacao}
                onChange={(e) => setMotivoSolicitacao(e.target.value)}
              >
                {MOTIVO_SOLICITACAO_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={urgente}
              onChange={(e) => setUrgente(e.target.checked)}
            />
            <span>
              <span className="font-medium">Marcar como urgente</span>
              <span className="block text-xs text-slate-400">
                Destaca a vaga no quadro e nas cobranças.
              </span>
            </span>
          </label>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5 first:border-0 first:pt-0">
          <SectionTitle>Prazos</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início previsto" htmlFor="vaga-inicio">
              <Input
                id="vaga-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </Field>
            <Field label="Prazo p/ preencher" htmlFor="vaga-alvo">
              <Input
                id="vaga-alvo"
                type="date"
                value={dataAlvo}
                onChange={(e) => setDataAlvo(e.target.value)}
              />
            </Field>
          </div>
        </section>

        {isRh && (
          <section className="border-t border-slate-100 pt-5">
            <Field label="Setor solicitante" htmlFor="vaga-setor">
              <Select
                id="vaga-setor"
                required
                value={setorId}
                onChange={(e) => setSetorId(e.target.value)}
              >
                <option value="" disabled>
                  Selecione um setor
                </option>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </section>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </FormModal>
  )
}
