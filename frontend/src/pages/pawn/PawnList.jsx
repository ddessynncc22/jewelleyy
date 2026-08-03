import { useState, useEffect, useCallback } from 'react'

import { useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { Plus, Edit2, Trash2, Eye } from 'lucide-react'

import { getPawnLoans, deletePawnLoan } from '../../services/pawnService'

import DataTable from '../../components/ui/DataTable'

import PageHeader from '../../components/ui/PageHeader'

import SearchInput from '../../components/ui/SearchInput'

import FilterPanel from '../../components/ui/FilterPanel'

import Button from '../../components/ui/Button'

import StatusBadge from '../../components/ui/StatusBadge'

import EmptyState from '../../components/ui/EmptyState'

import ErrorState from '../../components/ui/ErrorState'

import ConfirmDialog from '../../components/ui/ConfirmDialog'

import { formatCurrency, formatDate } from '../../utils/helpers'

import PawnForm from './PawnForm'

const statusOptions = [
  { value: 'Active', label: 'Active' },
  { value: 'Renewed', label: 'Renewed' },
  { value: 'Redeemed', label: 'Redeemed' },
  { value: 'Forfeited', label: 'Forfeited' },
]

const PawnList = () => {
  const navigate = useNavigate()

  const [loans, setLoans] = useState([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')

  const [filters, setFilters] = useState({ status: '', dateFrom: '', dateTo: '' })

  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })

  const [formOpen, setFormOpen] = useState(false)

  const [editLoan, setEditLoan] = useState(null)

  const [deleteId, setDeleteId] = useState(null)

  const fetchLoans = useCallback(async () => {
    setLoading(true); setError(null); try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search,
        ...filters,
      }
      Object.keys(params).forEach((k) => {
        if (!params[k] && params[k] !== 0) delete params[k]
      })

      const { data } = await getPawnLoans(params); setLoans(data?.data || data?.loans || [])
      if (data?.pagination); setPagination((prev) => ({ ...prev, ...data.pagination }))
      if (data?.total != null); setPagination((prev) => ({ ...prev, total: data.total, totalPages: data.totalPages || Math.ceil(data.total / prev.limit) }))
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load Bandaki')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, search, filters])
  useEffect(() => { fetchLoans() }, [fetchLoans])

  const handleSearch = (val) => { setSearch(val); setPagination((p) => ({ ...p, page: 1 })) }

  const handleFilterChange = (newFilters) => { setFilters(newFilters); setPagination((p) => ({ ...p, page: 1 })) }

  const handleResetFilters = () => { setFilters({ status: '', dateFrom: '', dateTo: '' }); setPagination((p) => ({ ...p, page: 1 })) }

  const handlePageChange = (page) => setPagination((p) => ({ ...p, page }))

  const handleLimitChange = (limit) => setPagination((p) => ({ ...p, limit, page: 1 }))

  const handleAdd = () => { setEditLoan(null); setFormOpen(true) }

  const handleEdit = (loan, e) => { e?.stopPropagation(); setEditLoan(loan); setFormOpen(true) }

  const handleView = (loan, e) => { e?.stopPropagation(); navigate(`/pawn/${loan._id}`) }

  const handleDeleteClick = (loan, e) => { e?.stopPropagation(); setDeleteId(loan._id) }

  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    await deletePawnLoan(deleteId)
    toast.success('Bandaki deleted successfully')
    setDeleteId(null)
    fetchLoans()
  }

  const handleFormSave = () => { setFormOpen(false); setEditLoan(null); fetchLoans() }

  const handleRowClick = (loan) => navigate(`/pawn/${loan._id}`)

  const getDisplayStatus = (status) => {
    const map = { Active: 'Active', Renewed: 'Renewed', Redeemed: 'Redeemed', Forfeited: 'Forfeited', active: 'Active', renewed: 'Renewed', redeemed: 'Redeemed', forfeited: 'Forfeited' }
    return map[status] || status
  }

  const columns = [
    { key: 'loanNumber', label: 'Loan Number', sortable: true, render: (val, row) => (
      <span className="font-medium text-gray-900">{row.loanNumber || row._id?.slice(-6).toUpperCase()}</span>
    )},
    { key: 'customerName', label: 'Customer Name', sortable: true, render: (val, row) => (
      <span className="font-medium text-gray-900">{row.customer?.name || '-'}</span>
    )},
    { key: 'phone', label: 'Phone', render: (val, row) => row.customer?.phone || '-' },
    { key: 'loanAmount', label: 'Loan Amount', sortable: true, render: (val) => formatCurrency(val || 0) },
    { key: 'balance', label: 'Balance', render: (val) => formatCurrency(val ?? 0) },
    { key: 'interestRate', label: 'Monthly Interest', render: (val) => val ? `${val}%` : '-' },
    { key: 'startDate', label: 'Start Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'dueDate', label: 'Due Date', render: (val) => formatDate(val) },
    { key: 'status', label: 'Status', render: (val) => (
      <StatusBadge status={getDisplayStatus(val)} size="sm" />
    )},
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button onClick={(e) => handleView(row, e)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View"><Eye className="h-4 w-4" /></button>
        <button onClick={(e) => handleEdit(row, e)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit"><Edit2 className="h-4 w-4" /></button>
        <button onClick={(e) => handleDeleteClick(row, e)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
      </div>
    )},
  ]
  if (error) return <ErrorState message={error} onRetry={fetchLoans} />
  return (
    <div className="space-y-6">
      <PageHeader title="Bandaki" subtitle="Manage Bandaki transactions">
        <Button icon={Plus} onClick={handleAdd}>New Bandaki</Button>
      </PageHeader>
      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput value={search} onChange={handleSearch} placeholder="Search by loan number, customer name, phone..." className="sm:w-80" />
      </div>
      <FilterPanel filters={filters} onFilterChange={handleFilterChange} onReset={handleResetFilters}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={filters.status} onChange={(e) => handleFilterChange({ ...filters, status: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">All</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date From</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange({ ...filters, dateFrom: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date To</label>
            <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange({ ...filters, dateTo: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </FilterPanel>
      <DataTable
        columns={columns}
        data={loans}
        loading={loading}
        pagination={{
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          totalPages: pagination.totalPages,
          onPageChange: handlePageChange,
          onLimitChange: handleLimitChange,
        }}
        onRowClick={handleRowClick}
      />
      <PawnForm isOpen={formOpen} onClose={() => setFormOpen(false)} loan={editLoan} onSave={handleFormSave} />
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDeleteConfirm} title="Delete Bandaki" message="Are you sure you want to delete this Bandaki record?" confirmText="Delete" variant="danger" />
    </div>
  )
}

export default PawnList