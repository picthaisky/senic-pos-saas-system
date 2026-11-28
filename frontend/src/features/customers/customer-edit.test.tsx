import { fireEvent, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import { renderApp } from '@/test/render-app'
import { customersApi } from './api'

// Against the in-memory mock API. Seed customers: สมชาย ใจดี (somchai@example.com),
// สมหญิง รักเรียน (no email), วิชัย มั่งมี (wichai@example.com).

const t = i18n.t.bind(i18n)

async function openEdit(fullName: string) {
  renderApp('/customers')
  fireEvent.click(
    await screen.findByRole('button', { name: t('customers.editNamed', { name: fullName }) }),
  )
  return within(await screen.findByRole('dialog', { name: t('customers.editCustomer') }))
}

const fill = (dialog: ReturnType<typeof within>, label: string, value: string) =>
  fireEvent.change(dialog.getByLabelText(label), { target: { value } })

describe('editing a customer', () => {
  it('starts from the current details and saves the changes', async () => {
    const dialog = await openEdit('สมหญิง รักเรียน')
    expect(dialog.getByLabelText(t('customers.firstName'))).toHaveValue('สมหญิง')
    expect(dialog.getByLabelText(t('customers.phone'))).toHaveValue('0898765432')

    fill(dialog, t('customers.lastName'), 'รักงาน')
    fill(dialog, t('customers.email'), 'Somying@Example.com')
    fill(dialog, t('customers.address'), '12 ถนนสุขุมวิท')
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }))

    expect(await screen.findByText(t('customers.saved'))).toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: t('customers.editCustomer') }),
    ).not.toBeInTheDocument()
    // The list shows the new name, and the server has the rest.
    expect(await screen.findByText('สมหญิง รักงาน')).toBeInTheDocument()
    const saved = (await customersApi.list()).find((c) => c.firstName === 'สมหญิง')!
    expect(saved).toMatchObject({
      lastName: 'รักงาน',
      email: 'somying@example.com',
      phone: '0898765432',
      address: '12 ถนนสุขุมวิท',
    })
  })

  it('clears a detail that is emptied', async () => {
    const dialog = await openEdit('วิชัย มั่งมี')

    fill(dialog, t('customers.email'), '')
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }))

    expect(await screen.findByText(t('customers.saved'))).toBeInTheDocument()
    const saved = (await customersApi.list()).find((c) => c.firstName === 'วิชัย')!
    expect(saved.email).toBeNull()
  })

  it('refuses an email that another customer already uses, and keeps the form open', async () => {
    const dialog = await openEdit('วิชัย มั่งมี')

    fill(dialog, t('customers.email'), 'somchai@example.com')
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }))

    expect(await dialog.findByText(t('customers.emailTaken'))).toBeInTheDocument()
    const untouched = (await customersApi.list()).find((c) => c.firstName === 'วิชัย')!
    expect(untouched.email).not.toBe('somchai@example.com')
  })

  it('does not send a form with a missing name or a malformed phone number', async () => {
    const dialog = await openEdit('สมชาย ใจดี')
    const update = vi.spyOn(customersApi, 'update')

    fill(dialog, t('customers.firstName'), ' ')
    fill(dialog, t('customers.phone'), '12345')
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }))

    expect(await dialog.findByText(t('validation.required'))).toBeInTheDocument()
    expect(dialog.getByText(t('validation.phone'))).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })
})
