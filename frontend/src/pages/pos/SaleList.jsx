import { useState, useEffect, useCallback } from 'react'

import { useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { Eye, Printer, ReceiptText, ShoppingCart } from 'lucide-react'

import { getSales } from '../../services/posService'

import { getCustomers } from '../../services/customerService'

import PageHeader from '../../components/ui/PageHeader'

import SearchInput from '../../components/ui/SearchInput'

import FilterPanel from '../../components/ui/FilterPanel'

import DataTable from '../../components/ui/DataTable'

import Button from '../../components/ui/Button'

import StatusBadge from '../../components/ui/StatusBadge'

import { formatCurrency, formatDateTime } from '../../utils/helpers'

const SaleList = () => {
  const navigate = useNavigate()

  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    paymentType: '',
    dateFrom: '',
    dateTo: '',
    customer: '',
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })
  const [sort, setSort] = useState({ column: 'createdAt', direction: 'desc' })
  const [customerOptions, setCustomerOptions] = useState([])

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await getCustomers({ limit: 100 })
        const data = res.data?.data || res.data?.customers || res.data || []
        setCustomerOptions(
          Array.isArray(data)
            ? data.map((c) => ({ value: c._id, label: `${c.name} (${c.phone})` }))
            : [],
        )
      } catch {
        setCustomerOptions([])
      }
    }
    fetchCustomers()
  }, [])

  const fetchSales = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      }
      if (search) params.search = search
      if (filters.paymentType) params.paymentType = filters.paymentType
      if (filters.dateFrom) params.startDate = filters.dateFrom
      if (filters.dateTo) params.endDate = filters.dateTo
      if (filters.customer) params.customer = filters.customer

      const res = await getSales(params)
      const data = res.data?.data || res.data?.sales || res.data || []
      setSales(Array.isArray(data) ? data : [])

      if (res.data?.pagination) {
        setPagination((prev) => ({ ...prev, ...res.data.pagination }))
      }
      if (res.data?.total !== undefined) {
        setPagination((prev) => ({
          ...prev,
          total: res.data.total,
          totalPages: res.data.totalPages || Math.ceil(res.data.total / pagination.limit),
        }))
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load sales')
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [search, filters, pagination.page, pagination.limit, sort])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  const handleSort = ({ column, direction }) => {
    setSort({ column, direction })
  }

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  const handleLimitChange = (limit) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }))
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const resetFilters = () => {
    setFilters({ paymentType: '', dateFrom: '', dateTo: '', customer: '' })
    setSearch('')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const columns = [
    { key: 'saleNumber', label: 'Sale Number', sortable: true },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (val) => formatDateTime(val),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortable: false,
      render: (val) => val?.name || 'Walk-in',
    },
    {
      key: 'items',
      label: 'Items',
      sortable: false,
      render: (val) => (Array.isArray(val) ? val.length : val || 0),
    },
    {
      key: 'totalAmount',
      label: 'Total Amount',
      sortable: true,
      render: (val) => formatCurrency(val),
    },
    {
      key: 'paidAmount',
      label: 'Paid Amount',
      sortable: true,
      render: (val) => formatCurrency(val),
    },
    {
      key: 'balance',
      label: 'Balance',
      sortable: true,
      render: (val) => (
        <span className={val > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: 'paymentType',
      label: 'Payment Type',
      sortable: true,
      render: (val) => (
        <StatusBadge
          status={
            val
              ? val.charAt(0).toUpperCase() + val.slice(1).replace('_', ' ')
              : '-'
          }
          size="sm"
        />
      ),
    },
    {
      key: '_id',
      label: 'Actions',
      sortable: false,
      render: (val) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/pos/sales/${val}`)
            }}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={ReceiptText}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/pos/print-invoice/${val}`)
            }}
          >
            Preview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Printer}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/pos/print-invoice/${val}?print=1`)
            }}
          >
            Print
          </Button>
        </div>
      ),
    },
  ]

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Payment Type
        </label>
        <select
          value={filters.paymentType}
          onChange={(e) => handleFilterChange('paymentType', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="cash">Cash</option>
          <option value="khaata">Khaata</option>
          <option value="partial">Partial</option>
          <option value="oldGoldExchange">Old Gold Exchange</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Date From
        </label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Date To
        </label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Customer
        </label>
        <select
          value={filters.customer}
          onChange={(e) => handleFilterChange('customer', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All</option>
          {customerOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader title="Sales History" subtitle="View and manage all POS transactions">
        <Button icon={ShoppingCart} onClick={() => navigate('/pos')}>
          New Sale
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="max-w-md flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by sale number, customer..."
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={sales}
          loading={loading}
          onSort={handleSort}
          pagination={{
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
            onPageChange: handlePageChange,
            onLimitChange: handleLimitChange,
          }}
          filters={
            <FilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={resetFilters}
            >
              {filterContent}
            </FilterPanel>
          }
        />
      </div>
    </div>
  )
}

export default SaleList
