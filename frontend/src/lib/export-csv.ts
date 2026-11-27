/** One column of an export: the header text and how to read the cell from a row. */
export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

/**
 * Spreadsheet programs run a cell that starts with one of these as a formula. Names and notes
 * are typed by users, so such text is prefixed with an apostrophe to keep it plain text.
 */
const FORMULA_START = /^[=+\-@\t\r]/

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  // Numbers and booleans are data, not user text: written as they are so Excel can sum them.
  let text = String(value)
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Builds RFC 4180 CSV text (CRLF line ends, quotes doubled). */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [
    columns.map((column) => cell(column.header)),
    ...rows.map((row) => columns.map((column) => cell(column.value(row)))),
  ]
  return lines.map((line) => line.join(',')).join('\r\n') + '\r\n'
}

/**
 * Saves the rows as a .csv file. The file starts with a UTF-8 byte-order mark, which is what
 * makes Excel read Thai text correctly when the file is opened by double-click.
 */
export function downloadCsv<T>(
  filename: string,
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
) {
  const blob = new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** `inventory` → `inventory-2026-11-27.csv` (local date). */
export function datedFilename(name: string): string {
  const now = new Date()
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-')
  return `${name}-${date}.csv`
}
