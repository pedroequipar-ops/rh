import { useQueryClient } from '@tanstack/react-query'
import { useEtapas } from '../../api/hooks/useEtapas'
import { queryKeys } from '../../api/queryKeys'
import { EtapaListEditor } from '../../components/kanban/EtapaColumnEditor'
import { Card } from '../../components/ui/Card'

export function EtapasConfig() {
  const etapasQuery = useEtapas()
  const qc = useQueryClient()

  function handleChange() {
    qc.invalidateQueries({ queryKey: queryKeys.etapas })
    qc.invalidateQueries({ queryKey: queryKeys.vagas })
    qc.invalidateQueries({ queryKey: queryKeys.candidatos })
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-4 text-sm text-slate-500">
        Etapas do board Pessoas. Arraste para reordenar; a ordem vale para todas as vagas.
      </p>
      <Card className="p-4">
        {etapasQuery.isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <EtapaListEditor etapas={etapasQuery.data ?? []} onChange={handleChange} />
        )}
      </Card>
    </div>
  )
}
