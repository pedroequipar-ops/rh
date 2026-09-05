import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Pencil, X } from 'lucide-react'
import { getVaga, listSetores, updateVaga } from '../../api/vagas'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { Setor, Vaga } from '../../types'

export function VagaDetalheModal() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { me } = useAuth()
  const { showToast } = useToast()
  const isRh = me?.role === 'RH'

  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [error, setError] = useState(false)
  const [editando, setEditando] = useState(false)
  const [setores, setSetores] = useState<Setor[]>([])

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [quantidadeVagas, setQuantidadeVagas] = useState(1)
  const [salario, setSalario] = useState('')
  const [setorId, setSetorId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    setVaga(null)
    setError(false)
    setEditando(false)

    getVaga(id)
      .then((v) => {
        if (active) setVaga(v)
      })
      .catch(() => {
        if (active) setError(true)
      })

    return () => {
      active = false
    }
  }, [id])

  function iniciarEdicao() {
    if (!vaga) return
    setTitulo(vaga.titulo)
    setDescricao(vaga.descricao)
    setRequisitos(vaga.requisitos)
    setQuantidadeVagas(vaga.quantidade_vagas)
    setSalario(vaga.salario != null ? String(vaga.salario) : '')
    setSetorId(vaga.setor.id)
    setErroSalvar(null)
    if (isRh && setores.length === 0) {
      listSetores()
        .then(setSetores)
        .catch(() => setSetores([]))
    }
    setEditando(true)
  }

  useEffect(() => {
    if (!vaga) return
    const params = new URLSearchParams(location.search)
    if (params.get('editar') === '1') {
      iniciarEdicao()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaga])

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    setErroSalvar(null)
    setSubmitting(true)
    try {
      const atualizada = await updateVaga(id, {
        titulo,
        descricao,
        requisitos,
        quantidade_vagas: quantidadeVagas,
        salario: salario || null,
        ...(isRh ? { setor_id: setorId } : {}),
      })
      setVaga(atualizada)
      setEditando(false)
      showToast('Vaga salva com sucesso')
    } catch {
      setErroSalvar('Não foi possível salvar. Confira os campos e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    const base = location.pathname.replace(/\/vaga\/.*$/, '')
    navigate(base)
  }

  if (!id) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
      <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="absolute -right-3 -top-3 z-10 rounded-full bg-white p-1.5 text-slate-500 shadow-md hover:text-slate-800"
        >
          <X size={18} />
        </button>

        <div className="scrollbar-thin max-h-[80vh] w-full overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
          {error && <p className="text-sm text-red-500">Não foi possível carregar esta vaga.</p>}

          {!error && !vaga && <p className="text-sm text-slate-400">Carregando...</p>}

          {!error && vaga && !editando && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{vaga.titulo}</h2>
                  <p className="text-sm text-slate-500">
                    Setor: {vaga.setor.nome} · Criada por {vaga.criado_por ?? '—'}
                  </p>
                </div>
                <button
                  onClick={iniciarEdicao}
                  className="flex shrink-0 items-center gap-1.5 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Pencil size={12} />
                  Editar
                </button>
              </div>

              <div className="flex gap-4 text-sm text-slate-600">
                <span>{vaga.quantidade_vagas} vaga(s)</span>
                <span>{vaga.salario ? `R$ ${vaga.salario}` : 'Salário não informado'}</span>
              </div>

              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Descrição
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {vaga.descricao || 'Sem descrição.'}
                </p>
              </div>

              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Requisitos
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {vaga.requisitos || 'Sem requisitos informados.'}
                </p>
              </div>
            </div>
          )}

          {!error && vaga && editando && (
            <form onSubmit={handleSalvar} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Editar vaga</h2>

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
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="min-h-[6rem] max-h-[16rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Requisitos</label>
                <textarea
                  rows={3}
                  value={requisitos}
                  onChange={(e) => setRequisitos(e.target.value)}
                  className="min-h-[6rem] max-h-[16rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-600">
                    Quantidade de vagas
                  </label>
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
                    {setores.map((setor) => (
                      <option key={setor.id} value={setor.id}>
                        {setor.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {erroSalvar && <p className="text-sm text-red-600">{erroSalvar}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
