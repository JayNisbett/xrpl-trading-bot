export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, init)
}
