import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { getCandidato } from '../../api/candidatos'
import type { Candidato } from '../../types'
import { CandidatoInfoPanel } from './CandidatoInfoPanel'
import { ChatPanel } from './ChatPanel'

export function CandidatoModal() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [candidato, setCandidato] = useState<Candidato | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    setCandidato(null)
    setError(false)

    getCandidato(id)
      .then((c) => {
        if (active) setCandidato(c)
      })
      .catch(() => {
        if (active) setError(true)
      })

    return () => {
      active = false
    }
  }, [id])

  function handleClose() {
    const base = location.pathname.replace(/\/candidato\/.*$/, '')
    navigate(base)
  }

  if (!id) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
      <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="absolute -right-3 -top-3 z-10 rounded-full bg-white p-1.5 text-slate-500 shadow-md hover:text-slate-800"
        >
          <X size={18} />
        </button>

        <div className="flex h-[85vh] w-full flex-col overflow-hidden rounded-lg bg-white shadow-2xl md:h-[80vh] md:flex-row">
          {error && (
            <div className="flex flex-1 items-center justify-center text-sm text-red-500">
              Não foi possível carregar este candidato.
            </div>
          )}

          {!error && !candidato && (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Carregando...
            </div>
          )}

          {!error && candidato && (
            <>
              <div className="h-1/2 w-full overflow-hidden border-b border-slate-200 md:h-full md:w-3/5 md:border-b-0 md:border-r">
                <CandidatoInfoPanel candidato={candidato} />
              </div>
              <div className="h-1/2 w-full md:h-full md:w-2/5">
                <ChatPanel candidatoId={candidato.id} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
