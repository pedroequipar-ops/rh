import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useVaga } from '../../api/hooks/useVagas'
import { DetailPanel } from '../ui/DetailPanel'
import { VagaDetailPanel } from './VagaDetailPanel'

export function VagaDetalheModal() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <VagaDetalheModalInner key={id} id={id} />
}

function VagaDetalheModalInner({ id }: { id: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: vaga, isError: error } = useVaga(id)

  function handleClose() {
    const base = location.pathname.replace(/\/(vaga|candidato)\/[^/]+.*$/, '')
    navigate(base)
  }

  return (
    <DetailPanel onClose={handleClose}>
      {(requestClose) => (
        <>
          {error && (
            <div className="flex h-full items-center justify-center p-4 text-sm text-red-500">
              Não foi possível carregar esta vaga.
            </div>
          )}
          {!error && !vaga && (
            <div className="flex h-full items-center justify-center p-4 text-sm text-slate-400">
              Carregando...
            </div>
          )}
          {!error && vaga && <VagaDetailPanel vaga={vaga} onClose={requestClose} />}
        </>
      )}
    </DetailPanel>
  )
}
