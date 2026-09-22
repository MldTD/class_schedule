// 当前运行平台：web / tauri / capacitor，由 Vite mode 对应的 env 注入
export const PLATFORM = import.meta.env.VITE_PLATFORM || 'web'
export const isTauri = PLATFORM === 'tauri'
export const isCapacitor = PLATFORM === 'capacitor'
export const isEmbedded = isTauri || isCapacitor
