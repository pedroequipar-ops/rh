import axios from 'axios'
import { apiClient } from './client'
import type { Me } from '../types'

export interface TokenPair {
  access: string
  refresh: string
}

export async function login(username: string, password: string): Promise<TokenPair> {
  const { data } = await axios.post<TokenPair>('/v1/auth/token/', { username, password })
  return data
}

export async function fetchMe(): Promise<Me> {
  const { data } = await apiClient.get<Me>('/auth/me/')
  return data
}
