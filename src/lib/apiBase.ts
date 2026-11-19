const rawBase = import.meta.env.VITE_API_BASE_URL;

export const API_BASE =
  typeof rawBase === 'string' ? rawBase.trim().replace(/\/+$/, '') : '';

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
}
