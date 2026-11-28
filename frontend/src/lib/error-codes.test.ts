import { AxiosError, type AxiosResponse } from 'axios'
import i18n from '@/i18n'
import en from '@/i18n/locales/en.json'
import th from '@/i18n/locales/th.json'
import source from '../../../backend/SenicPosSaaS.Application/Common/ErrorCodes.cs?raw'
import { errorMessage, type ProblemDetails } from './api'

// The server names its errors (backend ErrorCodes.cs) and the app says them in the user's
// language. The list of codes is read from the server's source, so a code added there without
// a sentence here fails this test.

const codes = [...source.matchAll(/public const string \w+ = "([a-z_]+)";/g)].map((m) => m[1])
/** The values each code's sentence may use, from the "params:" notes in the source. */
const params = new Map(
  [
    ...source.matchAll(
      /(?:<summary>params: ([a-z, ]+)<\/summary>\s*)?public const string \w+ = "([a-z_]+)";/g,
    ),
  ].map((m) => [m[2], m[1] ? m[1].split(', ') : []] as const),
)

function refusal(problem: ProblemDetails): AxiosError {
  const response = { status: problem.status ?? 409, data: problem } as AxiosResponse
  return new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, response)
}

afterEach(() => i18n.changeLanguage('th'))

describe('error codes', () => {
  it('finds the codes in the server source', () => {
    expect(codes.length).toBeGreaterThan(20)
    expect(codes).toContain('insufficient_stock')
  })

  it.each([
    ['th', th.errors],
    ['en', en.errors],
  ] as const)(
    'has a sentence in %s for every code, and none for a code that is gone',
    (_, sentences) => {
      expect(Object.keys(sentences).sort()).toEqual([...codes].sort())
    },
  )

  it.each([
    ['th', th.errors],
    ['en', en.errors],
  ] as const)('uses in %s only the values the server sends with the code', (_, sentences) => {
    for (const [code, sentence] of Object.entries(sentences)) {
      const used = [...sentence.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
      expect(params.get(code), code).toEqual(expect.arrayContaining(used))
    }
  })
})

describe('errorMessage', () => {
  const outOfStock = refusal({
    status: 409,
    code: 'insufficient_stock',
    detail: 'Insufficient stock for น้ำดื่ม (3 left)',
    params: { name: 'น้ำดื่ม', available: 3 },
  })

  it('says a known code in the language of the user, with its values', async () => {
    expect(errorMessage(outOfStock, 'ไม่สำเร็จ')).toBe('น้ำดื่ม มีไม่พอ (เหลือ 3)')
    await i18n.changeLanguage('en')
    expect(errorMessage(outOfStock, 'Failed')).toBe('Not enough น้ำดื่ม (3 left)')
  })

  it('does not show English from the server to someone reading Thai', async () => {
    const unknown = refusal({ status: 409, code: 'from_a_newer_server', detail: 'Something new.' })
    const uncoded = refusal({ status: 400, title: 'Bad Request', detail: 'The field is required.' })

    expect(errorMessage(unknown, 'ไม่สำเร็จ')).toBe('ไม่สำเร็จ')
    expect(errorMessage(uncoded, 'ไม่สำเร็จ')).toBe('ไม่สำเร็จ')

    await i18n.changeLanguage('en')
    expect(errorMessage(unknown, 'Failed')).toBe('Something new.')
    expect(errorMessage(uncoded, 'Failed')).toBe('The field is required.')
  })

  it('falls back when the server said nothing', () => {
    expect(errorMessage(new Error('network'), 'ไม่สำเร็จ')).toBe('ไม่สำเร็จ')
  })
})
