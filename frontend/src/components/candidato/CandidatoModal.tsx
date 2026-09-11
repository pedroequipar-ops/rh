import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useCandidato } from '../../api/hooks/useCandidatos'
import { DetailPanel } from '../ui/DetailPanel'
import { CandidatoDetailPanel } from './CandidatoDetailPanel'

export function CandidatoModal() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <CandidatoModalInner key={id} id={id} />
}

function CandidatoModalInner({ id }: { id: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: candidato, isError: error } = useCandidato(id)

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
              Não foi possível carregar este candidato.
            </div>
          )}
          {!error && !candidato && (
            <div className="flex h-full items-center justify-center p-4 text-sm text-slate-400">
              Carregando...
            </div>
          )}
          {!error && candidato && (
            <CandidatoDetailPanel candidato={candidato} onClose={requestClose} />
          )}
        </>
      )}
    </DetailPanel>
  )
}
