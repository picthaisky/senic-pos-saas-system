import { useQuery } from '@tanstack/react-query'
import { CloudOff, Package, ScanBarcode, Search } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, ErrorState, Input, PageSpinner } from '@/components/ui'
import type { InventoryItem } from '@/features/inventory/types'
import { formatCurrency, formatNumber } from '@/lib/format'
import { useNetworkStore } from '@/stores/network'
import { toast } from '@/stores/toast'
import { useCartStore } from '../cart-store'
import { CartPanel } from '../components/CartPanel'
import { findByBarcode, searchProducts, syncCatalog } from '../offline/catalog'

export function PosPage() {
  const { t } = useTranslation()
  const addItem = useCartStore((state) => state.addItem)
  const online = useNetworkStore((state) => state.online)

  const [barcode, setBarcode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [searchText, setSearchText] = useState('')
  /** The submitted search; results are only fetched once the cashier presses Enter or Search. */
  const [query, setQuery] = useState('')

  // Keep the offline copy of the catalog fresh: when the POS opens and when the network returns.
  useEffect(() => {
    if (online) void syncCatalog()
  }, [online])

  const results = useQuery({
    // `online` is part of the key so results are looked up again when the connection changes.
    queryKey: ['pos', 'search', query, online],
    queryFn: () => searchProducts(query),
    enabled: query !== '',
    // Run even when the browser is offline: the lookup falls back to the local catalog.
    networkMode: 'always',
    staleTime: 0,
  })

  function addToCart(item: InventoryItem) {
    if (!addItem(item)) toast.error(t('pos.outOfStockNamed', { name: item.name }))
  }

  async function handleScan(event: FormEvent) {
    event.preventDefault()
    const code = barcode.trim()
    if (!code) return
    setScanning(true)
    try {
      const { result: item } = await findByBarcode(code)
      if (item) {
        addToCart(item)
        setBarcode('')
      } else {
        toast.error(t('pos.barcodeNotFound', { barcode: code }))
      }
    } catch {
      toast.error(t('common.error'))
    } finally {
      setScanning(false)
    }
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    setQuery(searchText.trim())
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="sr-only">{t('nav.pos')}</h1>
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <form onSubmit={handleScan} className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={t('pos.scanBarcode')}
                  placeholder={t('pos.scanPlaceholder')}
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <Button
                type="submit"
                size="icon"
                loading={scanning}
                aria-label={t('pos.scanBarcode')}
              >
                {!scanning && <ScanBarcode className="size-5" />}
              </Button>
            </form>
            <form onSubmit={handleSearch} className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={t('pos.searchProducts')}
                  type="search"
                  placeholder={t('inventory.searchPlaceholder')}
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" size="icon" variant="secondary" aria-label={t('common.search')}>
                <Search className="size-5" />
              </Button>
            </form>
          </div>
        </Card>

        {query !== '' && (
          <Card title={t('pos.results')}>
            {results.isPending ? (
              <PageSpinner />
            ) : results.isError ? (
              <ErrorState message={t('common.loadFailed')} />
            ) : (
              <>
                {results.data.source === 'local' && (
                  <p className="mb-3 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm">
                    <CloudOff className="size-4 shrink-0 text-warning" aria-hidden="true" />
                    {t('offline.localResults')}
                  </p>
                )}
                {results.data.result.length === 0 ? (
                  <p className="py-8 text-center text-muted">{t('pos.noResults', { query })}</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {results.data.result.map((item) => (
                      <li key={item.id}>
                        <ProductCard item={item} onAdd={() => addToCart(item)} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        )}
      </div>

      <CartPanel />
    </div>
  )
}

function ProductCard({ item, onAdd }: { item: InventoryItem; onAdd: () => void }) {
  const { t } = useTranslation()
  const outOfStock = item.quantity <= 0

  return (
    <button
      type="button"
      disabled={outOfStock}
      onClick={onAdd}
      className="flex w-full cursor-pointer flex-col rounded-lg border border-border p-3 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="mb-2 h-24 w-full rounded object-cover" />
      ) : (
        <div className="mb-2 flex h-24 w-full items-center justify-center rounded bg-bg">
          <Package className="size-10 text-muted" aria-hidden="true" />
        </div>
      )}
      <span className="text-sm font-medium">{item.name}</span>
      <span className="text-xs text-muted">{item.sku}</span>
      <span className="mt-1 text-lg font-semibold text-primary tabular-nums">
        {formatCurrency(item.price)}
      </span>
      <span className="text-xs text-muted">
        {outOfStock
          ? t('pos.outOfStock')
          : t('pos.inStock', { count: formatNumber(item.quantity) })}
      </span>
    </button>
  )
}
