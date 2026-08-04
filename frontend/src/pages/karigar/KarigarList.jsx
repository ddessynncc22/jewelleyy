import { useState, useEffect, useCallback } from 'react'

import { useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { Plus, Edit2, Trash2, Eye } from 'lucide-react'

import { getKarigars, deleteKarigar } from '../../services/karigarService'

import DataTable from '../../components/ui/DataTable'

import PageHeader from '../../components/ui/PageHeader'

import SearchInput from '../../components/ui/SearchInput'

import FilterPanel from '../../components/ui/FilterPanel'

import Button from '../../components/ui/Button'

import StatusBadge from '../../components/ui/StatusBadge'

import EmptyState from '../../components/ui/EmptyState'

import ErrorState from '../../components/ui/ErrorState'

import ConfirmDialog from '../../components/ui/ConfirmDialog'

import { formatDate } from '../../utils/helpers'

import KarigarForm from './KarigarForm'

const KarigarList = () => {
  const navigate = useNavigate()

  const [karigars, setKarigars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '' })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })
  const [formOpen, setFormOpen] = useState(false)
  const [editKarigar, setEditKarigar] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const fetchKarigars = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search,
        ...filters,
      }
      Object.keys(params).forEach((k) => {
        if (!params[k] && params[k] !== 0) delete params[k]
      })

      const { data } = await getKarigars(params)
      setKarigars(data?.data || data?.karigars || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load karigars')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, search, filters])

  useEffect(() => {
    fetchKarigars()
  }, [fetchKarigars])

  const handleSearch = (val) => {
    setSearch(val)
    setPagination((p) => ({ ...p, page: 1 }))
  }

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
    setPagination((p) => ({ ...p, page: 1 }))
  }

  const handleResetFilters = () => {
    setFilters({ status: '' })
    setPagination((p) => ({ ...p, page: 1 }))
  }

  const handlePageChange = (page) => setPagination((p) => ({ ...p, page }))

  const handleLimitChange = (limit) => setPagination((p) => ({ ...p, limit, page: 1 }))

  const handleAdd = () => {
    setEditKarigar(null)
    setFormOpen(true)
  }

  const handleEdit = (karigar, e) => {
    e?.stopPropagation()
    setEditKarigar(karigar)
    setFormOpen(true)
  }

  const handleView = (karigar, e) => {
    e?.stopPropagation()
    navigate(`/karigar/${karigar._id}`)
  }

  const handleDeleteClick = (karigar, e) => {
    e?.stopPropagation()
    setDeleteId(karigar._id)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    await deleteKarigar(deleteId)
    toast.success('Karigar deleted successfully')
    setDeleteId(null)
    fetchKarigars()
  }

  const handleFormSave = () => {
    setFormOpen(false)
    setEditKarigar(null)
    fetchKarigars()
  }

  const handleRowClick = (karigar) => navigate(`/karigar/${karigar._id}`)

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (val, row) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: true,
      render: (val) => val || '-',
    },
    {
      key: 'specialization',
      label: 'Specialization',
      render: (val) => val || '-',
    },
    {
      key: 'pendingJobs',
      label: 'Pending Jobs',
      sortable: true,
      render: (val) => val ?? 0,
    },
    {
      key: 'totalIssued',
      label: 'Total Issued',
      sortable: true,
      render: (val) => val ?? 0,
    },
    {
      key: 'totalReturned',
      label: 'Total Returned',
      sortable: true,
      render: (val) => val ?? 0,
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (val) => (
        <StatusBadge
          status={val ? 'Active' : 'Inactive'}
          size="sm"
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => handleView(row, e)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => handleEdit(row, e)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(row, e)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  if (error) {
    return <ErrorState message={error} onRetry={fetchKarigars} />
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Karigars" subtitle="Manage artisans and craftsmen">
        <Button icon={Plus} onClick={handleAdd}>
          Add Karigar
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search by name, phone, specialization..."
          className="sm:w-80"
        />
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                handleFilterChange({ ...filters, status: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </FilterPanel>

      {!loading && karigars.length === 0 ? (
        <EmptyState
          title="No karigars found"
          description={
            search || filters.status
              ? 'Try adjusting your search or filters'
              : 'Add your first karigar to get started'
          }
          action={
            !search && !filters.status
              ? { label: 'Add Karigar', onClick: handleAdd }
              : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={karigars}
          loading={loading}
          onRowClick={handleRowClick}
          onSort={(s) => setPagination((p) => ({ ...p, page: 1 }))}
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

      <KarigarForm
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditKarigar(null)
        }}
        karigar={editKarigar}
        onSave={handleFormSave}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Karigar"
        message="Are you sure you want to delete this karigar? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}

export default KarigarList
