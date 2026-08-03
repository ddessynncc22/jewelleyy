import { useState, useEffect, useCallback } from 'react'

import { useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { Plus, Eye, Edit, Trash2, MessageCircle, Phone } from 'lucide-react'

import { getCustomers, deleteCustomer } from '../../services/customerService'

import PageHeader from '../../components/ui/PageHeader'

import SearchInput from '../../components/ui/SearchInput'

import DataTable from '../../components/ui/DataTable'

import Button from '../../components/ui/Button'

import ConfirmDialog from '../../components/ui/ConfirmDialog'

import FilterPanel from '../../components/ui/FilterPanel'

import { formatCurrency, formatDate } from '../../utils/helpers'

import CustomerForm from './CustomerForm'

const CustomerList = () => {
  const navigate = useNavigate()

  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ isActive: '', owing: '' })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })
  const [sort, setSort] = useState({ column: 'createdAt', direction: 'desc' })
  const [showForm, setShowForm] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sort: sort.column,
        order: sort.direction,
        ...filters,
      }
      if (search) params.search = search
      Object.keys(params).forEach((k) => {
        if (!params[k] && params[k] !== false) delete params[k]
      })

      const res = await getCustomers(params)
      const data = res.data?.data || res.data?.customers || res.data || []
      setCustomers(Array.isArray(data) ? data : [])

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
      toast.error(err?.response?.data?.message || 'Failed to load customers')
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [search, pagination.page, pagination.limit, sort, filters])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleSort = ({ column, direction }) => {
    setSort({ column, direction })
  }

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  const handleLimitChange = (limit) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }))
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditCustomer(null)
    fetchCustomers()
  }

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
    setPagination((p) => ({ ...p, page: 1 }))
  }

  const handleEdit = (customer) => {
    setEditCustomer(customer)
    setShowForm(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCustomer(deleteTarget._id)
      toast.success('Customer deleted successfully')
      setDeleteTarget(null)
      fetchCustomers()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete customer')
    }
  }

  const columns = [
    {
      key: 'customerCode',
      label: 'Customer Code',
      sortable: true,
      render: (val) => val || '-',
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (val, row) => (
        <button
          onClick={() => navigate(`/customers/${row._id}`)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {val}
        </button>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
      render: (val) => val || '-',
    },
    {
      key: 'address',
      label: 'Address',
      sortable: false,
      render: (val) =>
        val ? (val.length > 40 ? `${val.substring(0, 40)}...` : val) : '-',
    },
    {
      key: 'balance',
      label: 'Balance',
      sortable: true,
      render: (val) => (
        <span
          className={
            val > 0
              ? 'text-red-600 font-medium'
              : val < 0
                ? 'text-green-600 font-medium'
                : 'text-gray-600'
          }
        >
          {formatCurrency(val || 0)}
        </span>
      ),
    },
    {
      key: 'outstandingBalance',
      label: 'Outstanding',
      sortable: true,
      render: (val) => (
        <span
          className={
            val > 0 ? 'text-red-600 font-medium' : 'text-gray-600'
          }
        >
          {formatCurrency(val || 0)}
        </span>
      ),
    },
    {
      key: 'totalSpent',
      label: 'Total Spent',
      sortable: true,
      render: (val) => formatCurrency(val || 0),
    },
    {
      key: 'activePawnLoans',
      label: 'Pawn',
      sortable: false,
      render: (val) => (val > 0 ? <span className="text-orange-600 font-medium">{val}</span> : '0'),
    },
    {
      key: 'lastTransaction',
      label: 'Last Transaction',
      sortable: false,
      render: (val) => (val ? formatDate(val) : '-'),
    },
    {
      key: '_id',
      label: 'Actions',
      sortable: false,
      render: (val, row) => (
        <div className="flex items-center gap-1">
          {row.phone && (
            <>
              <a href={`tel:${row.phone}`} title="Call">
                <Button variant="ghost" size="sm" icon={Phone} onClick={(e) => e.stopPropagation()} />
              </a>
              <a
                href={`https://wa.me/${row.phone.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp"
              >
                <Button variant="ghost" size="sm" icon={MessageCircle} onClick={(e) => e.stopPropagation()} />
              </a>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/customers/${val}`)
            }}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Edit}
            onClick={(e) => {
              e.stopPropagation()
              handleEdit(row)
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={(e) => {
              e.stopPropagation()
              setDeleteTarget(row)
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Customers" subtitle="Manage your customer directory">
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            setEditCustomer(null)
            setShowForm(true)
          }}
        >
          Add Customer
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, phone, or customer code..."
            className="sm:w-80"
          />
        </div>

        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={() => {
            setFilters({ isActive: '', owing: '' })
            setPagination((p) => ({ ...p, page: 1 }))
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.isActive}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, isActive: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outstanding
              </label>
              <select
                value={filters.owing}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, owing: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="true">Owing only</option>
              </select>
            </div>
          </div>
        </FilterPanel>

        <DataTable
          columns={columns}
          data={customers}
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
        />
      </div>

      {showForm && (
        <CustomerForm
          customer={editCustomer}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setEditCustomer(null)
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        variant="danger"
      />
    </div>
  )
}

export default CustomerList
