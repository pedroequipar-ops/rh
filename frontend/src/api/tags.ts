import { apiClient } from './client'
import type { Tag } from '../types'

export interface TagResultado extends Tag {
  uso: number
}

export async function buscarTags(q: string): Promise<TagResultado[]> {
  const { data } = await apiClient.get<TagResultado[]>('/tags/', { params: { q } })
  return data
}
