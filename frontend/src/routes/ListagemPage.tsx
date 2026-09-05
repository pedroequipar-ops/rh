import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Trash2, Pencil, Eye, EyeOff, X } from 'lucide-react'
import { listVagas, listSetores, deleteVaga } from '../api/vagas'
import { listCandidatos, deleteCandidato } from '../api/candidatos'
import { listUsuarios, deleteUsuario, deleteSetor, updateSetor, updateUsuario } from '../api/accounts'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import type { Candidato, Setor, Usuario, Vaga } from '../types'

function SetorEditModal({
  setor,
  onClose,
  onSaved,
}: {
  setor: Setor
  onClose: () => void
  onSaved: (setor: Setor) => void
}) {
  const { showToast } = useToast()
  const [nome, setNome] = useState(setor.nome)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const atualizado = await updateSetor(setor.id, { nome })
      onSaved(atualizado)
      onClose()
      showToast('Setor salvo com sucesso')
    } catch {
      setError('Não foi possível salvar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Editar setor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function UsuarioEditModal({
  usuario,
  setores,
  onClose,
  onSaved,
}: {
  usuario: Usuario
  setores: Setor[]
  onClose: () => void
  onSaved: (usuario: Usuario) => void
}) {
  const { showToast } = useToast()
  const [username, setUsername] = useState(usuario.username)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [setorId, setSetorId] = useState(usuario.setor?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await updateUsuario(usuario.id, {
        username,
        ...(password ? { password } : {}),
        ...(setorId ? { setor_id: setorId } : {}),
      })
      const setorAtualizado = setores.find((s) => s.id === setorId) ?? usuario.setor
      onSaved({ ...usuario, username, setor: setorAtualizado })
      onClose()
      showToast('Usuário salvo com sucesso')
    } catch {
      setError('Não foi possível salvar. Confira os campos e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Editar usuário</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Usuário</label>
            <input
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Nova senha (opcional)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para manter"
                className="w-full rounded border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Setor</label>
            <select
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
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function ListagemPage() {
  const location = useLocation()
  const { me } = useAuth()
  const { showToast } = useToast()
  const isRh = me?.role === 'RH'

  const [vagas, setVagas] = useState<Vaga[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)

  const [vagaParaExcluir, setVagaParaExcluir] = useState<Vaga | null>(null)
  const [candidatoParaExcluir, setCandidatoParaExcluir] = useState<Candidato | null>(null)
  const [setorParaExcluir, setSetorParaExcluir] = useState<Setor | null>(null)
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState<Usuario | null>(null)
  const [setorParaEditar, setSetorParaEditar] = useState<Setor | null>(null)
  const [usuarioParaEditar, setUsuarioParaEditar] = useState<Usuario | null>(null)

  const load = useCallback(async () => {
    const [v, c] = await Promise.all([listVagas(), listCandidatos()])
    setVagas(v)
    setCandidatos(c)
    if (isRh) {
      const [s, u] = await Promise.all([listSetores(), listUsuarios()])
      setSetores(s)
      setUsuarios(u)
    }
  }, [isRh])

  useEffect(() => {
    load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConfirmDeleteVaga() {
    if (!vagaParaExcluir) return
    const id = vagaParaExcluir.id
    setVagaParaExcluir(null)
    setVagas((prev) => prev.filter((v) => v.id !== id))
    try {
      await deleteVaga(id)
      showToast('Vaga excluída com sucesso')
    } catch {
      load()
      showToast('Não foi possível excluir a vaga', 'error')
    }
  }

  async function handleConfirmDeleteCandidato() {
    if (!candidatoParaExcluir) return
    const id = candidatoParaExcluir.id
    setCandidatoParaExcluir(null)
    setCandidatos((prev) => prev.filter((c) => c.id !== id))
    try {
      await deleteCandidato(id)
      showToast('Candidato excluído com sucesso')
    } catch {
      load()
      showToast('Não foi possível excluir o candidato', 'error')
    }
  }

  async function handleConfirmDeleteSetor() {
    if (!setorParaExcluir) return
    const id = setorParaExcluir.id
    setSetorParaExcluir(null)
    setSetores((prev) => prev.filter((s) => s.id !== id))
    try {
      await deleteSetor(id)
      showToast('Setor excluído com sucesso')
    } catch {
      load()
      showToast('Não foi possível excluir o setor', 'error')
    }
  }

  async function handleConfirmDeleteUsuario() {
    if (!usuarioParaExcluir) return
    const id = usuarioParaExcluir.id
    setUsuarioParaExcluir(null)
    setUsuarios((prev) => prev.filter((u) => u.id !== id))
    try {
      await deleteUsuario(id)
      showToast('Usuário excluído com sucesso')
    } catch {
      load()
      showToast('Não foi possível excluir o usuário', 'error')
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-slate-400">Carregando...</p>
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:h-[calc(100vh-57px)] lg:grid-cols-2 lg:grid-rows-2 lg:overflow-hidden">
      <section className="flex min-h-0 flex-col">
        <h2 className="mb-3 shrink-0 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Candidatos cadastrados ({candidatos.length})
        </h2>
        {candidatos.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum candidato cadastrado.</p>
        ) : (
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Vaga</th>
                  <th className="px-4 py-2">Etapa</th>
                  {isRh && <th className="px-4 py-2 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidatos.map((candidato) => (
                  <tr key={candidato.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`${location.pathname}/candidato/${candidato.id}`}
                        className="font-medium text-slate-800 hover:underline"
                      >
                        {candidato.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{candidato.vaga_titulo}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {candidato.etapa_atual.nome}
                      </span>
                    </td>
                    {isRh && (
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <Link
                          to={`/rh/candidatos/${candidato.id}/editar`}
                          className="inline-flex rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Editar candidato"
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          onClick={() => setCandidatoParaExcluir(candidato)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Excluir candidato"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex min-h-0 flex-col">
        <h2 className="mb-3 shrink-0 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Vagas ativas ({vagas.length})
        </h2>
        {vagas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma vaga ativa.</p>
        ) : (
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Título</th>
                  <th className="px-4 py-2">Setor</th>
                  <th className="px-4 py-2">Vagas</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vagas.map((vaga) => (
                  <tr key={vaga.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`${location.pathname}/vaga/${vaga.id}`}
                        className="font-medium text-slate-800 hover:underline"
                      >
                        {vaga.titulo}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{vaga.setor.nome}</td>
                    <td className="px-4 py-2.5 text-slate-600">{vaga.quantidade_vagas}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <Link
                        to={`${location.pathname}/vaga/${vaga.id}?editar=1`}
                        className="inline-flex rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Editar vaga"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        onClick={() => setVagaParaExcluir(vaga)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Excluir vaga"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isRh && (
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-3 shrink-0 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Setores ({setores.length})
          </h2>
          {setores.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum setor cadastrado.</p>
          ) : (
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Nome</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {setores.map((setor) => (
                    <tr key={setor.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{setor.nome}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <button
                          onClick={() => setSetorParaEditar(setor)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Editar setor"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setSetorParaExcluir(setor)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Excluir setor"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {isRh && (
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-3 shrink-0 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Usuários ({usuarios.length})
          </h2>
          {usuarios.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Usuário</th>
                    <th className="px-4 py-2">Setor</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{usuario.username}</td>
                      <td className="px-4 py-2.5 text-slate-600">{usuario.setor?.nome ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <button
                          onClick={() => setUsuarioParaEditar(usuario)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Editar usuário"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setUsuarioParaExcluir(usuario)}
                          disabled={usuario.id === me?.id}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          aria-label="Excluir usuário"
                          title={usuario.id === me?.id ? 'Você não pode excluir seu próprio usuário' : undefined}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {candidatoParaExcluir && (
        <ConfirmDialog
          title="Excluir candidato"
          description={`Tem certeza que deseja excluir "${candidatoParaExcluir.nome}"?`}
          onConfirm={handleConfirmDeleteCandidato}
          onCancel={() => setCandidatoParaExcluir(null)}
        />
      )}

      {vagaParaExcluir && (
        <ConfirmDialog
          title="Excluir vaga"
          description={`Tem certeza que deseja excluir a vaga "${vagaParaExcluir.titulo}"?`}
          onConfirm={handleConfirmDeleteVaga}
          onCancel={() => setVagaParaExcluir(null)}
        />
      )}

      {setorParaExcluir && (
        <ConfirmDialog
          title="Excluir setor"
          description={`Tem certeza que deseja excluir o setor "${setorParaExcluir.nome}"?`}
          onConfirm={handleConfirmDeleteSetor}
          onCancel={() => setSetorParaExcluir(null)}
        />
      )}

      {usuarioParaExcluir && (
        <ConfirmDialog
          title="Excluir usuário"
          description={`Tem certeza que deseja excluir o usuário "${usuarioParaExcluir.username}"?`}
          onConfirm={handleConfirmDeleteUsuario}
          onCancel={() => setUsuarioParaExcluir(null)}
        />
      )}

      {setorParaEditar && (
        <SetorEditModal
          setor={setorParaEditar}
          onClose={() => setSetorParaEditar(null)}
          onSaved={(atualizado) =>
            setSetores((prev) => prev.map((s) => (s.id === atualizado.id ? atualizado : s)))
          }
        />
      )}

      {usuarioParaEditar && (
        <UsuarioEditModal
          usuario={usuarioParaEditar}
          setores={setores}
          onClose={() => setUsuarioParaEditar(null)}
          onSaved={(atualizado) =>
            setUsuarios((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)))
          }
        />
      )}

      <Outlet />
    </div>
  )
}
