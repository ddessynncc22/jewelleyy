import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { RotateCcw } from 'lucide-react'

import { getActivityLogs } from '../../services/auditService'

import DataTable from '../../components/ui/DataTable'

import PageHeader from '../../components/ui/PageHeader'

import SearchInput from '../../components/ui/SearchInput'

import FilterPanel from '../../components/ui/FilterPanel'

import Button from '../../components/ui/Button'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'

const MODULE_OPTIONS = [
  { value: 'auth', label: 'Auth' },
  { value: 'item', label: 'Item' },
  { value: 'stock', label: 'Stock' },
  { value: 'customer', label: 'Customer' },
  { value: 'karigar', label: 'Karigar' },
  { value: 'pawn', label: 'Pawn' },
  { value: 'pos', label: 'POS' },
  { value: 'sale', label: 'Sale' },
  { value: 'rate', label: 'Rate' },
  { value: 'category', label: 'Category' },
  { value: 'User', label: 'User' },
  { value: 'Settings', label: 'Settings' },
  { value: 'system', label: 'System' },
  { value: 'customOrder', label: 'Custom Order' },
  { value: 'CustomerLedger', label: 'Customer Ledger' },
]

const ACTION_OPTIONS = [
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'login-failed', label: 'Login Failed' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'error', label: 'Error' },
]

const getActionBadge = (action) => {
  let cls = 'bg-gray-100 text-gray-700 border-gray-200'
  if (action === 'login') cls = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  else if (action === 'logout') cls = 'bg-blue-50 text-blue-700 border-blue-200'
  else if (action === 'login-failed' || action === 'error') cls = 'bg-red-50 text-red-700 border-red-200'
  else if (action === 'create') cls = 'bg-green-50 text-green-700 border-green-200'
  else if (action === 'update') cls = 'bg-amber-50 text-amber-700 border-amber-200'
  else if (action === 'delete') cls = 'bg-red-50 text-red-700 border-red-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${cls}`}>
      {action}
    </span>
  )
}

const columns = [
  { key: 'createdAt', label: 'Date/Time', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
  { key: 'performedBy', label: 'User', render: (v) => v?.name || v?.email || 'System' },
  { key: 'module', label: 'Module' },
  { key: 'action', label: 'Action', render: (v) => getActionBadge(v || '-') },
  { key: 'description', label: 'Description' },
  { key: 'ipAddress', label: 'IP Address', render: (v) => v || '-' },
]

export default function AuditLog() {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', page, search, filters],
    queryFn: () => getActivityLogs({ page, limit: 20, search, ...filters }),
  })

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleResetFilters = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  if (isLoading) return <LoadingSkeleton count={4} type="table" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  return (
    <div className="space-y-6">
      <PageHeader title="Activity Log" subtitle="Every action across the system - logins, signouts, errors and changes">
        <Button variant="outline" size="sm" onClick={() => refetch()} icon={<RotateCcw size={14} />}>Refresh</Button>
      </PageHeader>
      <div className="flex gap-4 items-start">
        <SearchInput
          value={search}
          onChange={(val) => { setSearch(val); setPage(1) }}
          placeholder="Search action, module, description..."
          className="max-w-xs"
        />
      </div>
      <FilterPanel filters={filters} onFilterChange={handleFilterChange} onReset={handleResetFilters}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Module</label>
            <select
              value={filters.module || ''}
              onChange={(e) => handleFilterChange('module', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Modules</option>
              {MODULE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={filters.action || ''}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FilterPanel>
      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={false}
        pagination={{
          page: data?.pagination?.page || 1,
          limit: data?.pagination?.limit || 20,
          total: data?.pagination?.total || 0,
          totalPages: data?.pagination?.totalPages || 1,
          onPageChange: setPage,
        }}
      />
    </div>
  )
}
