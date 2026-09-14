/** Vaga selecionada no board: vem do path (`/vaga/:id`, painel aberto) ou,
 *  quando o painel foi trocado por outra rota (ex. novo-candidato), do
 *  query param `?vaga=` que essas rotas carregam — mantém o card destacado
 *  mesmo com o painel de detalhe temporariamente fora da URL. */
export function vagaIdFromLocation(pathname: string, search: string): string | null {
  const doPath = pathname.match(/\/vaga\/([^/]+)/)?.[1]
  if (doPath) return doPath
  return new URLSearchParams(search).get('vaga')
}

/** Mesma lógica do `vagaIdFromLocation`, pro card de candidato — usado pra
 *  destacar o card quando se navega até ele (ex.: clicando numa notificação). */
export function candidatoIdFromLocation(pathname: string, search: string): string | null {
  const doPath = pathname.match(/\/candidato\/([^/]+)/)?.[1]
  if (doPath) return doPath
  return new URLSearchParams(search).get('candidato')
}
