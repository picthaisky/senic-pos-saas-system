import { create } from 'zustand'

interface NetworkState {
  /**
   * What the browser reports. `false` is reliable (no network at all); `true` only means a
   * network exists, not that the API is reachable, so requests must still handle failures.
   */
  online: boolean
}

export const useNetworkStore = create<NetworkState>(() => ({ online: navigator.onLine }))

window.addEventListener('online', () => useNetworkStore.setState({ online: true }))
window.addEventListener('offline', () => useNetworkStore.setState({ online: false }))
