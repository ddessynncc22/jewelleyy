import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileSpreadsheet, FileText, TrendingUp, TrendingDown, Minus, Receipt, Wallet, Coins, HandCoins, Banknote, PieChart } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { getProfitSummary, exportReport } from '../../services/reportService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import DataTable from '../../components/ui/DataTable'
import Button from '../../components/ui/Button'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import { formatCurrency, formatDate } from '../../utils/helpers'

const fmtMoney = (v) => formatCurrency(v || 0)
const fmtDate = (d) => formatDate(d)

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const Section = ({ title, icon: Icon, children, action }) => (
  <Card title={title} icon={Icon} actions={action}>
    {children}
  </Card>
)

const MarginPill = ({ value }) => {
  const v = Number(value || 0)
  const positive = v >= 0
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${positive ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {v.toFixed(1)}%
    </span>
  )
}

const ChangePill = ({ value }) => {
  const v = Number(value || 0)
  const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus
  const color = v > 0 ? 'text-emerald-600 bg-emerald-50' : v < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      <Icon size={12} />
      {v > 0 ? '+' : ''}
      {v}%
    </span>
  )
}

export default function ProfitSummaryReport() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ from: '', to: '' })

  const params = useMemo(() => {
    const p = {}
    if (filters.from) p.startDate = filters.from
    if (filters.to) p.endDate = filters.to
    return p
  }, [filters])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['profit-summary', filters],
    queryFn: () => getProfitSummary(params),
  })

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleExport = async (format) => {
    try {
      const res = await exportReport('profit-summary', { ...params, format })
      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      downloadBlob(blob, `profit-summary-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
      toast.success(`${format.toUpperCase()} exported successfully`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed')
    }
  }

  if (isLoading) return <LoadingSkeleton count={5} type="card" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const body = data?.data?.data ?? data?.data ?? {}
  const summary = body.summary || {}
  const profitMargin = body.profitMargin ?? 0
  const monthly = body.monthly || []
  const byCategory = body.byCategory || []
  const topProducts = body.topProducts || []
  const sales = body.sales || []
  const compare = body.periodComparison || {}

  const saleColumns = [
    { key: 'saleNumber', label: 'Sale', render: (val) => <span className="font-medium text-gray-900">{val || '-'}</span> },
    { key: 'saleDate', label: 'Date', render: fmtDate },
    { key: 'customerName', label: 'Customer', render: (val) => val || '-' },
    { key: 'paymentType', label: 'Payment', render: (val) => (val ? val.charAt(0).toUpperCase() + val.slice(1) : '-') },
    { key: 'itemCount', label: 'Items' },
    { key: 'totalAmount', label: 'Revenue', render: fmtMoney },
    { key: 'cost', label: 'Cost', render: fmtMoney },
    { key: 'profit', label: 'Profit', render: fmtMoney },
    { key: 'margin', label: 'Margin', render: (val) => <MarginPill value={val} /> },
    { key: 'balance', label: 'Outstanding', render: fmtMoney },
  ]

  const categoryColumns = [
    { key: 'category', label: 'Category', render: (val) => <span className="font-medium text-gray-900">{val.charAt(0).toUpperCase() + val.slice(1)}</span> },
    { key: 'count', label: 'Qty' },
    { key: 'revenue', label: 'Revenue', render: fmtMoney },
    { key: 'cost', label: 'Cost', render: fmtMoney },
    { key: 'profit', label: 'Profit', render: fmtMoney },
    { key: 'profitMargin', label: 'Margin', render: (val) => <MarginPill value={val} /> },
  ]
  const categoryRows = byCategory.map((c) => ({ ...c, profitMargin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0 }))

  const productColumns = [
    { key: 'SKU', label: 'SKU', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    { key: 'itemName', label: 'Item', render: (val) => val || '-' },
    { key: 'quantity', label: 'Qty Sold' },
    { key: 'revenue', label: 'Revenue', render: fmtMoney },
    { key: 'cost', label: 'Cost', render: fmtMoney },
    { key: 'profit', label: 'Profit', render: fmtMoney },
  ]

  const change = compare.change || {}

  return (
    <div className="space-y-6">
      <PageHeader title="Profit Summary" subtitle="Revenue, cost and profit from sales">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')} icon={<FileSpreadsheet size={14} />}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} icon={<FileText size={14} />}>
            PDF
          </Button>
        </div>
      </PageHeader>

      <Card title="Filters">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => setFilters({ from: '', to: '' })}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Total Sales" value={summary.totalSales ?? 0} icon={Receipt} color="blue" />
        <StatCard title="Revenue" value={fmtMoney(summary.totalRevenue)} icon={Banknote} color="green" />
        <StatCard title="Cost of Goods" value={fmtMoney(summary.totalCost)} icon={Wallet} color="purple" />
        <StatCard title="Gross Profit" value={fmtMoney(summary.totalProfit)} icon={TrendingUp} color="gold" />
        <StatCard title="Profit Margin" value={`${profitMargin}%`} icon={PieChart} color="cyan" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Cash Collected" value={fmtMoney(summary.cashCollected)} icon={Coins} color="green" />
        <StatCard title="Khaata" value={fmtMoney(summary.khaata)} icon={HandCoins} color="orange" />
        <StatCard title="Old Gold Exchange" value={fmtMoney(summary.oldGold)} icon={Coins} color="purple" />
        <StatCard title="Outstanding" value={fmtMoney(summary.totalOutstanding)} icon={Wallet} color="red" />
      </div>

      {compare.current && (
        <Section title="Period Comparison" icon={TrendingUp} action={<span className="text-xs text-gray-400">Current vs previous period</span>}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Sales', val: compare.current.totalSales, prev: compare.previous.totalSales, cur: change.totalSales },
              { label: 'Revenue', val: compare.current.totalRevenue, prev: compare.previous.totalRevenue, cur: change.totalRevenue },
              { label: 'Cost', val: compare.current.totalCost, prev: compare.previous.totalCost, cur: change.totalCost },
              { label: 'Profit', val: compare.current.totalProfit, prev: compare.previous.totalProfit, cur: change.totalProfit },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <p className="text-xs font-medium text-gray-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{item.label === 'Sales' ? item.val ?? 0 : fmtMoney(item.val)}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <ChangePill value={item.cur} />
                  <span className="text-[10px] text-gray-400">prev {item.label === 'Sales' ? item.prev ?? 0 : fmtMoney(item.prev)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Monthly Trend" icon={TrendingUp}>
        {monthly.length === 0 ? (
          <EmptyState title="No data" description="No sales in the selected period" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" />
                <Bar dataKey="profit" name="Profit" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Profit by Category" icon={TrendingUp}>
          {categoryRows.length === 0 ? <EmptyState title="No data" /> : <DataTable columns={categoryColumns} data={categoryRows} />}
        </Section>
        <Section title="Top Products" icon={TrendingUp}>
          {topProducts.length === 0 ? <EmptyState title="No sales" /> : <DataTable columns={productColumns} data={topProducts} />}
        </Section>
      </div>

      <Section title="Sales Breakdown" icon={Receipt} action={<span className="text-xs text-gray-400">{sales.length} sales</span>}>
        {sales.length === 0 ? <EmptyState title="No sales" /> : (
          <DataTable
            columns={saleColumns}
            data={sales}
            onRowClick={(row) => row._id && navigate(`/pos/sales/${row._id}`)}
          />
        )}
      </Section>
    </div>
  )
}
