import { apiClient } from './client'
import type { CompanyConfig } from '../types'

export async function getCompanyConfig(): Promise<CompanyConfig> {
  const { data } = await apiClient.get<CompanyConfig>('/company/config/')
  return data
}

export async function updateCompanyConfig(input: Partial<CompanyConfig>): Promise<CompanyConfig> {
  const { data } = await apiClient.patch<CompanyConfig>('/company/config/', input)
  return data
}
