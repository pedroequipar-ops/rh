import { useState } from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'

interface TagSuggestionsProps {
  /** Nomes das tags já aplicadas — usado só pra filtrar sugestões repetidas. */
  nomesAtuais: string[]
  /** Dispara a chamada de IA e devolve as sugestões. */
  onSugerir: () => Promise<{ tags: string[]; interpretacao: string }>
  /** Adiciona os nomes escolhidos — mesma assinatura do `onChange` do `TagInput`. */
  onAplicar: (nomes: string[]) => void
}

/** Botão "Sugerir tags (IA)" — nada é aplicado sem o RH clicar num chip
 * sugerido (ou em "Adicionar todas"). Usado ao lado do `TagInput` em
 * candidato e vaga (IDEIAS_IA.md #14). */
export function TagSuggestions({ nomesAtuais, onSugerir, onAplicar }: TagSuggestionsProps) {
  const [carregando, setCarregando] = useState(false)
  const [sugestoes, setSugestoes] = useState<string[] | null>(null)
  const [interpretacao, setInterpretacao] = useState('')

  async function sugerir() {
    setCarregando(true)
    try {
      const resultado = await onSugerir()
      setSugestoes(resultado.tags.filter((nome) => !nomesAtuais.includes(nome)))
      setInterpretacao(resultado.interpretacao)
    } catch {
      setSugestoes(null)
    } finally {
      setCarregando(false)
    }
  }

  function adicionar(nome: string) {
    onAplicar([...nomesAtuais, nome])
    setSugestoes((prev) => prev?.filter((s) => s !== nome) ?? null)
  }

  function adicionarTodas() {
    if (!sugestoes || sugestoes.length === 0) return
    onAplicar([...nomesAtuais, ...sugestoes])
    setSugestoes([])
  }

  if (sugestoes === null) {
    return (
      <button
        type="button"
        onClick={sugerir}
        disabled={carregando}
        className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50"
      >
        {carregando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        Sugerir tags (IA)
      </button>
    )
  }

  if (sugestoes.length === 0) {
    return <p className="text-xs text-slate-400">Nenhuma sugestão de tag nova.</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {interpretacao && (
        <p className="flex items-start gap-1 text-xs text-slate-500">
          <Sparkles size={12} className="mt-0.5 shrink-0 text-sky-500" />
          {interpretacao}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {sugestoes.map((nome) => (
          <button
            key={nome}
            type="button"
            onClick={() => adicionar(nome)}
            className="flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 hover:border-sky-300 hover:bg-sky-100"
          >
            <Plus size={10} />
            {nome}
          </button>
        ))}
        {sugestoes.length > 1 && (
          <button
            type="button"
            onClick={adicionarTodas}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
          >
            Adicionar todas
          </button>
        )}
      </div>
    </div>
  )
}
