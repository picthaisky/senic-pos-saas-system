#!/usr/bin/env node
// Portainer automation for the Senic POS stack. No dependencies; needs Node 20+.
//
//   node deploy/portainer.mjs create        Create the Git-based stack (once).
//   node deploy/portainer.mjs deploy        Redeploy it: through the API if PORTAINER_API_KEY is
//                                           set, otherwise through PORTAINER_WEBHOOK_URL.
//   node deploy/portainer.mjs wait-healthy  Wait until HEALTH_URL reports the expected version.
//
// Everything is configured through environment variables; see deploy/README.md.
// Secret values are never printed.

import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

/** Variables of deploy/docker-compose.yml. They are copied from the environment into the stack. */
export const STACK_VARIABLES = [
  'IMAGE_REGISTRY',
  'IMAGE_TAG',
  'WEB_PORT',
  'POSTGRES_PASSWORD',
  'JWT_KEY',
  'BUSINESS_TIMEZONE',
  'BOOTSTRAP_TENANT_ID',
  'BOOTSTRAP_OWNER_EMAIL',
  'BOOTSTRAP_OWNER_PASSWORD',
  'PUSH_PUBLIC_KEY',
  'PUSH_PRIVATE_KEY',
  'PUSH_SUBJECT',
]

/** Without these the stack cannot start, so `create` refuses to run. */
const REQUIRED_ON_CREATE = ['POSTGRES_PASSWORD', 'JWT_KEY']

export class DeployError extends Error {}

function required(env, name) {
  const value = env[name]?.trim()
  if (!value) throw new DeployError(`${name} is not set.`)
  return value
}

/** The stack variables that are set (non-empty) in the environment, as Portainer's [{name, value}]. */
export function stackEnvFrom(env) {
  return STACK_VARIABLES.filter((name) => env[name]?.trim()).map((name) => ({
    name,
    value: env[name].trim(),
  }))
}

/**
 * Puts `overrides` on top of the stack's current variables. Portainer replaces the whole list
 * on redeploy, so everything not overridden must be sent back unchanged or it would be lost.
 */
export function mergeEnv(current, overrides) {
  const merged = new Map((current ?? []).map((pair) => [pair.name, pair.value]))
  for (const pair of overrides) merged.set(pair.name, pair.value)
  return [...merged].map(([name, value]) => ({ name, value }))
}

function client(env, fetchImpl) {
  const baseUrl = required(env, 'PORTAINER_URL').replace(/\/+$/, '')
  const apiKey = required(env, 'PORTAINER_API_KEY')

  return async function request(method, path, body) {
    let response
    try {
      response = await fetchImpl(`${baseUrl}/api${path}`, {
        method,
        headers: { 'X-API-Key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (error) {
      throw new DeployError(`Cannot reach Portainer at ${baseUrl}: ${error.cause?.message ?? error.message}`)
    }
    const text = await response.text()
    let data
    try {
      data = text ? JSON.parse(text) : undefined
    } catch {
      data = undefined
    }
    if (!response.ok) {
      // Portainer explains errors in `message` / `details`.
      const reason = data?.details || data?.message || text.slice(0, 300) || response.statusText
      const hint =
        response.status === 409
          ? ' (a deployment of this stack is already running, or the name is taken)'
          : response.status === 401 || response.status === 403
            ? ' (check PORTAINER_API_KEY and that its user may manage this environment)'
            : ''
      throw new DeployError(`Portainer ${method} ${path} failed with ${response.status}: ${reason}${hint}`)
    }
    return data
  }
}

async function findStack(request, env) {
  if (env.PORTAINER_STACK_ID?.trim()) {
    return request('GET', `/stacks/${env.PORTAINER_STACK_ID.trim()}`)
  }
  const name = env.PORTAINER_STACK_NAME?.trim() || 'senicpos'
  const stacks = (await request('GET', '/stacks')) ?? []
  const matches = stacks.filter((stack) => stack.Name === name)
  if (matches.length > 1) {
    throw new DeployError(`More than one stack is named "${name}". Set PORTAINER_STACK_ID to choose one.`)
  }
  return matches[0] ?? null
}

/** Creates the stack from the Git repository. Fails rather than touch an existing stack. */
export async function createStack(env, { fetchImpl = fetch, log = console.log } = {}) {
  const request = client(env, fetchImpl)
  const endpointId = required(env, 'PORTAINER_ENDPOINT_ID')
  const name = env.PORTAINER_STACK_NAME?.trim() || 'senicpos'
  const repositoryURL = required(env, 'REPO_URL')
  for (const variable of REQUIRED_ON_CREATE) required(env, variable)

  if (await findStack(request, { ...env, PORTAINER_STACK_ID: '' })) {
    throw new DeployError(`A stack named "${name}" already exists. Use "deploy" to update it.`)
  }

  const gitToken = env.GIT_TOKEN?.trim()
  const webhookId = env.PORTAINER_ENABLE_WEBHOOK === 'true' ? randomUUID() : null

  const stack = await request('POST', `/stacks/create/standalone/repository?endpointId=${encodeURIComponent(endpointId)}`, {
    name,
    repositoryURL,
    repositoryReferenceName: env.REPO_REF?.trim() || 'refs/heads/main',
    composeFile: env.COMPOSE_PATH?.trim() || 'deploy/docker-compose.yml',
    // Only needed for a private repository.
    repositoryAuthentication: !!gitToken,
    ...(gitToken ? { repositoryUsername: env.GIT_USERNAME?.trim() || 'git', repositoryPassword: gitToken } : {}),
    env: stackEnvFrom(env),
    // A webhook lets the stack be redeployed without an API key (see `deploy`).
    ...(webhookId ? { autoUpdate: { webhook: webhookId, forcePullImage: true } } : {}),
  })

  log(`Created stack "${name}" (id ${stack?.Id ?? 'unknown'}) from ${repositoryURL}.`)
  if (webhookId) {
    log(`Webhook URL (keep it secret, anyone who has it can redeploy):`)
    log(`${required(env, 'PORTAINER_URL').replace(/\/+$/, '')}/api/stacks/webhooks/${webhookId}`)
  }
  return stack
}

/**
 * Pulls the latest commit and images and redeploys. Variables set in the environment
 * (typically IMAGE_TAG) replace the stack's values; all others are kept.
 */
export async function redeployViaApi(env, { fetchImpl = fetch, log = console.log } = {}) {
  const request = client(env, fetchImpl)
  const stack = await findStack(request, env)
  if (!stack) {
    throw new DeployError(`Stack "${env.PORTAINER_STACK_NAME?.trim() || 'senicpos'}" does not exist. Run "create" first.`)
  }
  if (!stack.GitConfig) {
    throw new DeployError(`Stack "${stack.Name}" was not created from a Git repository, so it cannot be redeployed from Git.`)
  }

  const overrides = stackEnvFrom(env)
  const gitToken = env.GIT_TOKEN?.trim()
  await request('PUT', `/stacks/${stack.Id}/git/redeploy?endpointId=${stack.EndpointId}`, {
    env: mergeEnv(stack.Env, overrides),
    prune: true,
    // Current name, plus the name used before Portainer 2.36.
    repullImageAndRedeploy: true,
    pullImage: true,
    repositoryReferenceName: env.REPO_REF?.trim() || stack.GitConfig.ReferenceName,
    // Keep the repository credentials the stack already has, unless new ones are supplied.
    repositoryAuthentication: !!gitToken || !!stack.GitConfig.Authentication,
    ...(gitToken ? { repositoryUsername: env.GIT_USERNAME?.trim() || 'git', repositoryPassword: gitToken } : {}),
  })

  const changed = overrides.map((pair) => pair.name).join(', ') || 'none'
  log(`Redeployed stack "${stack.Name}" (id ${stack.Id}). Variables updated: ${changed}.`)
}

/** Triggers the stack's GitOps webhook. Portainer answers before the deployment has finished. */
export async function redeployViaWebhook(env, { fetchImpl = fetch, log = console.log } = {}) {
  const url = required(env, 'PORTAINER_WEBHOOK_URL')
  let response
  try {
    response = await fetchImpl(url, { method: 'POST' })
  } catch (error) {
    throw new DeployError(`Cannot reach the Portainer webhook: ${error.cause?.message ?? error.message}`)
  }
  if (!response.ok) {
    const hint = response.status === 409 ? ' (a deployment is already running, or GitOps updates are not available for this stack)' : ''
    // The URL is a credential, so it is not echoed.
    throw new DeployError(`The Portainer webhook answered ${response.status}${hint}.`)
  }
  log('Portainer accepted the webhook; the stack is being redeployed.')
}

export async function deploy(env, options = {}) {
  if (env.PORTAINER_API_KEY?.trim()) return redeployViaApi(env, options)
  if (env.PORTAINER_WEBHOOK_URL?.trim()) return redeployViaWebhook(env, options)
  throw new DeployError(
    'Nothing to deploy with: set PORTAINER_URL and PORTAINER_API_KEY (pins the image version), or PORTAINER_WEBHOOK_URL.',
  )
}

/** Polls GET HEALTH_URL until it answers 200 and, if EXPECTED_VERSION is set, reports that version. */
export async function waitHealthy(env, { fetchImpl = fetch, log = console.log, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const url = required(env, 'HEALTH_URL')
  const expected = env.EXPECTED_VERSION?.trim()
  const timeoutMs = Number(env.HEALTH_TIMEOUT_SECONDS || 300) * 1000
  const deadline = Date.now() + timeoutMs
  let last = 'no answer yet'

  while (true) {
    try {
      const response = await fetchImpl(url)
      if (response.ok) {
        const body = await response.json().catch(() => ({}))
        if (!expected || body.version === expected) {
          log(`Healthy${expected ? `, running version ${expected}` : ''}.`)
          return
        }
        last = `still running version ${body.version}`
      } else {
        last = `HTTP ${response.status}`
      }
    } catch (error) {
      last = error.cause?.message ?? error.message
    }
    if (Date.now() >= deadline) {
      throw new DeployError(`${url} did not become healthy${expected ? ` on version ${expected}` : ''} within ${timeoutMs / 1000}s (${last}).`)
    }
    await sleep(5000)
  }
}

const commands = { create: createStack, deploy, 'wait-healthy': waitHealthy }

// Run only when executed directly, not when imported by the tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = commands[process.argv[2]]
  if (!command) {
    console.error(`Usage: node deploy/portainer.mjs <${Object.keys(commands).join('|')}>`)
    process.exit(2)
  }
  command(process.env).catch((error) => {
    console.error(error instanceof DeployError ? `Error: ${error.message}` : error)
    process.exit(1)
  })
}
