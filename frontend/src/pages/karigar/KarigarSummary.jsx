import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getKarigarSummary } from '../../services/karigarService'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import DataTable from '../../components/ui/DataTable'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import { formatCurrency } from '../../utils/helpers'

const METAL_STYLES = {
  gold: 'bg-amber-50 text-amber-700 border-amber-200',
  silver: 'bg-gray-100 text-gray-700 border-gray-200',
  diamond: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  gemstone: 'bg-purple-50 text-purple-700 border-purple-200',
}

const METAL_LABELS = { gold: 'Gold', silver: 'Silver', diamond: 'Diamond', gemstone: 'Gemstone' }

const KarigarSummary = () => {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getKarigarSummary()
      setData(res.data?.data || res)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load karigar summary')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (loading) return <LoadingSkeleton count={4} type="card" />

  if (error) return <ErrorState message={error} onRetry={fetchSummary} />

  if (!data) return null

  const { rows = [], totals = {} } = data

  const columns = [
    {
      key: 'name',
      label: 'Karigar',
      render: (val, row) => (
        <div>
          <span className="font-medium text-gray-900">{row.name}</span>
          {row.specialization && (
            <span className="block text-xs text-gray-400">{row.specialization}</span>
          )}
        </div>
      ),
    },
    {
      key: 'pendingJobs',
      label: 'Pending Jobs',
      render: (val) => (val ?? 0),
    },
    {
      key: 'outstandingWeight',
      label: 'Outstanding Weight',
      render: (val, row) => (
        <div>
          <span className={`font-medium ${Number(val) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {Number(val || 0).toFixed(3)}g
          </span>
          <span className="block text-[11px] text-gray-400">
            {Object.entries(row.outstandingByMetal || {})
              .filter(([, w]) => Number(w) > 0)
              .map(([m, w]) => `${METAL_LABELS[m] || m}: ${Number(w).toFixed(2)}g`)
              .join(' · ') || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'totalIssued',
      label: 'Total Issued',
      render: (val) => `${val ?? 0}g`,
    },
    {
      key: 'totalReturned',
      label: 'Total Returned',
      render: (val) => `${val ?? 0}g`,
    },
    {
      key: 'pendingPayment',
      label: 'Pending Payment',
      render: (val) => (
        <span className={`font-medium ${Number(val) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {formatCurrency(val || 0)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Karigar Summary</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All karigars — outstanding holdings, pending jobs and unpaid balances
          </p>
        </div>
        <button
          onClick={() => navigate('/karigar')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Karigars
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Karigars" value={totals.totalKarigars ?? 0} />
        <StatCard label="Total Outstanding (holding)" value={`${Number(totals.outstandingWeight || 0).toFixed(3)}g`} color="yellow" />
        <StatCard label="Total Pending Jobs" value={totals.pendingJobs ?? 0} />
        <StatCard label="Total Pending Payment" value={formatCurrency(totals.pendingPayment || 0)} />
      </div>

      <Card title="Outstanding by Metal">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(totals.outstandingByMetal || {}).map(([metal, weight]) => (
            <div key={metal} className={`rounded-xl border px-4 py-3 ${METAL_STYLES[metal] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">
                {METAL_LABELS[metal] || metal}
              </p>
              <p className="text-xl font-bold mt-0.5">{Number(weight || 0).toFixed(3)}g</p>
            </div>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No karigars" description="Add karigars to see the summary here" />
      ) : (
        <DataTable columns={columns} data={rows} onRowClick={(row) => navigate(`/karigar/${row._id}`)} />
      )}
    </div>
  )
}

export default KarigarSummary
