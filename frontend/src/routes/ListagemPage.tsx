import { useState, type FormEvent } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, Pencil, Eye, EyeOff, X } from 'lucide-react'
import { deleteSetor, deleteUsuario, updateSetor, updateUsuario } from '../api/accounts'
import { queryKeys } from '../api/queryKeys'
import { useVagas, useDeleteVaga } from '../api/hooks/useVagas'
import { useCandidatos, useDeleteCandidato } from '../api/hooks/useCandidatos'
import { useSetores } from '../api/hooks/useSetores'
import { useUsuarios } from '../api/hooks/useUsuarios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { PRIORIDADE_META, VAGA_STATUS_META } from '../constants/vagaStatus'
import type { Candidato, Setor, Usuario, Vaga } from '../types'
import clsx from 'clsx'

function SetorEditModal({
  setor,
  onClose,
  onSaved,
}: {
  setor: Setor
  onClose: () => void
  onSaved: () => void
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
      await updateSetor(setor.id, { nome })
      onSaved()
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
  onSaved: () => void
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
      onSaved()
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

type Aba = 'candidatos' | 'vagas' | 'setores' | 'usuarios'

export function ListagemPage() {
  const location = useLocation()
  const { me } = useAuth()
  const { showToast } = useToast()
  const qc = useQueryClient()
  const isRh = me?.role === 'RH'

  const vagasQuery = useVagas()
  const candidatosQuery = useCandidatos()
  const setoresQuery = useSetores(Boolean(isRh))
  const usuariosQuery = useUsuarios(Boolean(isRh))

  const vagas = vagasQuery.data ?? []
  const candidatos = candidatosQuery.data ?? []
  const setores = setoresQuery.data ?? []
  const usuarios = usuariosQuery.data ?? []
  const loading =
    vagasQuery.isLoading ||
    candidatosQuery.isLoading ||
    setoresQuery.isLoading ||
    usuariosQuery.isLoading

  const [mostrarEncerradas, setMostrarEncerradas] = useState(false)

  const vagasEncerradas = vagas.filter(
    (v) => v.status === 'CANCELADA' || v.status === 'PREENCHIDA',
  )
  const vagasAtivas = vagas.filter(
    (v) => v.status !== 'CANCELADA' && v.status !== 'PREENCHIDA',
  )
  const vagasVisiveis = mostrarEncerradas ? vagas : vagasAtivas

  const [vagaParaExcluir, setVagaParaExcluir] = useState<Vaga | null>(null)
  const [candidatoParaExcluir, setCandidatoParaExcluir] = useState<Candidato | null>(null)
  const [setorParaExcluir, setSetorParaExcluir] = useState<Setor | null>(null)
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState<Usuario | null>(null)
  const [setorParaEditar, setSetorParaEditar] = useState<Setor | null>(null)
  const [aba, setAba] = useState<Aba>('candidatos')
  const [usuarioParaEditar, setUsuarioParaEditar] = useState<Usuario | null>(null)

  const deleteVagaMut = useDeleteVaga()
  const deleteCandidatoMut = useDeleteCandidato()

  function handleConfirmDeleteVaga() {
    if (!vagaParaExcluir) return
    deleteVagaMut.mutate(vagaParaExcluir.id)
    setVagaParaExcluir(null)
  }

  function handleConfirmDeleteCandidato() {
    if (!candidatoParaExcluir) return
    deleteCandidatoMut.mutate(candidatoParaExcluir.id)
    setCandidatoParaExcluir(null)
  }

  async function handleConfirmDeleteSetor() {
    if (!setorParaExcluir) return
    const id = setorParaExcluir.id
    setSetorParaExcluir(null)
    try {
      await deleteSetor(id)
      qc.invalidateQueries({ queryKey: queryKeys.setores })
      showToast('Setor excluído com sucesso')
    } catch {
      showToast('Não foi possível excluir o setor', 'error')
    }
  }

  async function handleConfirmDeleteUsuario() {
    if (!usuarioParaExcluir) return
    const id = usuarioParaExcluir.id
    setUsuarioParaExcluir(null)
    try {
      await deleteUsuario(id)
      qc.invalidateQueries({ queryKey: queryKeys.usuarios })
      showToast('Usuário excluído com sucesso')
    } catch {
      showToast('Não foi possível excluir o usuário', 'error')
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-slate-400">Carregando...</p>
  }

  const abas: { id: Aba; label: string; count: number }[] = [
    { id: 'candidatos', label: 'Candidatos cadastrados', count: candidatos.length },
    { id: 'vagas', label: 'Vagas ativas', count: vagasAtivas.length },
    ...(isRh
      ? ([
          { id: 'setores', label: 'Setores', count: setores.length },
          { id: 'usuarios', label: 'Usuários', count: usuarios.length },
        ] as { id: Aba; label: string; count: number }[])
      : []),
  ]

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:flex-row sm:p-6">
      <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-56 sm:flex-col sm:overflow-visible">
        {abas.map((item) => (
          <button
            key={item.id}
            onClick={() => setAba(item.id)}
            className={clsx(
              'flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition',
              aba === item.id
                ? 'bg-violet-100 text-violet-700'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {item.label}
            <span
              className={clsx(
                'rounded-full px-1.5 text-xs',
                aba === item.id ? 'bg-violet-200 text-violet-700' : 'bg-slate-200 text-slate-600',
              )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
      {aba === 'candidatos' && (
      <section className="flex min-h-0 flex-1 flex-col">
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
                          to={`${location.pathname}/candidato/${candidato.id}`}
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
      )}

      {aba === 'vagas' && (
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Vagas ativas ({vagasAtivas.length})
          </h2>
          {vagasEncerradas.length > 0 && (
            <button
              onClick={() => setMostrarEncerradas((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
            >
              {mostrarEncerradas
                ? 'ocultar encerradas'
                : `+ ${vagasEncerradas.length} encerrada(s)`}
            </button>
          )}
        </div>
        {vagasVisiveis.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma vaga ativa.</p>
        ) : (
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Título</th>
                  <th className="px-4 py-2">Setor</th>
                  <th className="px-4 py-2">Etapa</th>
                  <th className="px-4 py-2">Vagas</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vagasVisiveis.map((vaga) => (
                  <tr key={vaga.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`${location.pathname}/vaga/${vaga.id}`}
                        className="font-medium text-slate-800 hover:underline"
                      >
                        {vaga.titulo}
                      </Link>
                      {vaga.urgente && (
                        <span className="ml-2 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                          Urgente
                        </span>
                      )}
                      {!vaga.urgente && vaga.prioridade === 3 && (
                        <span
                          className={clsx(
                            'ml-2 rounded border px-1.5 py-0.5 text-[11px] font-medium',
                            PRIORIDADE_META[3].badge,
                          )}
                        >
                          Alta
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{vaga.setor.nome}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={clsx(
                          'rounded border px-2 py-0.5 text-xs font-medium',
                          VAGA_STATUS_META[vaga.status]?.badge,
                        )}
                      >
                        {VAGA_STATUS_META[vaga.status]?.label ?? vaga.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{vaga.quantidade_vagas}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <Link
                        to={`${location.pathname}/vaga/${vaga.id}`}
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
      )}

      {isRh && aba === 'setores' && (
        <section className="flex min-h-0 flex-1 flex-col">
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

      {isRh && aba === 'usuarios' && (
        <section className="flex min-h-0 flex-1 flex-col">
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
      </div>

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
          onSaved={() => qc.invalidateQueries({ queryKey: queryKeys.setores })}
        />
      )}

      {usuarioParaEditar && (
        <UsuarioEditModal
          usuario={usuarioParaEditar}
          setores={setores}
          onClose={() => setUsuarioParaEditar(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: queryKeys.usuarios })}
        />
      )}

      <Outlet />
    </div>
  )
}
