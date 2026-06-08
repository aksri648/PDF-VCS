import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface TauriConfig {
  mongoUri?: string;
}

export interface BackendLog {
  stream: 'stdout' | 'stderr';
  line: string;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function apiBase(): string {
  return isTauri() ? 'http://localhost:3001' : '';
}

export function getConfig(): Promise<TauriConfig> {
  return invoke<TauriConfig>('get_config');
}

export function saveConfig(cfg: TauriConfig): Promise<void> {
  return invoke<void>('save_config', { cfg });
}

export function startBackend(uri: string): Promise<void> {
  return invoke<void>('start_backend', { uri });
}

export function stopBackend(): Promise<void> {
  return invoke<void>('stop_backend');
}

export function restartBackend(uri: string): Promise<void> {
  return invoke<void>('restart_backend', { uri });
}

export function subscribeBackendLog(handler: (log: BackendLog) => void): Promise<UnlistenFn> {
  return listen<BackendLog>('backend://log', (event) => handler(event.payload));
}
