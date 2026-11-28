import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import i18n from '@/i18n'
import { renderApp, signIn } from '@/test/render-app'
import { inventoryApi } from './api'

// Against the in-memory mock API. The browser used by the tests cannot decode pictures, so
// the file goes to the server as it is; shrinking is checked in the real browser tests.

const t = i18n.t.bind(i18n)

beforeAll(() => {
  Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} })
})

async function openEditor() {
  signIn()
  const [item] = (await inventoryApi.page({}, { page: 1, pageSize: 1, sort: 'name' })).items
  renderApp('/inventory')
  fireEvent.click(
    await screen.findByRole('button', { name: t('inventory.editNamed', { name: item.name }) }),
  )
  const dialog = within(await screen.findByRole('dialog', { name: t('inventory.editItem') }))
  return { item, dialog }
}

const current = async (id: string) =>
  (await inventoryApi.list()).find((candidate) => candidate.id === id)!

describe('the picture of an item', () => {
  it('is sent after the item is saved, and shown in the list', async () => {
    const setImage = vi.spyOn(inventoryApi, 'setImage')
    const { item, dialog } = await openEditor()
    expect(dialog.queryByRole('img')).not.toBeInTheDocument()

    const picture = new File(['picture'], 'photo.png', { type: 'image/png' })
    fireEvent.change(dialog.getByLabelText(t('inventory.image')), { target: { files: [picture] } })
    // A preview of the chosen file, before anything is sent.
    expect(dialog.getByRole('img')).toHaveAttribute('src', 'blob:preview')
    expect(setImage).not.toHaveBeenCalled()

    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))

    expect(await screen.findByText(t('inventory.saved'))).toBeInTheDocument()
    expect(setImage).toHaveBeenCalledWith(item.id, expect.any(Blob))
    const saved = await current(item.id)
    expect(saved.imageUrl).toMatch(/^\/api\/images\//)
    // The row of the item now shows it.
    await waitFor(() => {
      const row = screen.getByText(item.name).closest('tr')!
      expect(row.querySelector('img')).toHaveAttribute('src', saved.imageUrl)
    })
    setImage.mockRestore()
  })

  it('can be removed', async () => {
    const { item, dialog } = await openEditor()
    // The test before gave the first item a picture.
    expect(dialog.getByRole('img')).toHaveAttribute('src', item.imageUrl)

    fireEvent.click(dialog.getByRole('button', { name: t('inventory.removeImage') }))
    expect(dialog.queryByRole('img')).not.toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))

    // Not judged by the 'saved' message: the one of the test before may still be on screen.
    await waitFor(async () => expect((await current(item.id)).imageUrl).toBeNull())
  })

  it('keeps the item when the picture is refused, and says the picture was not saved', async () => {
    const { item, dialog } = await openEditor()

    const notAPicture = new File(['%PDF'], 'price-list.pdf', { type: 'application/pdf' })
    fireEvent.change(dialog.getByLabelText(t('inventory.image')), {
      target: { files: [notAPicture] },
    })
    fireEvent.change(dialog.getByLabelText(t('inventory.name')), {
      target: { value: `${item.name} (แก้)` },
    })
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))

    expect(await screen.findByText('รูปต้องเป็นไฟล์ JPEG, PNG หรือ WebP')).toBeInTheDocument()
    const saved = await current(item.id)
    expect(saved.name).toBe(`${item.name} (แก้)`)
    expect(saved.imageUrl).toBeNull()
  })
})
