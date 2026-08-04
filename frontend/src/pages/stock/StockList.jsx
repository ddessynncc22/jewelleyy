import { useState } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  Download,
  ArrowUpFromLine,
  ArrowDownToLine,
  Activity,
  PackagePlus,
  PackageMinus,
  Scale,
  Gem,
} from 'lucide-react'

import toast from 'react-hot-toast'

import { getStockMovements, getStockStats } from '../../services/stockService'

import DataTable from '../../components/ui/DataTable'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import FilterPanel from '../../components/ui/FilterPanel'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'

import {
  formatWeight,
  formatWeightTolaLaal,
  formatDateTime,
  getImageSrc,
} from '../../utils/helpers'

import StockForm from './StockForm'

const TYPE_OPTIONS = [
  { value: 'stockIn', label: 'Stock In' },
  { value: 'stockOut', label: 'Stock Out' },
]

const CATEGORY_OPTIONS = [
  { value: 'Purchase', label: 'Purchase' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Return from Karigar', label: 'Return from Karigar' },
  { value: 'Pawn Redemption', label: 'Bandaki Redemption' },
  { value: 'Sale Return', label: 'Sale Return' },
  { value: 'Transfer In', label: 'Transfer In' },
  { value: 'Sale', label: 'Sale' },
  { value: 'Branch Transfer', label: 'Branch Transfer' },
  { value: 'Damaged', label: 'Damaged' },
  { value: 'With Karigar', label: 'With Karigar' },
  { value: 'Pawn Issuance', label: 'Bandaki Intake' },
  { value: 'Melted', label: 'Melted' },
  { value: 'Purchase Return', label: 'Purchase Return' },
  { value: 'Transfer Out', label: 'Transfer Out' },
  { value: 'Adjustment', label: 'Adjustment' },
]

const MovementBadge = ({ type }) => {
  const isIn = type === 'stockIn'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        isIn
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {isIn ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
      {isIn ? 'Stock In' : 'Stock Out'}
    </span>
  )
}

const FilterSelect = ({ label, value, onChange, options = [], placeholder }) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
)

const DateInput = ({ label, value, onChange }) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
    </label>
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
    />
  </div>
)

const StockList = () => {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState(null)

  const movementsQuery = useQuery({
    queryKey: ['stock-movements', page, limit, search, filters],
    queryFn: () => {
      const params = { page, limit, ...filters }
      if (search) params.search = search
      return getStockMovements(params)
    },
  })

  const body = movementsQuery.data?.data || {}
  const movements = body.data || []

  const { data: statsRes } = useQuery({
    queryKey: ['stock-stats'],
    queryFn: getStockStats,
    staleTime: 60000,
  })
  const stats = statsRes?.data?.data || {}

  const handleFormSuccess = () => {
    setShowForm(false)
    setFormMode(null)
    queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    queryClient.invalidateQueries({ queryKey: ['stock-stats'] })
  }

  const handleAddStock = (mode) => {
    setFormMode(mode)
    setShowForm(true)
  }

  const handleSearch = (val) => {
    setSearch(val)
    setPage(1)
  }

  const handleFilterChange = (keyOrObj, value) => {
    if (typeof keyOrObj === 'object' && keyOrObj !== null) {
      setFilters(keyOrObj)
    } else {
      setFilters((prev) => ({ ...prev, [keyOrObj]: value }))
    }
    setPage(1)
  }

  const handleResetFilters = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  const handleExport = () => {
    const headers = [
      'Date', 'Type', 'Category', 'Item Name', 'SKU', 'Quantity', 'Weight (g)',
      'Purity', 'Reference', 'Notes', 'Performed By',
    ]
    const rows = movements.map((m) => [
      formatDateTime(m.movementDate),
      m.type === 'stockIn' ? 'Stock In' : 'Stock Out',
      m.category || '',
      m.item?.itemName || '',
      m.item?.SKU || '',
      m.quantity ?? '',
      m.weight ?? '',
      m.purity ?? '',
      m.reference || '',
      m.notes || '',
      typeof m.performedBy === 'object' ? m.performedBy?.name || '' : m.performedBy || '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `stock_movements_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Stock movements exported as CSV')
  }

  const columns = [
    {
      key: 'movementDate',
      label: 'Date',
      render: (val) => (
        <span className="whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
          {formatDateTime(val)}
        </span>
      ),
    },
    {
      key: 'item',
      label: 'Item',
      render: (_, row) => {
        const item = row.item
        if (!item) {
          return <span className="text-sm text-[var(--color-text-secondary)]">—</span>
        }
        const imgSrc = getImageSrc(item.images?.[0])
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]">
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={item.itemName || 'Item'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Gem className="h-4 w-4 text-[var(--color-border)]" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="max-w-[200px] truncate text-sm font-medium text-[var(--color-text)]">
                {item.itemName || 'Unknown item'}
              </p>
              {item.SKU && (
                <p className="font-mono text-xs text-[var(--color-text-secondary)]">{item.SKU}</p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'type',
      label: 'Movement',
      render: (val, row) => (
        <div className="space-y-1">
          <MovementBadge type={val} />
          {row.category && (
            <p className="text-xs text-[var(--color-text-secondary)]">{row.category}</p>
          )}
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Qty',
      render: (val) => (
        <span className="font-medium text-[var(--color-text)]">
          {Number(val ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'weight',
      label: 'Weight',
      render: (val) => (
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{formatWeight(val)}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{formatWeightTolaLaal(val)}</p>
        </div>
      ),
    },
    {
      key: 'purity',
      label: 'Purity',
      render: (val) =>
        val ? (
          <Badge label={String(val)} variant="default" size="sm" />
        ) : (
          <span className="text-sm text-[var(--color-text-secondary)]">-</span>
        ),
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (val, row) => {
        if (!val && !row.notes) {
          return <span className="text-sm text-[var(--color-text-secondary)]">-</span>
        }
        return (
          <div className="min-w-0">
            {val && (
              <p className="truncate text-sm font-medium text-[var(--color-text)]">{val}</p>
            )}
            {row.notes && (
              <p
                className="max-w-[180px] truncate text-xs text-[var(--color-text-secondary)]"
                title={row.notes}
              >
                {row.notes}
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'performedBy',
      label: 'Performed By',
      render: (val) => {
        const name = val && typeof val === 'object' ? val.name || val.email || '' : val || ''
        if (!name) return <span className="text-sm text-[var(--color-text-secondary)]">-</span>
        const initials = name
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-semibold text-[var(--color-primary)]">
              {initials}
            </span>
            <span className="truncate text-sm text-[var(--color-text)]">{name}</span>
          </div>
        )
      },
    },
  ]

  const hasActiveFilter = search || Object.keys(filters).some((k) => filters[k])

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Movement" subtitle="Track inventory changes">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" icon={Download} onClick={handleExport}>
            Export CSV
          </Button>
          <Button variant="outline" icon={ArrowUpFromLine} onClick={() => handleAddStock('out')}>
            New Stock Out
          </Button>
          <Button icon={ArrowDownToLine} onClick={() => handleAddStock('in')}>
            New Stock In
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Movements"
          value={stats.totalMovements ?? '—'}
          icon={Activity}
          color="blue"
          subtitle="All stock activity"
        />
        <StatCard
          title="Stock In"
          value={stats.stockIn ?? '—'}
          icon={PackagePlus}
          color="green"
          subtitle={`${formatWeight(stats.weightIn)} received`}
          onClick={() => {
            setSearch('')
            handleFilterChange('type', 'stockIn')
          }}
        />
        <StatCard
          title="Stock Out"
          value={stats.stockOut ?? '—'}
          icon={PackageMinus}
          color="red"
          subtitle={`${formatWeight(stats.weightOut)} issued`}
          onClick={() => {
            setSearch('')
            handleFilterChange('type', 'stockOut')
          }}
        />
        <StatCard
          title="Net Weight"
          value={formatWeight(stats.netWeight)}
          icon={Scale}
          color="gold"
          subtitle="Stock in minus stock out"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search by item name, SKU, reference..."
          className="sm:max-w-md"
        />
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Type"
            value={filters.type || ''}
            onChange={(v) => handleFilterChange('type', v)}
            options={TYPE_OPTIONS}
            placeholder="All Types"
          />
          <FilterSelect
            label="Category"
            value={filters.category || ''}
            onChange={(v) => handleFilterChange('category', v)}
            options={CATEGORY_OPTIONS}
            placeholder="All Categories"
          />
          <DateInput
            label="Start Date"
            value={filters.startDate}
            onChange={(v) => handleFilterChange('startDate', v)}
          />
          <DateInput
            label="End Date"
            value={filters.endDate}
            onChange={(v) => handleFilterChange('endDate', v)}
          />
        </div>
      </FilterPanel>

      {movementsQuery.isError ? (
        <ErrorState
          message={movementsQuery.error?.message || 'Failed to load stock movements'}
          onRetry={() => movementsQuery.refetch()}
        />
      ) : movements.length === 0 && !movementsQuery.isLoading ? (
        hasActiveFilter ? (
          <EmptyState
            title="No movements found"
            description="Try adjusting your search or filters"
          />
        ) : (
          <EmptyState
            title="No stock movements yet"
            description="Record stock in or out to start tracking your inventory"
            action={{ label: 'New Stock In', onClick: () => handleAddStock('in') }}
          />
        )
      ) : (
        <DataTable
          columns={columns}
          data={movements}
          loading={movementsQuery.isLoading}
          pagination={{
            page,
            limit,
            total: body.pagination?.total ?? 0,
            totalPages: body.pagination?.totalPages ?? 1,
            onPageChange: setPage,
            onLimitChange: (l) => {
              setLimit(l)
              setPage(1)
            },
          }}
        />
      )}

      {showForm && (
        <StockForm
          mode={formMode}
          onClose={() => {
            setShowForm(false)
            setFormMode(null)
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}

export default StockList
