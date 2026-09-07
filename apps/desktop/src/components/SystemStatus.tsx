import { useEffect, useState } from 'react'
import { getAppInfo, type AppInfo } from '../native/app-info'
import {
  getEngineStatus,
  type EngineStatus,
} from '../native/engine-status'
import './SystemStatus.css'

type NativeBridgeState =
  | { status: 'connecting' }
  | { status: 'connected'; appInfo: AppInfo }
  | { status: 'browser' }
  | { status: 'unavailable' }

type EngineBridgeState =
  | { status: 'connecting' }
  | { status: 'connected'; engineStatus: EngineStatus }
  | { status: 'browser' }
  | { status: 'unavailable' }

export function SystemStatus() {
  const [nativeBridge, setNativeBridge] =
    useState<NativeBridgeState>({
      status: 'connecting',
    })

  const [engineBridge, setEngineBridge] =
    useState<EngineBridgeState>({
      status: 'connecting',
    })

  useEffect(() => {
    let active = true

    void getAppInfo()
      .then((appInfo) => {
        if (!active) {
          return
        }

        setNativeBridge(
          appInfo === null
            ? { status: 'browser' }
            : { status: 'connected', appInfo },
        )
      })
      .catch(() => {
        if (active) {
          setNativeBridge({ status: 'unavailable' })
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    void getEngineStatus()
      .then((engineStatus) => {
        if (!active) {
          return
        }

        setEngineBridge(
          engineStatus === null
            ? { status: 'browser' }
            : { status: 'connected', engineStatus },
        )
      })
      .catch(() => {
        if (active) {
          setEngineBridge({ status: 'unavailable' })
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="status-list">
      <p
        className={`status status--${nativeBridge.status}`}
        role="status"
      >
        <span className="status-indicator" aria-hidden="true" />

        {nativeBridge.status === 'connecting' && (
          <span>Connecting to native bridge</span>
        )}

        {nativeBridge.status === 'connected' && (
          <span>
            Native bridge operational
            <span className="status-details">
              {' '}
              — {nativeBridge.appInfo.platform} ·{' '}
              {nativeBridge.appInfo.architecture} · v
              {nativeBridge.appInfo.version}
            </span>
          </span>
        )}

        {nativeBridge.status === 'browser' && (
          <span>
            Browser preview active
            <span className="status-details">
              {' '}
              — native commands require Tauri
            </span>
          </span>
        )}

        {nativeBridge.status === 'unavailable' && (
          <span>Native bridge unavailable</span>
        )}
      </p>

      <p
        className={`status status--${engineBridge.status}`}
        role="status"
      >
        <span className="status-indicator" aria-hidden="true" />

        {engineBridge.status === 'connecting' && (
          <span>Connecting to Java engine</span>
        )}

        {engineBridge.status === 'connected' && (
          <span>
            Java engine operational
            <span className="status-details">
              {' '}
              — v{engineBridge.engineStatus.engineVersion} · protocol{' '}
              {engineBridge.engineStatus.protocolVersion}
            </span>
          </span>
        )}

        {engineBridge.status === 'browser' && (
          <span>Java engine requires Tauri</span>
        )}

        {engineBridge.status === 'unavailable' && (
          <span>Java engine unavailable</span>
        )}
      </p>
    </div>
  )
}