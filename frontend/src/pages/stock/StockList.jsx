import { useState, useEffect, useCallback } from 'react'

import { Plus, Download } from 'lucide-react'

import toast from 'react-hot-toast'

import { getStockMovements } from '../../services/stockService'

import DataTable from '../../components/ui/DataTable'

import PageHeader from '../../components/ui/PageHeader'

import SearchInput from '../../components/ui/SearchInput'

import FilterPanel from '../../components/ui/FilterPanel'

import Button from '../../components/ui/Button'

import StatusBadge from '../../components/ui/StatusBadge'

import ErrorState from '../../components/ui/ErrorState'

import { formatWeight, formatDate } from '../../utils/helpers'

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

const StockList = () => {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState(null)

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      }
      if (search) params.search = search
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate

      const res = await getStockMovements(params)
      const data = res.data
      setMovements(data.data || [])
      if (data.pagination) {
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }))
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load stock movements')
    } finally {
      setLoading(false)
    }
  }, [search, filters, pagination.page, pagination.limit])

  useEffect(() => {
    fetchMovements()
  }, [fetchMovements])

  const handleFormSuccess = () => {
    setShowForm(false)
    setFormMode(null)
    fetchMovements()
  }

  const handleAddStock = (mode) => {
    setFormMode(mode)
    setShowForm(true)
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleResetFilters = () => {
    setFilters({})
    setSearch('')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  const handleLimitChange = (limit) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }))
  }

  const columns = [
    {
      key: 'movementDate',
      label: 'Date',
      render: (val) => formatDate(val),
    },
    {
      key: 'item',
      label: 'Item',
      render: (_, row) => {
        const item = row.item
        if (!item) return '-'
        return (
          <div>
            <p className="font-medium text-gray-900">
              {item.itemName || 'Unknown'}
            </p>
            {item.SKU && <p className="text-xs text-gray-500">{item.SKU}</p>}
          </div>
        )
      },
    },
    {
      key: 'type',
      label: 'Type',
      render: (val) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            val === 'stockIn'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {val === 'stockIn' ? 'Stock In' : 'Stock Out'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => val || '-',
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (val) => Number(val ?? 0).toLocaleString(),
    },
    {
      key: 'weight',
      label: 'Weight',
      render: (val) => formatWeight(val),
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (val) => val || '-',
    },
    {
      key: 'performedBy',
      label: 'Performed By',
      render: (val) => {
        if (!val) return '-'
        if (typeof val === 'object') return val.name || val.email || '-'
        return val
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Movement" subtitle="Track inventory changes">
        <Button
          variant="outline"
          icon={Download}
          onClick={() => toast('Export feature coming soon')}
        >
          Export
        </Button>
        <Button
          variant="outline"
          icon={Plus}
          onClick={() => handleAddStock('out')}
        >
          New Stock Out
        </Button>
        <Button icon={Plus} onClick={() => handleAddStock('in')}>
          New Stock In
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
          placeholder="Search by item name, SKU, reference..."
          className="sm:max-w-md"
        />
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Type
            </label>
            <select
              value={filters.type || ''}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Category
            </label>
            <select
              value={filters.category || ''}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FilterPanel>

      {error ? (
        <ErrorState message={error} onRetry={fetchMovements} />
      ) : (
        <DataTable
          columns={columns}
          data={movements}
          loading={loading}
          pagination={{
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
            onPageChange: handlePageChange,
            onLimitChange: handleLimitChange,
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
