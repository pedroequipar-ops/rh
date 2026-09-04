import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchMe, login as loginRequest } from '../api/auth'
import { tokenStorage } from '../api/client'
import type { Me } from '../types'

interface AuthContextValue {
  me: Me | null
  loading: boolean
  login: (username: string, password: string) => Promise<Me>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const access = tokenStorage.getAccess()
    if (!access) {
      setLoading(false)
      return
    }
    fetchMe()
      .then(setMe)
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const tokens = await loginRequest(username, password)
    tokenStorage.setTokens(tokens.access, tokens.refresh)
    const meData = await fetchMe()
    tokenStorage.setCompanyId(meData.company_id)
    setMe(meData)
    return meData
  }, [])

  const logout = useCallback(() => {
    tokenStorage.clear()
    setMe(null)
  }, [])

  return <AuthContext.Provider value={{ me, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return ctx
}
