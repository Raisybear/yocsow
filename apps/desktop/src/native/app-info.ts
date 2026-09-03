import { invoke, isTauri } from '@tauri-apps/api/core'

export interface AppInfo {
  name: string
  version: string
  platform: string
  architecture: string
}

export async function getAppInfo(): Promise<AppInfo | null> {
  if (!isTauri()) {
    return null
  }

  return invoke<AppInfo>('get_app_info')
}
