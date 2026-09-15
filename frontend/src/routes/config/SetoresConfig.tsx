import { Fragment, useState, type FormEvent } from 'react'
import { ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCreateSetor, useDeleteSetor, useSetores, useUpdateSetor } from '../../api/hooks/useSetores'
import { useCreateUsuario, useDeleteUsuario, useUpdateUsuario, useUsuarios } from '../../api/hooks/useUsuarios'
import { useAuth } from '../../context/AuthContext'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { cn } from '../../components/ui/cn'
import { Dialog, EmptyState, InlineEdit } from '../../components/ui'
import type { Setor, Usuario } from '../../types'

const SEM_SETOR = 'sem-setor'

export function SetoresConfig() {
  const { me } = useAuth()
  const setoresQuery = useSetores()
  const usuariosQuery = useUsuarios()
  const criarSetor = useCreateSetor()
  const atualizarSetor = useUpdateSetor()
  const excluirSetor = useDeleteSetor()
  const criarUsuario = useCreateUsuario()
  const atualizarUsuario = useUpdateUsuario()
  const excluirUsuario = useDeleteUsuario()

  const [novoNome, setNovoNome] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [paraExcluirSetor, setParaExcluirSetor] = useState<Setor | null>(null)
  const [paraExcluirUsuario, setParaExcluirUsuario] = useState<Usuario | null>(null)
  const [paraEditar, setParaEditar] = useState<Usuario | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editSenha, setEditSenha] = useState('')
  const [editTelefone, setEditTelefone] = useState('')

  const setores = setoresQuery.data ?? []
  const usuarios = usuariosQuery.data ?? []
  const setorOpcoes = setores.map((s) => ({ value: s.id, label: s.nome }))
  const usuariosSemSetor = usuarios.filter((u) => !u.setor)

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAdicionarSetor(event: FormEvent) {
    event.preventDefault()
    if (!novoNome.trim()) return
    criarSetor.mutate({ nome: novoNome.trim() })
    setNovoNome('')
  }

  function abrirEdicao(usuario: Usuario) {
    setParaEditar(usuario)
    setEditUsername(usuario.username)
    setEditSenha('')
    setEditTelefone(usuario.telefone)
  }

  function handleSalvarEdicao(event: FormEvent) {
    event.preventDefault()
    if (!paraEditar) return
    if (!editUsername.trim()) return
    if (editSenha && editSenha.length < 8) return

    const input: { username?: string; password?: string; telefone?: string } = {}
    if (editUsername.trim() !== paraEditar.username) input.username = editUsername.trim()
    if (editSenha) input.password = editSenha
    if (editTelefone.trim() !== paraEditar.telefone) input.telefone = editTelefone.trim()
    if (Object.keys(input).length === 0) {
      setParaEditar(null)
      return
    }
    atualizarUsuario.mutate({ id: paraEditar.id, input }, { onSuccess: () => setParaEditar(null) })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <form onSubmit={handleAdicionarSetor} className="flex items-center gap-2">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Novo setor..."
          className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!novoNome.trim() || criarSetor.isPending}
          className="flex shrink-0 items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          <Plus size={14} /> Adicionar
        </button>
      </form>

      {setoresQuery.isLoading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : setores.length === 0 ? (
        <EmptyState title="Nenhum setor cadastrado." className="rounded-lg border border-slate-200 bg-white" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {setores.map((setor) => {
                const usuariosDoSetor = usuarios.filter((u) => u.setor?.id === setor.id)
                const aberto = expandidos.has(setor.id)
                return (
                  <SetorRow
                    key={setor.id}
                    setor={setor}
                    usuarios={usuariosDoSetor}
                    setorOpcoes={setorOpcoes}
                    aberto={aberto}
                    onToggle={() => toggleExpandido(setor.id)}
                    onExcluirSetor={() => setParaExcluirSetor(setor)}
                    onAtualizarSetor={(v) => atualizarSetor.mutateAsync({ id: setor.id, input: { nome: v } }).then(() => {})}
                    onAdicionarUsuario={(username, password) =>
                      criarUsuario.mutate({ username, password, setor_id: setor.id })
                    }
                    onMoverSetor={(usuario, setorId) =>
                      atualizarUsuario.mutateAsync({ id: usuario.id, input: { setor_id: setorId } }).then(() => {})
                    }
                    onEditar={abrirEdicao}
                    onExcluirUsuario={setParaExcluirUsuario}
                    meId={me?.id}
                    criarUsuarioPending={criarUsuario.isPending}
                  />
                )
              })}

              {usuariosSemSetor.length > 0 && (
                <SetorRow
                  setor={null}
                  usuarios={usuariosSemSetor}
                  setorOpcoes={setorOpcoes}
                  aberto={expandidos.has(SEM_SETOR)}
                  onToggle={() => toggleExpandido(SEM_SETOR)}
                  onMoverSetor={(usuario, setorId) =>
                    atualizarUsuario.mutateAsync({ id: usuario.id, input: { setor_id: setorId } }).then(() => {})
                  }
                  onEditar={abrirEdicao}
                  onExcluirUsuario={setParaExcluirUsuario}
                  meId={me?.id}
                />
              )}
            </tbody>
          </table>
        </div>
      )}

      {paraExcluirSetor && (
        <ConfirmDialog
          title="Excluir setor"
          description={`Tem certeza que deseja excluir o setor "${paraExcluirSetor.nome}"?`}
          onConfirm={() => {
            excluirSetor.mutate(paraExcluirSetor.id)
            setParaExcluirSetor(null)
          }}
          onCancel={() => setParaExcluirSetor(null)}
        />
      )}

      {paraExcluirUsuario && (
        <ConfirmDialog
          title="Excluir usuário"
          description={`Tem certeza que deseja excluir o usuário "${paraExcluirUsuario.username}"?`}
          onConfirm={() => {
            excluirUsuario.mutate(paraExcluirUsuario.id)
            setParaExcluirUsuario(null)
          }}
          onCancel={() => setParaExcluirUsuario(null)}
        />
      )}

      <Dialog
        open={Boolean(paraEditar)}
        onClose={() => setParaEditar(null)}
        title="Editar usuário"
        description={paraEditar ? `Alterar nome e/ou senha de "${paraEditar.username}"` : undefined}
      >
        <form onSubmit={handleSalvarEdicao} className="space-y-3">
          <input
            autoFocus
            value={editUsername}
            onChange={(e) => setEditUsername(e.target.value)}
            placeholder="Nome de usuário"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            type="password"
            minLength={8}
            value={editSenha}
            onChange={(e) => setEditSenha(e.target.value)}
            placeholder="Nova senha (deixe em branco pra manter)"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            value={editTelefone}
            onChange={(e) => setEditTelefone(e.target.value)}
            placeholder="WhatsApp (DDD + número, só dígitos)"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <p className="text-xs text-slate-400">
            Avisos de chat/atividade só chegam depois de mandar uma mensagem pro número do bot uma vez.
          </p>
          {editSenha && editSenha.length < 8 && (
            <p className="text-xs text-red-600">A senha precisa ter pelo menos 8 caracteres.</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setParaEditar(null)}
              className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!editUsername.trim() || (editSenha.length > 0 && editSenha.length < 8) || atualizarUsuario.isPending}
              className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

function SetorRow({
  setor,
  usuarios,
  setorOpcoes,
  aberto,
  onToggle,
  onExcluirSetor,
  onAtualizarSetor,
  onAdicionarUsuario,
  onMoverSetor,
  onEditar,
  onExcluirUsuario,
  meId,
  criarUsuarioPending,
}: {
  setor: Setor | null
  usuarios: Usuario[]
  setorOpcoes: { value: string; label: string }[]
  aberto: boolean
  onToggle: () => void
  onExcluirSetor?: () => void
  onAtualizarSetor?: (nome: string) => Promise<void>
  onAdicionarUsuario?: (username: string, password: string) => void
  onMoverSetor: (usuario: Usuario, setorId: string) => Promise<void>
  onEditar: (usuario: Usuario) => void
  onExcluirUsuario: (usuario: Usuario) => void
  meId?: string
  criarUsuarioPending?: boolean
}) {
  const [formAberto, setFormAberto] = useState(false)
  const [novoUsername, setNovoUsername] = useState('')
  const [novaSenha, setNovaSenha] = useState('')

  function handleAdicionar(event: FormEvent) {
    event.preventDefault()
    if (!novoUsername.trim() || novaSenha.length < 8 || !onAdicionarUsuario) return
    onAdicionarUsuario(novoUsername.trim(), novaSenha)
    setNovoUsername('')
    setNovaSenha('')
    setFormAberto(false)
  }

  return (
    <Fragment>
      <tr>
        <td className="w-8 py-2.5 pl-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={aberto ? 'Recolher usuários' : 'Ver usuários'}
          >
            <ChevronRight size={14} className={cn('transition-fast', aberto && 'rotate-90')} />
          </button>
        </td>
        <td className="px-2 py-2.5">
          {setor ? (
            <InlineEdit value={setor.nome} onSave={(v) => onAtualizarSetor?.(v)} />
          ) : (
            <span className="text-slate-500">Sem setor</span>
          )}
        </td>
        <td className="px-2 py-2.5 text-xs text-slate-400">
          {usuarios.length} usuário{usuarios.length === 1 ? '' : 's'}
        </td>
        <td className="w-10 px-2 py-2.5 text-right">
          {setor && (
            <button
              onClick={onExcluirSetor}
              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Excluir setor"
            >
              <Trash2 size={16} />
            </button>
          )}
        </td>
      </tr>

      {aberto && (
        <tr>
          <td colSpan={4} className="bg-slate-50 px-4 py-3">
            <div className="space-y-2 pl-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-slate-500">
                  {setor ? `Usuários de ${setor.nome}` : 'Sem setor — mova pra um setor'}
                </p>
                {setor && (
                  <button
                    type="button"
                    onClick={() => setFormAberto((v) => !v)}
                    className="flex items-center gap-1 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    aria-label={formAberto ? 'Fechar' : 'Adicionar usuário'}
                    title={formAberto ? 'Fechar' : 'Adicionar usuário'}
                  >
                    {formAberto ? <X size={14} /> : <Plus size={14} />}
                  </button>
                )}
              </div>

              {formAberto && (
                <form onSubmit={handleAdicionar} className="flex flex-wrap items-center gap-2">
                  <input
                    autoFocus
                    value={novoUsername}
                    onChange={(e) => setNovoUsername(e.target.value)}
                    placeholder="Nome de usuário"
                    className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Senha (mín. 8)"
                    minLength={8}
                    className="w-36 shrink-0 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!novoUsername.trim() || novaSenha.length < 8 || criarUsuarioPending}
                    className="flex shrink-0 items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    <Plus size={14} /> Adicionar
                  </button>
                </form>
              )}

              {usuarios.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum usuário neste setor.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {usuarios.map((usuario) => (
                        <tr key={usuario.id}>
                          <td className="px-3 py-2 text-slate-800">{usuario.username}</td>
                          {!setor && (
                            <td className="px-3 py-2">
                              <InlineEdit
                                value=""
                                type="select"
                                options={[{ value: '', label: 'Escolher setor...' }, ...setorOpcoes]}
                                display="— escolher setor —"
                                onSave={(v) => (v ? onMoverSetor(usuario, v) : undefined)}
                              />
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <button
                              onClick={() => onEditar(usuario)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Editar usuário"
                              title="Editar nome ou senha"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => onExcluirUsuario(usuario)}
                              disabled={usuario.id === meId}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                              aria-label="Excluir usuário"
                              title={usuario.id === meId ? 'Você não pode excluir seu próprio usuário' : undefined}
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
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}
