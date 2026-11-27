import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { api } from './api'
import { disablePush, enablePush, getPushState, syncPush, urlBase64ToBytes } from './push'

// jsdom has no service worker or push support, so the browser side is faked here. What these
// tests pin down is the conversation with the backend and that nothing is left half-done.

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/device-1'

interface Call {
  method: string
  url: string
  body: unknown
}

let calls: Call[]
let server: { hasKeys: boolean; rejectSubscription: boolean }
let browser: {
  subscription: { endpoint: string; unsubscribe: ReturnType<typeof vi.fn> } | null
  permissionAnswer: NotificationPermission
  subscribe: ReturnType<typeof vi.fn>
}

function fail(config: InternalAxiosRequestConfig, status: number): never {
  const response = { data: undefined, status, statusText: '', headers: {}, config }
  throw new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, config, null, response)
}

function fakeSubscription() {
  return {
    endpoint: ENDPOINT,
    unsubscribe: vi.fn().mockImplementation(async () => {
      browser.subscription = null
      return true
    }),
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'browser-key', auth: 'browser-secret' } }),
  }
}

function installBrowserPush() {
  browser = {
    subscription: null,
    permissionAnswer: 'granted',
    subscribe: vi.fn().mockImplementation(async () => (browser.subscription = fakeSubscription())),
  }
  const registration = {
    pushManager: {
      getSubscription: async () => browser.subscription,
      subscribe: browser.subscribe,
    },
  }
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', {
    permission: 'default' as NotificationPermission,
    requestPermission: async () => browser.permissionAnswer,
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration },
  })
}

beforeEach(() => {
  calls = []
  server = { hasKeys: true, rejectSubscription: false }
  installBrowserPush()
  api.defaults.adapter = async (config) => {
    const method = config.method!.toUpperCase()
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    calls.push({ method, url: config.url!, body })
    if (config.url === '/push/public-key') {
      if (!server.hasKeys) fail(config, 404)
      return { data: { publicKey: 'AQID' }, status: 200, statusText: '', headers: {}, config }
    }
    if (method === 'POST' && server.rejectSubscription) fail(config, 400)
    return { data: undefined, status: 204, statusText: '', headers: {}, config }
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

const posts = () => calls.filter((call) => call.method === 'POST')

describe('urlBase64ToBytes', () => {
  it('decodes URL-safe base64 without padding', () => {
    expect([...urlBase64ToBytes('AQID')]).toEqual([1, 2, 3])
    // "-_" are the URL-safe forms of "+/"; this value needs two padding characters.
    expect([...urlBase64ToBytes('-_8')]).toEqual([251, 255])
  })
})

describe('getPushState', () => {
  it('is unsupported where there is no service worker (e.g. the dev server)', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')

    expect(await getPushState()).toBe('unsupported')
    expect(calls).toHaveLength(0)
  })

  it('reports blocked, unavailable, off and on', async () => {
    expect(await getPushState()).toBe('off')

    browser.subscription = fakeSubscription()
    expect(await getPushState()).toBe('on')

    vi.stubGlobal('Notification', { permission: 'denied' })
    expect(await getPushState()).toBe('blocked')

    // With push turned off on the server there is nothing to offer, even if the browser blocks it.
    server.hasKeys = false
    expect(await getPushState()).toBe('unavailable')
  })
})

describe('enablePush', () => {
  it('subscribes the browser with the server key and registers it with the language', async () => {
    expect(await enablePush('en')).toBe('on')

    const options = browser.subscribe.mock.calls[0][0] as PushSubscriptionOptionsInit
    expect(options.userVisibleOnly).toBe(true)
    expect([...(options.applicationServerKey as Uint8Array)]).toEqual([1, 2, 3])
    expect(posts()).toEqual([
      {
        method: 'POST',
        url: '/push/subscriptions',
        body: {
          endpoint: ENDPOINT,
          keys: { p256dh: 'browser-key', auth: 'browser-secret' },
          language: 'en',
        },
      },
    ])
  })

  it('does not subscribe when the user declines the browser prompt', async () => {
    browser.permissionAnswer = 'denied'

    expect(await enablePush('th')).toBe('blocked')

    expect(browser.subscribe).not.toHaveBeenCalled()
    expect(posts()).toHaveLength(0)
  })

  it('does not ask for permission when the server has push turned off', async () => {
    server.hasKeys = false
    const requestPermission = vi.fn()
    vi.stubGlobal('Notification', { permission: 'default', requestPermission })

    expect(await enablePush('th')).toBe('unavailable')

    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('undoes the browser subscription if the server refuses to register it', async () => {
    server.rejectSubscription = true

    await expect(enablePush('th')).rejects.toThrow()

    expect(browser.subscription).toBeNull()
  })
})

describe('syncPush', () => {
  it('re-registers an existing subscription for the user who is signed in now', async () => {
    browser.subscription = fakeSubscription()

    await syncPush('th')

    expect(posts()).toHaveLength(1)
    expect(posts()[0].body).toMatchObject({ endpoint: ENDPOINT, language: 'th' })
  })

  it('does nothing when the browser is not subscribed', async () => {
    await syncPush('th')

    expect(calls).toHaveLength(0)
  })
})

describe('disablePush', () => {
  it('tells the server and unsubscribes the browser', async () => {
    const subscription = (browser.subscription = fakeSubscription())

    await disablePush()

    expect(calls).toEqual([
      { method: 'DELETE', url: '/push/subscriptions', body: { endpoint: ENDPOINT } },
    ])
    expect(subscription.unsubscribe).toHaveBeenCalled()
  })

  it('still unsubscribes the browser when the server cannot be reached', async () => {
    const subscription = (browser.subscription = fakeSubscription())
    api.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
    }

    await expect(disablePush()).rejects.toThrow()

    expect(subscription.unsubscribe).toHaveBeenCalled()
  })
})
