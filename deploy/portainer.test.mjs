// Tests for portainer.mjs against a fake Portainer. Run with: node --test deploy/
// The request shapes asserted here follow Portainer's source (api/http/handler/stacks); they
// document what this script sends, not a guarantee of how a given Portainer version behaves.

import assert from 'node:assert/strict'
import http from 'node:http'
import { after, before, beforeEach, describe, it } from 'node:test'
import { createStack, deploy, DeployError, mergeEnv, stackEnvFrom, waitHealthy } from './portainer.mjs'

/** Requests received by the fake server, and the stacks it "has". */
let requests
let stacks
let answer
let server
let baseUrl

const quiet = { log: () => {} }

before(async () => {
  server = http.createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const url = new URL(req.url, 'http://fake')
    requests.push({
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      apiKey: req.headers['x-api-key'],
      body: body ? JSON.parse(body) : undefined,
    })
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(data === undefined ? '' : JSON.stringify(data))
    }

    const forced = answer?.(req.method, url.pathname)
    if (forced) return reply(forced.status, forced.body)
    if (req.method === 'GET' && url.pathname === '/api/stacks') return reply(200, stacks)
    const one = url.pathname.match(/^\/api\/stacks\/(\d+)$/)
    if (req.method === 'GET' && one) return reply(200, stacks.find((s) => s.Id === Number(one[1])))
    if (req.method === 'POST' && url.pathname === '/api/stacks/create/standalone/repository') return reply(200, { Id: 7 })
    if (req.method === 'PUT' && /^\/api\/stacks\/\d+\/git\/redeploy$/.test(url.pathname)) return reply(200, {})
    if (req.method === 'POST' && url.pathname.startsWith('/api/stacks/webhooks/')) return reply(204)
    if (url.pathname === '/health') return reply(200, { status: 'healthy', version: 'sha-new' })
    reply(404, { message: 'not found' })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

beforeEach(() => {
  requests = []
  answer = null
  stacks = [
    {
      Id: 3,
      Name: 'senicpos',
      EndpointId: 2,
      Env: [
        { name: 'POSTGRES_PASSWORD', value: 'db-secret' },
        { name: 'JWT_KEY', value: 'jwt-secret' },
        { name: 'IMAGE_TAG', value: 'sha-old' },
      ],
      GitConfig: { ReferenceName: 'refs/heads/main', Authentication: null },
    },
  ]
})

const apiEnv = (extra = {}) => ({ PORTAINER_URL: `${baseUrl}/`, PORTAINER_API_KEY: 'key-123', ...extra })

describe('stack variables', () => {
  it('takes only the known, non-empty variables from the environment', () => {
    const env = { IMAGE_TAG: 'sha-1', JWT_KEY: '  ', PATH: '/usr/bin', POSTGRES_PASSWORD: 'p' }

    assert.deepEqual(stackEnvFrom(env), [
      { name: 'IMAGE_TAG', value: 'sha-1' },
      { name: 'POSTGRES_PASSWORD', value: 'p' },
    ])
  })

  it('merges overrides over the current values and keeps everything else', () => {
    const merged = mergeEnv(
      [
        { name: 'JWT_KEY', value: 'keep' },
        { name: 'IMAGE_TAG', value: 'old' },
      ],
      [
        { name: 'IMAGE_TAG', value: 'new' },
        { name: 'WEB_PORT', value: '80' },
      ],
    )

    assert.deepEqual(merged, [
      { name: 'JWT_KEY', value: 'keep' },
      { name: 'IMAGE_TAG', value: 'new' },
      { name: 'WEB_PORT', value: '80' },
    ])
  })
})

describe('create', () => {
  const createEnv = (extra = {}) =>
    apiEnv({
      PORTAINER_ENDPOINT_ID: '2',
      PORTAINER_STACK_NAME: 'senicpos-new',
      REPO_URL: 'https://github.com/example/repo',
      POSTGRES_PASSWORD: 'db-secret',
      JWT_KEY: 'jwt-secret',
      IMAGE_TAG: 'sha-1',
      ...extra,
    })

  it('creates a Git-based stack with the compose path and variables', async () => {
    await createStack(createEnv(), quiet)

    const create = requests.find((r) => r.method === 'POST')
    assert.equal(create.path, '/api/stacks/create/standalone/repository')
    assert.deepEqual(create.query, { endpointId: '2' })
    assert.equal(create.apiKey, 'key-123')
    assert.deepEqual(create.body, {
      name: 'senicpos-new',
      repositoryURL: 'https://github.com/example/repo',
      repositoryReferenceName: 'refs/heads/main',
      composeFile: 'deploy/docker-compose.yml',
      repositoryAuthentication: false,
      env: [
        { name: 'IMAGE_TAG', value: 'sha-1' },
        { name: 'POSTGRES_PASSWORD', value: 'db-secret' },
        { name: 'JWT_KEY', value: 'jwt-secret' },
      ],
    })
  })

  it('sends repository credentials and a webhook only when asked to', async () => {
    const lines = []
    await createStack(createEnv({ GIT_TOKEN: 'pat', GIT_USERNAME: 'bot', PORTAINER_ENABLE_WEBHOOK: 'true' }), {
      log: (line) => lines.push(line),
    })

    const { body } = requests.find((r) => r.method === 'POST')
    assert.equal(body.repositoryAuthentication, true)
    assert.equal(body.repositoryUsername, 'bot')
    assert.equal(body.repositoryPassword, 'pat')
    assert.match(body.autoUpdate.webhook, /^[0-9a-f-]{36}$/)
    assert.equal(body.autoUpdate.forcePullImage, true)
    assert.ok(lines.some((line) => line.endsWith(`/api/stacks/webhooks/${body.autoUpdate.webhook}`)))
  })

  it('refuses to touch a stack that already exists', async () => {
    await assert.rejects(createStack(createEnv({ PORTAINER_STACK_NAME: 'senicpos' }), quiet), /already exists/)
    assert.equal(requests.filter((r) => r.method !== 'GET').length, 0)
  })

  it('refuses to create a stack that could not start', async () => {
    await assert.rejects(createStack(createEnv({ JWT_KEY: '' }), quiet), /JWT_KEY is not set/)
    assert.equal(requests.length, 0)
  })
})

describe('deploy through the API', () => {
  it('pins the new image tag and keeps the secrets already stored in the stack', async () => {
    await deploy(apiEnv({ IMAGE_TAG: 'sha-new' }), quiet)

    const redeploy = requests.find((r) => r.method === 'PUT')
    assert.equal(redeploy.path, '/api/stacks/3/git/redeploy')
    assert.deepEqual(redeploy.query, { endpointId: '2' })
    assert.deepEqual(redeploy.body, {
      env: [
        { name: 'POSTGRES_PASSWORD', value: 'db-secret' },
        { name: 'JWT_KEY', value: 'jwt-secret' },
        { name: 'IMAGE_TAG', value: 'sha-new' },
      ],
      prune: true,
      repullImageAndRedeploy: true,
      pullImage: true,
      repositoryReferenceName: 'refs/heads/main',
      repositoryAuthentication: false,
    })
  })

  it('keeps repository authentication on for a stack that uses it', async () => {
    stacks[0].GitConfig.Authentication = { Username: 'bot' }

    await deploy(apiEnv(), quiet)

    assert.equal(requests.find((r) => r.method === 'PUT').body.repositoryAuthentication, true)
  })

  it('can address the stack by id', async () => {
    await deploy(apiEnv({ PORTAINER_STACK_ID: '3' }), quiet)

    assert.deepEqual(
      requests.map((r) => `${r.method} ${r.path}`),
      ['GET /api/stacks/3', 'PUT /api/stacks/3/git/redeploy'],
    )
  })

  it('fails clearly when the stack does not exist', async () => {
    await assert.rejects(deploy(apiEnv({ PORTAINER_STACK_NAME: 'missing' }), quiet), /does not exist\. Run "create" first/)
  })

  it('explains a 409 and never prints the API key', async () => {
    answer = (method) => (method === 'PUT' ? { status: 409, body: { message: 'Stack deployment is already in progress' } } : null)

    await assert.rejects(deploy(apiEnv(), quiet), (error) => {
      assert.ok(error instanceof DeployError)
      assert.match(error.message, /409: Stack deployment is already in progress/)
      assert.doesNotMatch(error.message, /key-123/)
      return true
    })
  })

  it('reports an unreachable Portainer without a stack trace', async () => {
    await assert.rejects(
      deploy({ PORTAINER_URL: 'http://127.0.0.1:1', PORTAINER_API_KEY: 'key-123' }, quiet),
      /Cannot reach Portainer at http:\/\/127\.0\.0\.1:1/,
    )
  })
})

describe('deploy through the webhook', () => {
  it('posts to the webhook when there is no API key', async () => {
    await deploy({ PORTAINER_WEBHOOK_URL: `${baseUrl}/api/stacks/webhooks/abc` }, quiet)

    assert.deepEqual(
      requests.map((r) => `${r.method} ${r.path}`),
      ['POST /api/stacks/webhooks/abc'],
    )
  })

  it('does not echo the webhook URL when it fails', async () => {
    answer = () => ({ status: 409 })
    const url = `${baseUrl}/api/stacks/webhooks/secret-id`

    await assert.rejects(deploy({ PORTAINER_WEBHOOK_URL: url }, quiet), (error) => {
      assert.match(error.message, /answered 409/)
      assert.doesNotMatch(error.message, /secret-id/)
      return true
    })
  })

  it('says what to configure when neither mechanism is set up', async () => {
    await assert.rejects(deploy({}, quiet), /PORTAINER_API_KEY .* or PORTAINER_WEBHOOK_URL/)
  })
})

describe('wait-healthy', () => {
  const fast = { ...quiet, sleep: async () => {} }

  it('returns once the expected version is live', async () => {
    await waitHealthy({ HEALTH_URL: `${baseUrl}/health`, EXPECTED_VERSION: 'sha-new' }, fast)
  })

  it('times out while the old version is still running', async () => {
    await assert.rejects(
      waitHealthy({ HEALTH_URL: `${baseUrl}/health`, EXPECTED_VERSION: 'sha-newer', HEALTH_TIMEOUT_SECONDS: '0' }, fast),
      /did not become healthy on version sha-newer within 0s \(still running version sha-new\)/,
    )
  })
})
