import { useState, useEffect, useCallback } from 'react'

import toast from 'react-hot-toast'

import { Plus, Edit, TrendingUp, CircleDollarSign, LineChart } from 'lucide-react'

import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

import { getRates } from '../../services/rateService'

import PageHeader from '../../components/ui/PageHeader'

import Tabs from '../../components/ui/Tabs'

import DataTable from '../../components/ui/DataTable'

import Button from '../../components/ui/Button'

import StatCard from '../../components/ui/StatCard'

import EmptyState from '../../components/ui/EmptyState'

import ErrorState from '../../components/ui/ErrorState'

import { formatCurrency, formatDate } from '../../utils/helpers'

import RateForm from './RateForm'

const TOLA_TO_GRAM = 11.664

const RateList = () => {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('gold')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [showForm, setShowForm] = useState(false)
  const [editRate, setEditRate] = useState(null)

  const tabs = [
    { value: 'gold', label: 'Gold Rates' },
    { value: 'silver', label: 'Silver Rates' },
  ]

  const fetchRates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        metalType: activeTab,
        page: pagination.page,
        limit: pagination.limit,
      }
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate

      const res = await getRates(params)
      const data = res.data?.data || res.data?.rates || res.data || []
      setRates(Array.isArray(data) ? data : [])

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
      setError(err?.response?.data?.message || 'Failed to load rates')
      setRates([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, pagination.page, pagination.limit, startDate, endDate])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [activeTab])

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditRate(null)
    fetchRates()
  }

  const latestRate = rates.length > 0 ? rates[0] : null

  const chartData = [...rates].reverse().map((r) => ({
    date: formatDate(r.date || r.createdAt),
    rate: r.rate || 0,
  }))

  const getRatePerGram = (row) => {
    if (row.unit === 'gram') return row.rate
    return (row.rate || 0) / TOLA_TO_GRAM
  }

  const columns = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (val, row) => formatDate(val || row.createdAt),
    },
    {
      key: 'rate',
      label: 'Rate',
      sortable: true,
      render: (val, row) => formatCurrency(val),
    },
    {
      key: 'unit',
      label: 'Unit',
      sortable: false,
      render: (val) => val || 'tola',
    },
    {
      key: 'ratePerGram',
      label: 'Rate per Gram',
      sortable: false,
      render: (val, row) => formatCurrency(getRatePerGram(row)),
    },
    {
      key: '_id',
      label: 'Actions',
      sortable: false,
      render: (val, row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Edit}
            onClick={(e) => {
              e.stopPropagation()
              setEditRate(row)
              setShowForm(true)
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Gold & Silver Rates" subtitle="Manage metal rates and track trends">
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            setEditRate(null)
            setShowForm(true)
          }}
        >
          Add Rate
        </Button>
      </PageHeader>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {latestRate && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title={`Latest ${activeTab === 'gold' ? 'Gold' : 'Silver'} Rate`}
            value={formatCurrency(latestRate.rate || 0)}
            icon={<TrendingUp size={20} />}
            color={activeTab === 'gold' ? 'yellow' : 'gray'}
            subtitle={`As of ${formatDate(latestRate.date || latestRate.createdAt)}`}
          />
          <StatCard
            title="Rate per Gram"
            value={formatCurrency(getRatePerGram(latestRate))}
            icon={<CircleDollarSign size={20} />}
            color="blue"
          />
          <StatCard
            title="Unit"
            value={latestRate.unit || 'tola'}
            icon={<TrendingUp size={20} />}
            color="purple"
          />
        </div>
      )}

      {chartData.length > 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <LineChart className="h-4 w-4" />
            Rate Trend
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Rate']}
                  labelStyle={{ fontWeight: 600 }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={activeTab === 'gold' ? '#f59e0b' : '#6b7280'}
                  strokeWidth={2}
                  dot={{ r: 4, fill: activeTab === 'gold' ? '#f59e0b' : '#6b7280' }}
                  activeDot={{ r: 6 }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        {(startDate || endDate) && (
          <div className="pt-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchRates} />
      ) : (
        <DataTable
          columns={columns}
          data={rates}
          loading={loading}
          pagination={{
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
            onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })),
            onLimitChange: (l) => setPagination((prev) => ({ ...prev, limit: l, page: 1 })),
          }}
        />
      )}

      {showForm && (
        <RateForm
          rate={editRate}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setEditRate(null)
          }}
          onSuccess={handleFormSuccess}
        />
      )}

    </div>
  )
}

export default RateList
