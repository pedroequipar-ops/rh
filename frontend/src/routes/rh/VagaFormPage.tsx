import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createVaga, listSetores } from '../../api/vagas'
import { useAuth } from '../../context/AuthContext'
import type { Setor } from '../../types'

export function VagaFormPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const isRh = me?.role === 'RH'

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [quantidadeVagas, setQuantidadeVagas] = useState(1)
  const [salario, setSalario] = useState('')
  const [setorId, setSetorId] = useState('')
  const [setores, setSetores] = useState<Setor[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isRh) return
    listSetores()
      .then(setSetores)
      .catch(() => setSetores([]))
  }, [isRh])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createVaga({
        titulo,
        descricao,
        requisitos,
        quantidade_vagas: quantidadeVagas,
        salario: salario || null,
        ...(isRh ? { setor_id: setorId } : {}),
      })
      navigate(isRh ? '/rh/kanban' : '/setor/kanban')
    } catch {
      setError('Não foi possível criar a vaga. Confira os campos e tente novamente.')
    } finally {
      setSubmitting(false)
    }
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
            className="min-h-[4.5rem] max-h-[16rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
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

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Criar vaga'}
        </button>
      </form>
    </div>
  )
}
