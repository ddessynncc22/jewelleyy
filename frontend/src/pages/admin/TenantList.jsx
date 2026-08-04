import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2, CheckCircle, XCircle, Plus, Users } from 'lucide-react'
import { listTenants } from '../../services/tenantService'
import { getAdminStats, toggleTenantStatus } from '../../services/adminService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import SearchInput from '../../components/ui/SearchInput'
import FilterPanel from '../../components/ui/FilterPanel'
import PlanBadge, { PLAN_OPTIONS } from '../../components/ui/PlanBadge'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import { formatDate } from '../../utils/helpers'

export default function TenantList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ isActive: '', planType: '' })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [stats, setStats] = useState({ totalTenants: 0, activeTenants: 0, inactiveTenants: 0 })

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page: pagination.page, limit: pagination.limit, ...filters }
      if (search) params.search = search
      Object.keys(params).forEach((k) => {
        if (!params[k] && params[k] !== false) delete params[k]
      })
      const res = await listTenants(params)
      const data = res.data?.data || []
      setTenants(Array.isArray(data) ? data : [])
      if (res.data?.pagination) {
        setPagination((prev) => ({ ...prev, ...res.data.pagination }))
      }
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [search, pagination.page, pagination.limit, filters])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  const fetchStats = useCallback(async () => {
    try {
      const res = await getAdminStats()
      const data = res.data?.data || {}
      setStats({
        totalTenants: data.totalTenants || 0,
        activeTenants: data.activeTenants || 0,
        inactiveTenants: data.inactiveTenants || 0,
      })
    } catch {
      // stats are non-critical
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const toggleMutation = useMutation({
    mutationFn: toggleTenantStatus,
    onSuccess: (res) => {
      const msg = res.data?.message || 'Status updated'
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      fetchTenants()
      fetchStats()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Toggle failed'),
  })

  const handlePageChange = (page) => setPagination((prev) => ({ ...prev, page }))
  const handleLimitChange = (limit) => setPagination((prev) => ({ ...prev, limit, page: 1 }))

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
    setPagination((p) => ({ ...p, page: 1 }))
  }

  const handleResetFilters = () => {
    setFilters({ isActive: '', planType: '' })
    setPagination((p) => ({ ...p, page: 1 }))
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (val, row) => (
        <button
          onClick={() => navigate(`/admin/tenants/${row._id}`)}
          className="text-[var(--color-primary)] hover:underline font-medium"
        >
          {val}
        </button>
      ),
    },
    { key: 'slug', label: 'Slug', sortable: true, render: (val) => val || '-' },
    {
      key: 'tenantNumber',
      label: 'Tenant #',
      sortable: true,
      render: (val) => (val ? `#${val}` : '-'),
    },
    {
      key: 'planType',
      label: 'Plan',
      sortable: true,
      render: (val) => <PlanBadge plan={val} />
    },
    {
      key: 'userCount',
      label: 'Users',
      sortable: false,
      render: (val) => (
        <span className="inline-flex items-center gap-1.5">
          <Users size={14} className="text-gray-400" />
          {val || 0}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (val) => formatDate(val),
    },
    {
      key: 'businessStartDate',
      label: 'Start Date',
      sortable: true,
      render: (val) => (val ? formatDate(val) : '-'),
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (val, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleMutation.mutate(row._id)
          }}
          disabled={toggleMutation.isPending}
          title={val !== false ? 'Click to deactivate' : 'Click to activate'}
          className="inline-flex items-center gap-2 disabled:opacity-50"
        >
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              val !== false ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                val !== false ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </span>
          <span className={`text-xs font-medium ${val !== false ? 'text-emerald-600' : 'text-gray-500'}`}>
            {val !== false ? 'Active' : 'Inactive'}
          </span>
        </button>
      ),
    },
  ]

  if (error) return <ErrorState message={error.message} onRetry={fetchTenants} />

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" subtitle="Manage all shops">
        <Button onClick={() => navigate('/admin/tenants/new')} icon={<Plus size={14} />}>New Tenant</Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Tenants" value={stats.totalTenants} color="blue" icon={<Building2 size={18} />} />
        <StatCard title="Active" value={stats.activeTenants} color="green" icon={<CheckCircle size={18} />} />
        <StatCard title="Inactive" value={stats.inactiveTenants} color="red" icon={<XCircle size={18} />} />
      </div>

      <div className="space-y-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, slug, email, or store name..."
          className="sm:w-96"
        />

        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={filters.isActive}
                onChange={(e) => setFilters((prev) => ({ ...prev, isActive: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Plan</label>
              <select
                value={filters.planType}
                onChange={(e) => setFilters((prev) => ({ ...prev, planType: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              >
                <option value="">All</option>
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </FilterPanel>

        <Card>
          <DataTable
            columns={columns}
            data={tenants}
            loading={loading}
            onRowClick={(row) => navigate(`/admin/tenants/${row._id}`)}
            pagination={{
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              totalPages: pagination.totalPages,
              onPageChange: handlePageChange,
              onLimitChange: handleLimitChange,
            }}
          />
        </Card>
      </div>
    </div>
  )
}
