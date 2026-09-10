import { useCallback, type WheelEvent } from 'react'

/** Roda do mouse vira scroll horizontal do board, exceto quando a coluna sob o
 * cursor ainda tem o que rolar verticalmente (`data-kanban-scrollable`). */
export function useHorizontalWheel() {
  return useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return

    const target = event.target as HTMLElement
    const columnList = target.closest('[data-kanban-scrollable]') as HTMLElement | null

    if (columnList) {
      const { scrollTop, scrollHeight, clientHeight } = columnList
      const podeDescer = event.deltaY > 0 && scrollTop + clientHeight < scrollHeight - 1
      const podeSubir = event.deltaY < 0 && scrollTop > 0
      if (podeDescer || podeSubir) return
    }

    event.currentTarget.scrollLeft += event.deltaY
    event.preventDefault()
  }, [])
}
