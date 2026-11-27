import { fireEvent, screen, within } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { authApi } from '@/features/auth/api'
import i18n from '@/i18n'
import { renderApp, signIn } from '@/test/render-app'

// Against the in-memory mock API (src/mocks/mock-data.ts): the signed-in test user is
// "Somchai" (u1, the only owner); สมหญิง รักงาน is an active cashier; วิชัย ดูยอด is deactivated.

const t = i18n.t.bind(i18n)
const type = (
  label: string,
  value: string,
  container: Pick<typeof screen, 'getByLabelText'> = screen,
) => fireEvent.change(container.getByLabelText(label), { target: { value } })

// Looked up inside the table: the signed-in user's name is also shown elsewhere on the page.
const rowOf = (name: string) =>
  within(within(screen.getByRole('table')).getByText(name).closest('tr')!)

describe('users page', () => {
  it('lists the users of the shop and does not let a manager lock themselves out', async () => {
    renderApp('/users')
    await screen.findByText('สมหญิง รักงาน')

    const own = rowOf('Somchai')
    expect(own.getByText(t('users.you'))).toBeInTheDocument()
    const deactivateSelf = t('users.deactivateNamed', { name: 'Somchai' })
    expect(own.queryByRole('button', { name: deactivateSelf })).not.toBeInTheDocument()
    expect(rowOf('วิชัย ดูยอด').getByText(t('users.inactive'))).toBeInTheDocument()

    fireEvent.click(own.getByRole('button', { name: t('users.editNamed', { name: 'Somchai' }) }))
    const dialog = within(screen.getByRole('dialog', { name: t('users.editUser') }))
    expect(dialog.getByLabelText(t('users.role'))).toBeDisabled()
    expect(dialog.getByLabelText(t('users.email'))).toBeDisabled()
  })

  it('validates a new user, reports a duplicate email, then adds them', async () => {
    renderApp('/users')
    await screen.findByText('สมหญิง รักงาน')

    fireEvent.click(screen.getByRole('button', { name: t('users.addUser') }))
    const dialog = within(screen.getByRole('dialog', { name: t('users.addUser') }))
    type(t('users.name'), 'มานี มีนา', dialog)
    type(t('users.email'), 'somying@shop.test', dialog)
    type(t('users.initialPassword'), 'short', dialog)
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))
    expect(await dialog.findByText(t('validation.passwordMin'))).toBeInTheDocument()

    type(t('users.initialPassword'), 'long-enough-1', dialog)
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))
    expect(await dialog.findByText(t('users.emailTaken'))).toBeInTheDocument()

    type(t('users.email'), 'manee@shop.test', dialog)
    fireEvent.change(dialog.getByLabelText(t('users.role')), { target: { value: 'Viewer' } })
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))

    expect(await screen.findByText(t('users.saved'))).toBeInTheDocument()
    await screen.findByText('มานี มีนา')
    const added = rowOf('มานี มีนา')
    expect(added.getByText('manee@shop.test')).toBeInTheDocument()
    expect(added.getByText(t('roles.Viewer'))).toBeInTheDocument()
  })

  it('deactivates a user after confirmation and lets them back in', async () => {
    renderApp('/users')
    const name = 'สมหญิง รักงาน'
    await screen.findByText(name)

    fireEvent.click(rowOf(name).getByRole('button', { name: t('users.deactivateNamed', { name }) }))
    const dialog = within(screen.getByRole('dialog', { name: t('users.deactivate') }))
    fireEvent.click(dialog.getByRole('button', { name: t('users.deactivate') }))

    expect(await screen.findByText(t('users.deactivated', { name }))).toBeInTheDocument()
    await vi.waitFor(() => expect(rowOf(name).getByText(t('users.inactive'))).toBeInTheDocument())

    fireEvent.click(rowOf(name).getByRole('button', { name: t('users.activateNamed', { name }) }))
    await vi.waitFor(() => expect(rowOf(name).getByText(t('users.active'))).toBeInTheDocument())
  })

  it('sets a new password for a user who forgot theirs', async () => {
    renderApp('/users')
    const name = 'สมหญิง รักงาน'
    await screen.findByText(name)

    fireEvent.click(
      rowOf(name).getByRole('button', { name: t('users.resetPasswordNamed', { name }) }),
    )
    const dialog = within(screen.getByRole('dialog', { name: t('users.resetPassword') }))
    type(t('users.newPassword'), 'short', dialog)
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))
    expect(await dialog.findByText(t('validation.passwordMin'))).toBeInTheDocument()

    type(t('users.newPassword'), 'a-new-password', dialog)
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))
    expect(await screen.findByText(t('users.passwordReset', { name }))).toBeInTheDocument()
  })

  it('is closed to a cashier', async () => {
    renderApp('/users', 'Cashier')
    await screen.findByRole('heading', { name: t('forbidden.title') })
  })
})

describe('changing your own password', () => {
  it('checks the form, reports a wrong current password, then succeeds', async () => {
    // Signing in through the mock is what tells it the current password.
    signIn()
    await authApi.login({ tenantId: 't1', email: 'user@shop.test', password: 'old-password' })
    renderApp('/pos', 'Cashier')

    fireEvent.click(await screen.findByRole('button', { name: t('account.changePassword') }))
    const dialog = within(screen.getByRole('dialog', { name: t('account.changePassword') }))
    type(t('account.currentPassword'), 'not-the-password', dialog)
    type(t('account.newPassword'), 'new-password-1', dialog)
    type(t('account.confirmPassword'), 'new-password-2', dialog)
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))
    expect(await dialog.findByText(t('validation.passwordMismatch'))).toBeInTheDocument()

    type(t('account.confirmPassword'), 'new-password-1', dialog)
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))
    expect(await dialog.findByText(t('account.wrongCurrentPassword'))).toBeInTheDocument()

    type(t('account.currentPassword'), 'old-password', dialog)
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))
    expect(await screen.findByText(t('account.passwordChanged'))).toBeInTheDocument()
  })
})

describe('sign-in protection', () => {
  afterEach(() => vi.restoreAllMocks())

  it('tells a locked-out user to wait instead of saying the password is wrong', async () => {
    renderApp('/auth/login', null)
    const response = { status: 429, data: { title: 'Too many attempts' } } as AxiosResponse
    vi.spyOn(authApi, 'login').mockRejectedValueOnce(
      new AxiosError('Too Many Requests', AxiosError.ERR_BAD_REQUEST, undefined, null, response),
    )

    type(t('auth.tenantId'), 't1')
    type(t('auth.email'), 'user@shop.test')
    type(t('auth.password'), 'whatever-1')
    fireEvent.click(screen.getByRole('button', { name: t('auth.submit') }))

    expect(await screen.findByText(t('auth.tooManyAttempts'))).toBeInTheDocument()
  })
})
