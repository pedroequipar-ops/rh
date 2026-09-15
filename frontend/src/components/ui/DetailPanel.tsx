import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'

const CLOSE_DURATION_MS = 200

interface DetailPanelProps {
  onClose: () => void
  /** Recebe `requestClose`: dispara a animação de saída e só então chama `onClose`. */
  children: (requestClose: () => void) => ReactNode
  className?: string
}

/**
 * Shell do painel de detalhe: overlay estreito (com backdrop) no mobile,
 * coluna fixa ao lado do board a partir de `lg`. Quem desenha header/tabs/
 * corpo rolável é o conteúdo (`VagaDetailPanel`/`CandidatoDetailPanel`).
 *
 * Anima entrada ao montar e saída antes de desmontar — como o painel é
 * montado/desmontado pela rota, a saída precisa adiar o `onClose` real até
 * a transição terminar, daí o `requestClose` repassado via render-prop.
 */
export function DetailPanel({ onClose, children, className }: DetailPanelProps) {
  const asideRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Se o componente desmontar antes dos 200ms (ex.: o usuário navegou pra
  // outra tela por outro caminho enquanto o painel fechava), cancela o
  // timeout -- sem isso, o `onClose` disparava "fantasma" com a `location`
  // antiga já fechada sobre esse componente e navegava de volta pra tela
  // velha, atropelando a navegação que o usuário acabou de fazer.
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  const requestClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setVisible(false)
    closeTimeoutRef.current = setTimeout(onClose, CLOSE_DURATION_MS)
  }, [closing, onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (asideRef.current?.contains(target)) return
      // Clique em outro card: ele navega pro próprio id sozinho — fechar
      // aqui agendaria um `onClose` que dispara depois dessa navegação e
      // joga de volta pro board vazio (só troca de vaga/candidato, não fecha).
      if (target.closest('[data-vaga-card], [data-candidato-card]')) return
      requestClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [requestClose])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 lg:hidden',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <aside
        ref={asideRef}
        className={cn(
          'fixed inset-y-0 right-0 z-40 flex w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-xl transition duration-200 ease-out lg:static lg:z-auto lg:w-[460px] lg:shrink-0 lg:shadow-none',
          visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
          className,
        )}
      >
        {children(requestClose)}
      </aside>
    </>
  )
}
