export const env = {
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  /** Dev only: answer the API from src/mocks instead of a running backend. */
  useMocks: import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true',
  /** False under the test runner, where there is no hub to connect to. */
  isTest: import.meta.env.MODE === 'test',
} as const
