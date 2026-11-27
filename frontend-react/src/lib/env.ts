export const env = {
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  /** Dev only: answer /auth/* from src/mocks until the backend has authentication. */
  useMocks: import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true',
} as const
