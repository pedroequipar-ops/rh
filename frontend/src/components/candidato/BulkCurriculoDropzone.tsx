import { useEffect, useRef, useState, type DragEvent } from 'react'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  RotateCcw,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { useBulkImport, type LinhaImportacao, type LinhaStatus } from './useBulkImport'
import { useToast } from '../../context/ToastContext'

const STATUS_META: Record<LinhaStatus, { label: string; icon: typeof Clock; className: string }> = {
  fila: { label: 'Na fila', icon: Clock, className: 'text-slate-400' },
  enviando: { label: 'Enviando...', icon: Loader2, className: 'text-blue-500 animate-spin' },
  analisando: { label: 'Analisando...', icon: Loader2, className: 'text-blue-500 animate-spin' },
  criando: { label: 'Cadastrando...', icon: Loader2, className: 'text-blue-500 animate-spin' },
  concluido: { label: 'Cadastrado', icon: CheckCircle2, className: 'text-emerald-500' },
  duplicado: { label: 'CPF já cadastrado', icon: Copy, className: 'text-amber-500' },
  erro: { label: 'Falhou', icon: XCircle, className: 'text-red-500' },
  cancelado: { label: 'Cancelado', icon: Ban, className: 'text-slate-400' },
}

function LinhaRow({ linha, onRetry }: { linha: LinhaImportacao; onRetry: (id: string) => void }) {
  const meta = STATUS_META[linha.status]
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
      <Icon size={15} className={clsx('shrink-0', meta.className)} />
      <span className="min-w-0 flex-1 truncate text-slate-700">{linha.file.name}</span>
      <span className="shrink-0 text-xs text-slate-400">{linha.erro ?? meta.label}</span>
      {linha.status === 'erro' && (
        <button
          onClick={() => onRetry(linha.id)}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Tentar de novo"
          title="Tentar de novo"
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  )
}

interface BulkCurriculoDropzoneProps {
  vagaId: string
  etapaId?: string
  cpfsExistentes: Set<string>
  onClose: () => void
  onCandidatoCriado?: () => void
}

/** Dropzone de importação em massa: arraste N PDFs, cada um passa por
 * upload → análise IA → checagem de CPF duplicado → cadastro, com no máx. 3
 * em paralelo. Fecha a qualquer momento — o que já processou fica salvo. */
export function BulkCurriculoDropzone({
  vagaId,
  etapaId,
  cpfsExistentes,
  onClose,
  onCandidatoCriado,
}: BulkCurriculoDropzoneProps) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)
  const resumoAvisadoRef = useRef(false)

  const { linhas, iniciar, cancelar, retry, resumo } = useBulkImport({
    vagaId,
    etapaId,
    cpfsExistentes,
    onCandidatoCriado,
  })

  useEffect(() => {
    if (resumo.total === 0) return
    if (resumo.emAndamento > 0) {
      resumoAvisadoRef.current = false
      return
    }
    if (resumoAvisadoRef.current) return
    resumoAvisadoRef.current = true
    const partes = [`${resumo.concluidos} cadastrado(s)`]
    if (resumo.duplicados > 0) partes.push(`${resumo.duplicados} duplicado(s)`)
    if (resumo.erros > 0) partes.push(`${resumo.erros} com falha`)
    showToast(partes.join(' · '), resumo.erros > 0 ? 'error' : 'success')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumo.emAndamento, resumo.total])

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const { ignoradosNaoPdf, ignoradosMuitoGrandes } = iniciar(Array.from(fileList))
    if (ignoradosNaoPdf > 0) showToast(`${ignoradosNaoPdf} arquivo(s) ignorado(s): só aceita PDF`, 'error')
    if (ignoradosMuitoGrandes > 0)
      showToast(`${ignoradosMuitoGrandes} arquivo(s) ignorado(s): acima de 10MB`, 'error')
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setArrastando(false)
    handleFiles(event.dataTransfer.files)
  }

  const progresso = resumo.total > 0 ? (resumo.total - resumo.emAndamento) / resumo.total : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Importar currículos em massa</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="shrink-0 p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
            className="hidden"
          />
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-fast',
              arrastando ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:bg-slate-50',
            )}
          >
            <UploadCloud size={22} className="text-slate-400" />
            <p className="text-sm text-slate-600">Arraste PDFs aqui ou clique para selecionar</p>
            <p className="text-xs text-slate-400">Até 10MB cada · até 3 em paralelo</p>
          </div>
        </div>

        {resumo.total > 0 && (
          <>
            <div className="shrink-0 px-4 pb-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${progresso * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {resumo.total - resumo.emAndamento} de {resumo.total} processado(s)
                {resumo.duplicados > 0 && ` · ${resumo.duplicados} duplicado(s)`}
                {resumo.erros > 0 && ` · ${resumo.erros} com falha`}
              </p>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t border-slate-100">
              {linhas.map((linha) => (
                <LinhaRow key={linha.id} linha={linha} onRetry={retry} />
              ))}
            </div>
          </>
        )}

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 p-3">
          {resumo.emAndamento > 0 && linhas.some((l) => l.status === 'fila') ? (
            <button
              onClick={cancelar}
              className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <AlertTriangle size={14} /> Cancelar restantes
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900"
          >
            {resumo.emAndamento > 0 ? 'Fechar' : 'Concluir'}
          </button>
        </div>
      </div>
    </div>
  )
}
