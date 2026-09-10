/** Limitador de concorrência simples: no máx. `concorrencia` promises de
 * `limitar(fn)` rodam ao mesmo tempo; o resto espera em fila (FIFO). */
export function pLimit(concorrencia: number) {
  let ativos = 0
  const fila: (() => void)[] = []

  function proximo() {
    if (ativos >= concorrencia || fila.length === 0) return
    ativos++
    const tarefa = fila.shift()
    tarefa?.()
  }

  return function limitar<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      fila.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            ativos--
            proximo()
          })
      })
      proximo()
    })
  }
}
