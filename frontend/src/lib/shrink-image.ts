/** The longest side of a picture after shrinking, in pixels: plenty for a product card. */
const MAX_SIDE = 800

/**
 * A copy of the picture no larger than 800 pixels on its longest side, as a JPEG. A phone
 * photo of several megabytes becomes about a hundred kilobytes, which is what the till needs.
 * When the browser cannot decode the file, it is returned as it is and the server decides.
 */
export async function shrinkImage(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    // JPEG has no transparency: see-through parts become white, not black.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const shrunk = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    return shrunk ?? file
  } finally {
    bitmap.close()
  }
}
