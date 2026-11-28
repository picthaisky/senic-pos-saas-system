import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import i18n from '@/i18n'
import { renderApp } from '@/test/render-app'
import { inventoryApi } from './api'

// Against the in-memory mock API, which does not read the file: its name decides the answer
// (src/mocks/mock-data.ts). What the server does with a real file is tested in the backend.

const t = i18n.t.bind(i18n)

async function openImport() {
  renderApp('/inventory')
  fireEvent.click(await screen.findByRole('button', { name: t('import.open') }))
  return within(await screen.findByRole('dialog', { name: t('import.title') }))
}

function choose(dialog: ReturnType<typeof within>, name: string) {
  fireEvent.change(dialog.getByLabelText(t('import.file')), {
    target: { files: [new File(['sku,name,price\n'], name)] },
  })
}

describe('importing items from a file', () => {
  it('checks the chosen file first, and saves only when the button is pressed', async () => {
    const upload = vi.spyOn(inventoryApi, 'importFile')
    const dialog = await openImport()
    const save = () => dialog.getByRole('button', { name: /^นำเข้า/ })
    expect(save()).toBeDisabled()

    choose(dialog, 'items.csv')

    expect(await dialog.findByText(t('import.noErrors'))).toBeInTheDocument()
    expect(upload).toHaveBeenLastCalledWith(expect.any(File), true)
    expect(dialog.getByText(t('import.rows')).nextElementSibling).toHaveTextContent('2')
    expect(dialog.getByText(t('import.toCreate')).nextElementSibling).toHaveTextContent('1')
    expect(dialog.getByText(t('import.toUpdate')).nextElementSibling).toHaveTextContent('1')
    // One row would change the stock of an existing item: the page says it will not.
    expect(dialog.getByText(t('import.stockNotChanged', { rows: '1' }))).toBeInTheDocument()

    fireEvent.click(dialog.getByRole('button', { name: t('import.save', { count: 2, rows: '2' }) }))

    expect(
      await screen.findByText(t('import.done', { created: '1', updated: '1' })),
    ).toBeInTheDocument()
    expect(upload).toHaveBeenLastCalledWith(expect.any(File), false)
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: t('import.title') })).not.toBeInTheDocument(),
    )
    upload.mockRestore()
  })

  it('lists the wrong rows in the language of the user and does not offer to save', async () => {
    const dialog = await openImport()

    choose(dialog, 'wrong.xlsx')

    expect(await dialog.findByText(t('import.hasErrors', { errors: '2' }))).toBeInTheDocument()
    const errors = within(dialog.getByRole('table', { name: t('import.errorList') }))
    // The server names the field ("sku"); the page shows its label.
    const missing = within(errors.getByText('ต้องกรอก SKU').closest('tr')!)
    expect(missing.getByText('3')).toBeInTheDocument()
    expect(errors.getByText('SKU A-001 ซ้ำกับแถว 2')).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: t('import.saveNone') })).toBeDisabled()
  })

  it('says why a file cannot be used at all', async () => {
    const dialog = await openImport()

    choose(dialog, 'items.txt')

    expect(await dialog.findByRole('alert')).toHaveTextContent('ไฟล์ต้องเป็น .xlsx หรือ .csv')
    expect(dialog.getByRole('button', { name: t('import.saveNone') })).toBeDisabled()
  })
})
