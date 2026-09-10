import { useState, type FormEvent } from 'react'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { useSetores } from '../../api/hooks/useSetores'
import { useCreateUsuario, useDeleteUsuario, useUpdateUsuario, useUsuarios } from '../../api/hooks/useUsuarios'
import { useAuth } from '../../context/AuthContext'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { Dialog, EmptyState, InlineEdit } from '../../components/ui'
import type { Usuario } from '../../types'

export function UsuariosConfig() {
  const { me } = useAuth()
  const usuariosQuery = useUsuarios()
  const setoresQuery = useSetores()
  const criar = useCreateUsuario()
  const atualizar = useUpdateUsuario()
  const excluir = useDeleteUsuario()

  const setores = setoresQuery.data ?? []
  const setorOpcoes = setores.map((s) => ({ value: s.id, label: s.nome }))

  const [novoUsername, setNovoUsername] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoSetorId, setNovoSetorId] = useState('')
  const [paraExcluir, setParaExcluir] = useState<Usuario | null>(null)
  const [paraRedefinirSenha, setParaRedefinirSenha] = useState<Usuario | null>(null)
  const [senhaDialog, setSenhaDialog] = useState('')

  const usuarios = usuariosQuery.data ?? []

  function handleAdicionar(event: FormEvent) {
    event.preventDefault()
    if (!novoUsername.trim() || !novaSenha || !novoSetorId) return
    criar.mutate(
      { username: novoUsername.trim(), password: novaSenha, setor_id: novoSetorId },
      {
        onSuccess: () => {
          setNovoUsername('')
          setNovaSenha('')
          setNovoSetorId('')
        },
      },
    )
  }

  function handleRedefinirSenha(event: FormEvent) {
    event.preventDefault()
    if (!paraRedefinirSenha || senhaDialog.length < 8) return
    atualizar.mutate(
      { id: paraRedefinirSenha.id, input: { password: senhaDialog } },
      { onSuccess: () => setParaRedefinirSenha(null) },
    )
    setSenhaDialog('')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <form onSubmit={handleAdicionar} className="flex flex-wrap items-center gap-2">
        <input
          value={novoUsername}
          onChange={(e) => setNovoUsername(e.target.value)}
          placeholder="Usuário"
          className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          placeholder="Senha (mín. 8)"
          minLength={8}
          className="w-36 shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          value={novoSetorId}
          onChange={(e) => setNovoSetorId(e.target.value)}
          className="shrink-0 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">Setor...</option>
          {setorOpcoes.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!novoUsername.trim() || novaSenha.length < 8 || !novoSetorId || criar.isPending}
          className="flex shrink-0 items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          <Plus size={14} /> Adicionar
        </button>
      </form>

      {usuariosQuery.isLoading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : usuarios.length === 0 ? (
        <EmptyState title="Nenhum usuário cadastrado." className="rounded-lg border border-slate-200 bg-white" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Usuário</th>
                <th className="px-4 py-2">Setor</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td className="px-4 py-2.5">
                    <InlineEdit
                      value={usuario.username}
                      onSave={(v) => atualizar.mutateAsync({ id: usuario.id, input: { username: v } }).then(() => {})}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <InlineEdit
                      value={usuario.setor?.id ?? ''}
                      type="select"
                      options={setorOpcoes}
                      display={usuario.setor?.nome ?? '—'}
                      onSave={(v) => atualizar.mutateAsync({ id: usuario.id, input: { setor_id: v } }).then(() => {})}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <button
                      onClick={() => setParaRedefinirSenha(usuario)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Redefinir senha"
                      title="Redefinir senha"
                    >
                      <KeyRound size={16} />
                    </button>
                    <button
                      onClick={() => setParaExcluir(usuario)}
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

      {paraExcluir && (
        <ConfirmDialog
          title="Excluir usuário"
          description={`Tem certeza que deseja excluir o usuário "${paraExcluir.username}"?`}
          onConfirm={() => {
            excluir.mutate(paraExcluir.id)
            setParaExcluir(null)
          }}
          onCancel={() => setParaExcluir(null)}
        />
      )}

      <Dialog
        open={Boolean(paraRedefinirSenha)}
        onClose={() => setParaRedefinirSenha(null)}
        title="Redefinir senha"
        description={paraRedefinirSenha ? `Nova senha para "${paraRedefinirSenha.username}"` : undefined}
      >
        <form onSubmit={handleRedefinirSenha} className="space-y-3">
          <input
            autoFocus
            type="password"
            minLength={8}
            value={senhaDialog}
            onChange={(e) => setSenhaDialog(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setParaRedefinirSenha(null)}
              className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={senhaDialog.length < 8 || atualizar.isPending}
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
