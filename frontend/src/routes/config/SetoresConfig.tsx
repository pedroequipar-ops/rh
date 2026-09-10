import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCreateSetor, useDeleteSetor, useSetores, useUpdateSetor } from '../../api/hooks/useSetores'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { EmptyState, InlineEdit } from '../../components/ui'
import type { Setor } from '../../types'

export function SetoresConfig() {
  const setoresQuery = useSetores()
  const criar = useCreateSetor()
  const atualizar = useUpdateSetor()
  const excluir = useDeleteSetor()

  const [novoNome, setNovoNome] = useState('')
  const [paraExcluir, setParaExcluir] = useState<Setor | null>(null)

  const setores = setoresQuery.data ?? []

  function handleAdicionar(event: FormEvent) {
    event.preventDefault()
    if (!novoNome.trim()) return
    criar.mutate({ nome: novoNome.trim() })
    setNovoNome('')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <form onSubmit={handleAdicionar} className="flex items-center gap-2">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Novo setor..."
          className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!novoNome.trim() || criar.isPending}
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
              {setores.map((setor) => (
                <tr key={setor.id}>
                  <td className="px-4 py-2.5">
                    <InlineEdit
                      value={setor.nome}
                      onSave={(v) => atualizar.mutateAsync({ id: setor.id, input: { nome: v } }).then(() => {})}
                    />
                  </td>
                  <td className="w-10 px-2 py-2.5 text-right">
                    <button
                      onClick={() => setParaExcluir(setor)}
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

      {paraExcluir && (
        <ConfirmDialog
          title="Excluir setor"
          description={`Tem certeza que deseja excluir o setor "${paraExcluir.nome}"?`}
          onConfirm={() => {
            excluir.mutate(paraExcluir.id)
            setParaExcluir(null)
          }}
          onCancel={() => setParaExcluir(null)}
        />
      )}
    </div>
  )
}
