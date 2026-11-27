export const env = {
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  isDev: import.meta.env.DEV,
} as const
