import { useState } from 'react'
import { Copy, Loader2, Mail, Sparkles } from 'lucide-react'
import { useGerarEmailReprovacao } from '../../api/hooks/useCandidatos'
import { useToast } from '../../context/ToastContext'
import type { EmailReprovacaoRascunho } from '../../api/candidatos'

interface EmailReprovacaoPanelProps {
  candidatoId: string
  motivoReprovacao: string
}

/** Rascunho de e-mail de feedback pro candidato descartado (IDEIAS_IA.md #2).
 * Só gera o texto — sem botão de enviar, o RH copia e manda pela própria
 * ferramenta de e-mail (esse sistema não manda e-mail nenhum). */
export function EmailReprovacaoPanel({ candidatoId, motivoReprovacao }: EmailReprovacaoPanelProps) {
  const { showToast } = useToast()
  const gerar = useGerarEmailReprovacao()
  const [rascunho, setRascunho] = useState<EmailReprovacaoRascunho | null>(null)

  async function handleGerar() {
    try {
      const resultado = await gerar.mutateAsync(candidatoId)
      setRascunho(resultado)
    } catch {
      // toast de erro já disparado pelo hook
    }
  }

  function copiar() {
    if (!rascunho) return
    navigator.clipboard.writeText(`Assunto: ${rascunho.assunto}\n\n${rascunho.corpo}`)
    showToast('Rascunho copiado')
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Mail size={13} /> Motivo do descarte
      </p>
      <p className="text-sm text-slate-700">{motivoReprovacao || '—'}</p>

      {!rascunho ? (
        <button
          type="button"
          onClick={handleGerar}
          disabled={gerar.isPending}
          className="flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50"
        >
          {gerar.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Gerar rascunho de e-mail (IA)
        </button>
      ) : (
        <div className="space-y-2">
          {rascunho.interpretacao && (
            <p className="flex items-start gap-1 text-xs text-slate-500">
              <Sparkles size={12} className="mt-0.5 shrink-0 text-sky-500" />
              {rascunho.interpretacao}
            </p>
          )}
          <input
            readOnly
            value={rascunho.assunto}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          />
          <textarea
            readOnly
            value={rascunho.corpo}
            rows={8}
            className="w-full resize-none rounded border border-slate-300 p-2 text-sm text-slate-700"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copiar}
              className="flex items-center gap-1.5 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Copy size={12} /> Copiar
            </button>
            <button
              type="button"
              onClick={handleGerar}
              disabled={gerar.isPending}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50"
            >
              Gerar de novo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
