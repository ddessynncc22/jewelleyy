import { useState, useEffect, useCallback, useMemo } from 'react'

import { useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { ExternalLink } from 'lucide-react'

import { getPendingJobs, updateMaterialStatus } from '../../services/karigarService'

import PageHeader from '../../components/ui/PageHeader'

import DataTable from '../../components/ui/DataTable'

import SearchInput from '../../components/ui/SearchInput'

import Button from '../../components/ui/Button'

import StatCard from '../../components/ui/StatCard'

import Card from '../../components/ui/Card'

import EmptyState from '../../components/ui/EmptyState'

import ErrorState from '../../components/ui/ErrorState'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import { formatCurrency, formatDate } from '../../utils/helpers'

const STATUS_OPTIONS = [
  { value: 'Issued', label: 'Issued' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
]

const STATUS_STYLES = {
  Issued: 'bg-blue-50 text-blue-700 border-blue-200',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const KarigarPendingJobs = () => {
  const navigate = useNavigate()

  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [updating, setUpdating] = useState(null)

  const fetchPendingJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getPendingJobs()
      setGroups(data?.data || data || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load pending jobs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingJobs()
  }, [fetchPendingJobs])

  const rows = useMemo(() => {
    let flat = groups.flatMap((g) =>
      (g.materials || []).map((m) => ({
        ...m,
        karigar: g.karigar,
      })),
    )
    if (statusFilter) flat = flat.filter((m) => m.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      flat = flat.filter(
        (m) =>
          m.karigar?.name?.toLowerCase().includes(q) ||
          m.itemName?.toLowerCase().includes(q) ||
          m.karigar?.phone?.toLowerCase().includes(q),
      )
    }
    return flat
  }, [groups, search, statusFilter])

  const summary = useMemo(() => {
    const totalPending = rows.length
    const totalWeight = rows.reduce((s, m) => s + Number(m.grossWeight || 0), 0)
    const inProgress = rows.filter((m) => m.status === 'In Progress').length
    return { totalPending, totalWeight, inProgress }
  }, [rows])

  const handleStatusChange = async (karigarId, materialIndex, status) => {
    setUpdating(`${karigarId}-${materialIndex}`)
    try {
      await updateMaterialStatus(karigarId, materialIndex, status)
      toast.success(`Marked as ${status}`)
      await fetchPendingJobs()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status')
    } finally {
      setUpdating(null)
    }
  }

  const columns = [
    {
      key: 'karigar',
      label: 'Karigar',
      render: (val) => (
        <div>
          <button
            onClick={() => navigate(`/karigar/${val?._id}`)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
          >
            {val?.name || '-'}
            <ExternalLink size={12} />
          </button>
          <p className="text-xs text-gray-500">{val?.phone || ''}</p>
        </div>
      ),
    },
    { key: 'itemName', label: 'Item', render: (val) => val || '-' },
    {
      key: 'date',
      label: 'Issued Date',
      render: (val) => formatDate(val),
    },
    {
      key: 'grossWeight',
      label: 'Gross Weight',
      render: (val) => (val != null && val !== '' ? `${val}g` : '-'),
    },
    {
      key: 'purity',
      label: 'Purity',
      render: (val) => (val ? `${val}%` : '-'),
    },
    {
      key: 'karat',
      label: 'Karat',
      render: (val) => (val ? `${val}K` : '-'),
    },
    {
      key: 'labourCharge',
      label: 'Labour Charge',
      render: (val) => (val ? formatCurrency(val) : '-'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => (
        <select
          value={val}
          disabled={updating === `${row.karigar?._id}-${row._index}`}
          onChange={(e) => handleStatusChange(row.karigar?._id, row._index, e.target.value)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 ${STATUS_STYLES[val] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ),
    },
  ]

  if (error) {
    return <ErrorState message={error} onRetry={fetchPendingJobs} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Jobs"
        subtitle="Materials currently out with karigars"
      >
        <Button variant="outline" onClick={() => navigate('/karigar')}>
          View Karigars
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Pending Materials" value={summary.totalPending} color="orange" />
        <StatCard title="In Progress" value={summary.inProgress} color="blue" />
        <StatCard title="Weight Outstanding" value={`${summary.totalWeight.toFixed(3)}g`} color="purple" />
      </div>

      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by karigar, item, or phone..."
              className="sm:w-80"
            />
            <div className="w-full sm:w-56">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingSkeleton count={4} type="table" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No pending jobs"
          description={
            search || statusFilter
              ? 'Try adjusting your search or filters'
              : 'No materials are currently out with karigars'
          }
        />
      ) : (
        <DataTable columns={columns} data={rows} loading={loading} />
      )}
    </div>
  )
}

export default KarigarPendingJobs
