import { type CsvColumn, toCsv } from './export-csv'

interface Row {
  name: string
  price: number
  note: string | null
}

const columns: CsvColumn<Row>[] = [
  { header: 'ชื่อ', value: (row) => row.name },
  { header: 'ราคา', value: (row) => row.price },
  { header: 'หมายเหตุ', value: (row) => row.note },
]

describe('toCsv', () => {
  it('writes a header row and one line per row, ending each with CRLF', () => {
    const csv = toCsv([{ name: 'น้ำดื่ม', price: 10, note: null }], columns)

    expect(csv).toBe('ชื่อ,ราคา,หมายเหตุ\r\nน้ำดื่ม,10,\r\n')
  })

  it('quotes cells that contain commas, quotes or line breaks', () => {
    const csv = toCsv([{ name: 'ชา "เขียว", ขวด', price: 25.5, note: 'บรรทัด 1\nบรรทัด 2' }], columns)

    expect(csv.split('\r\n')[1]).toBe('"ชา ""เขียว"", ขวด",25.5,"บรรทัด 1\nบรรทัด 2"')
  })

  it('stops user text from being run as a spreadsheet formula', () => {
    const csv = toCsv(
      [
        { name: '=HYPERLINK("http://evil.example")', price: 1, note: '+66812345678' },
        { name: '@cmd', price: 1, note: '-5 องศา' },
      ],
      columns,
    )

    const [, first, second] = csv.split('\r\n')
    expect(first).toBe(`"'=HYPERLINK(""http://evil.example"")",1,'+66812345678`)
    expect(second).toBe(`'@cmd,1,'-5 องศา`)
  })

  it('leaves negative numbers as numbers', () => {
    const csv = toCsv([{ name: 'ส่วนลด', price: -5, note: null }], columns)

    expect(csv.split('\r\n')[1]).toBe('ส่วนลด,-5,')
  })
})
