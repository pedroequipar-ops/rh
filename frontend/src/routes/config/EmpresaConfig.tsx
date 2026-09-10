import { useEmpresa, useUpdateEmpresa } from '../../api/hooks/useEmpresa'
import { Card, InlineEdit } from '../../components/ui'

export function EmpresaConfig() {
  const empresaQuery = useEmpresa()
  const atualizar = useUpdateEmpresa()

  return (
    <div className="mx-auto max-w-xl">
      <Card className="space-y-3 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Nome da empresa
        </h2>
        {empresaQuery.isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <InlineEdit
            value={empresaQuery.data?.nome ?? ''}
            onSave={(v) => atualizar.mutateAsync(v).then(() => {})}
            className="text-base font-medium"
          />
        )}
      </Card>
    </div>
  )
}
