import { useQuery } from '@tanstack/react-query'
import { getDashboard, type DashboardFiltro } from '../dashboard'

export function useDashboard(filtro: DashboardFiltro) {
  return useQuery({
    queryKey: ['dashboard', filtro],
    queryFn: () => getDashboard(filtro),
  })
}
