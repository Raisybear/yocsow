import { invoke, isTauri } from '@tauri-apps/api/core'

export interface EngineStatus {
  status: string
  initialized: boolean
  protocolVersion: number
  engineVersion: string
}

export async function getEngineStatus(): Promise<EngineStatus | null> {
  if (!isTauri()) {
    return null
  }

  return invoke<EngineStatus>('get_engine_status')
}
