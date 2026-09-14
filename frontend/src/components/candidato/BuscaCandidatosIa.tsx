import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useBuscaCandidatosIa } from '../../api/hooks/useCandidatos'
import type { Candidato } from '../../types'

export interface BuscaCandidatosIaResultado {
  interpretacao: string
  resultados: Candidato[]
}

export function BuscaCandidatosIa({
  onResultado,
}: {
  onResultado: (resultado: BuscaCandidatosIaResultado | null) => void
}) {
  const [frase, setFrase] = useState('')
  const [ativa, setAtiva] = useState<{ interpretacao: string } | null>(null)
  const busca = useBuscaCandidatosIa()

  function buscar() {
    if (!frase.trim()) return
    busca.mutate(frase, {
      onSuccess: (resposta) => {
        setAtiva({ interpretacao: resposta.interpretacao })
        onResultado(resposta)
      },
    })
  }

  function limpar() {
    setFrase('')
    setAtiva(null)
    onResultado(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:w-72">
          <Sparkles
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder='Buscar com IA: "quem sabe excel e já passou da triagem"'
            className="w-full rounded border border-slate-300 py-1.5 pl-8 pr-7 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
          />
          {frase && (
            <button
              onClick={limpar}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={buscar}
          disabled={busca.isPending || !frase.trim()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busca.isPending ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      {ativa && (
        <p className="text-xs text-slate-500">
          <Sparkles size={11} className="mr-1 inline" />
          {ativa.interpretacao || 'Busca aplicada.'}
        </p>
      )}
    </div>
  )
}
