import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const ACCESS_KEY = 'rh_access'
const REFRESH_KEY = 'rh_refresh'
const COMPANY_KEY = 'rh_company_id'

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  getCompanyId: () => localStorage.getItem(COMPANY_KEY),
  setTokens: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  setCompanyId: (companyId: string) => localStorage.setItem(COMPANY_KEY, companyId),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(COMPANY_KEY)
  },
}

export const apiClient = axios.create({
  baseURL: '/v1',
})

apiClient.interceptors.request.use((config) => {
  const access = tokenStorage.getAccess()
  if (access) {
    config.headers.set('Authorization', `Bearer ${access}`)
  }
  const companyId = tokenStorage.getCompanyId()
  if (companyId) {
    config.headers.set('X-Company-ID', companyId)
  }
  return config
})

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStorage.getRefresh()
  if (!refresh) {
    throw new Error('Sem refresh token disponível')
  }
  const { data } = await axios.post('/v1/auth/token/refresh/', { refresh })
  tokenStorage.setAccess(data.access)
  return data.access as string
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    if (error.response?.status !== 401 || !original || original._retry || original.url?.includes('/auth/token/')) {
      return Promise.reject(error)
    }

    original._retry = true

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const access = await refreshPromise
      original.headers.set('Authorization', `Bearer ${access}`)
      return apiClient(original)
    } catch (refreshError) {
      tokenStorage.clear()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    }
  },
)

export function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results
}
