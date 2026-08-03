import { useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import toast from 'react-hot-toast'

import { FileSpreadsheet, FileText, TrendingUp, TrendingDown, Minus, AlarmClock, Hourglass, AlertTriangle, BarChart3, Users } from 'lucide-react'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'

import { getPawnReport, exportReport } from '../../services/reportService'

import PageHeader from '../../components/ui/PageHeader'

import Card from '../../components/ui/Card'

import StatCard from '../../components/ui/StatCard'

import DataTable from '../../components/ui/DataTable'

import Button from '../../components/ui/Button'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'

import EmptyState from '../../components/ui/EmptyState'

import { formatCurrency, formatDate, formatWeight } from '../../utils/helpers'

const STATUS_COLORS = {
  Active: '#3b82f6',
  Renewed: '#f59e0b',
  Redeemed: '#10b981',
  Forfeited: '#ef4444',
  PartialRedemption: '#8b5cf6',
}

const STATUS_BADGE = {
  Active: 'bg-blue-50 text-blue-700 border-blue-200',
  Renewed: 'bg-amber-50 text-amber-700 border-amber-200',
  Redeemed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Forfeited: 'bg-red-50 text-red-700 border-red-200',
  PartialRedemption: 'bg-purple-50 text-purple-700 border-purple-200',
}

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

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
      STATUS_BADGE[status] || 'bg-gray-50 text-gray-700 border-gray-200'
    }`}
  >
    {status || '-'}
  </span>
)

const OverdueBadge = ({ days }) =>
  days > 0 ? (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        days > 90
          ? 'bg-red-100 text-red-700 border-red-200'
          : days > 60
            ? 'bg-orange-100 text-orange-700 border-orange-200'
            : days > 30
              ? 'bg-amber-100 text-amber-700 border-amber-200'
              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
      }`}
    >
      {days} days
    </span>
  ) : (
    <span className="text-xs text-gray-400">-</span>
  )

const Section = ({ title, icon: Icon, children, action }) => (
  <Card title={title} icon={Icon} actions={action}>
    {children}
  </Card>
)

const ChangePill = ({ value }) => {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus
  const color = value > 0 ? 'text-red-600 bg-red-50' : value < 0 ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-50'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      <Icon size={12} />
      {value > 0 ? '+' : ''}
      {value}%
    </span>
  )
}

const PawnReport = () => {
  const [filters, setFilters] = useState({ from: '', to: '', status: '', phone: '', karat: '', interestStatus: '' })

  const params = useMemo(() => {
    const p = {}
    if (filters.from) p.startDate = filters.from
    if (filters.to) p.endDate = filters.to
    if (filters.status) p.status = filters.status
    if (filters.phone) p.phone = filters.phone
    if (filters.karat) p.karat = filters.karat
    if (filters.interestStatus) p.interestStatus = filters.interestStatus
    return p
  }, [filters])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pawn-report', filters],
    queryFn: () => getPawnReport(params),
  })

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const clearFilters = () => setFilters({ from: '', to: '', status: '', phone: '', karat: '', interestStatus: '' })

  const handleExport = async (format) => {
    try {
      const res = await exportReport('pawn', { ...params, format })
      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      downloadBlob(blob, `pawn-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
      toast.success(`${format.toUpperCase()} exported successfully`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed')
    }
  }

  if (isLoading) return <LoadingSkeleton count={5} type="card" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const body = data?.data?.data ?? data?.data ?? {}
  const { summary = [], totals = {}, loans = [], overdue = [], dueSoon = [], aging = [], ltv = {}, topCustomers = [], rateDistribution = [], monthlyActivity = [], redemptionLog = [], renewals = {}, previousPeriod = {} } = body
  const periodInterest = body.periodInterestCollected ?? totals.totalInterestCollected ?? 0
  const projectedInterest = body.projectedInterestTotal ?? totals.totalInterestProjected ?? 0

  const statusData = summary
    .filter((s) => s.status && s.count > 0)
    .map((s) => ({ name: s.status, value: s.count, color: STATUS_COLORS[s.status] || '#9ca3af' }))

  const loanColumns = [
    { key: 'loanNumber', label: 'Loan', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    { key: 'customerName', label: 'Customer', render: (val, row) => (row.customerName ? <div><p className="text-sm text-gray-900">{row.customerName}</p><p className="text-xs text-gray-500">{row.customerPhone || ''}</p></div> : '-') },
    { key: 'itemDescription', label: 'Item', render: (val, row) => (val ? <div><p className="text-sm">{val}</p><p className="text-xs text-gray-500">{row.itemWeight != null ? formatWeight(row.itemWeight) : ''}{row.itemKarat ? ` / ${row.itemKarat}K` : ''}</p></div> : '-') },
    { key: 'loanAmount', label: 'Amount', render: fmtMoney },
    { key: 'balance', label: 'Balance', render: fmtMoney },
    { key: 'interestRate', label: 'Rate', render: (val) => (val != null ? `${val}%` : '-') },
    { key: 'interestCollected', label: 'Int. Collected', render: fmtMoney },
    { key: 'interestToAcquire', label: 'Int. To Acquire', render: fmtMoney },
    { key: 'dueDate', label: 'Due', render: fmtDate },
    { key: 'daysOverdue', label: 'Overdue', render: (val) => <OverdueBadge days={val || 0} /> },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
  ]

  const shortLoanColumns = [
    { key: 'loanNumber', label: 'Loan', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    { key: 'customerName', label: 'Customer', render: (val) => val || '-' },
    { key: 'balance', label: 'Balance', render: fmtMoney },
    { key: 'interestToAcquire', label: 'Int. To Acquire', render: fmtMoney },
    { key: 'dueDate', label: 'Due', render: fmtDate },
    { key: 'daysOverdue', label: 'Days Overdue', render: (val) => <OverdueBadge days={val || 0} /> },
  ]

  const dueSoonColumns = [
    { key: 'loanNumber', label: 'Loan', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    { key: 'customerName', label: 'Customer', render: (val) => val || '-' },
    { key: 'balance', label: 'Balance', render: fmtMoney },
    { key: 'interestToAcquire', label: 'Int. To Acquire', render: fmtMoney },
    { key: 'dueDate', label: 'Due', render: fmtDate },
    { key: 'daysToDue', label: 'Days To Due', render: (val) => (val != null ? <span className="text-xs text-gray-700">{val} days</span> : '-') },
  ]

  const agingColumns = [
    { key: 'bucket', label: 'Bucket', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    { key: 'count', label: 'Loans' },
    { key: 'totalBalance', label: 'Outstanding', render: fmtMoney },
    { key: 'totalInterestToAcquire', label: 'Int. To Acquire', render: fmtMoney },
  ]

  const topCustomerColumns = [
    { key: 'name', label: 'Customer', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    { key: 'count', label: 'Loans' },
    { key: 'totalLoanAmount', label: 'Total Loan', render: fmtMoney },
    { key: 'totalBalance', label: 'Outstanding', render: fmtMoney },
  ]

  const rateColumns = [
    { key: 'rate', label: 'Monthly Rate', render: (val) => <span className="font-medium text-gray-900">{val}%</span> },
    { key: 'count', label: 'Loans' },
    { key: 'totalBalance', label: 'Outstanding', render: fmtMoney },
  ]

  const ltvColumns = [
    { key: 'loanNumber', label: 'Loan' },
    { key: 'customerName', label: 'Customer' },
    { key: 'marketValue', label: 'Market Value', render: fmtMoney },
    { key: 'balance', label: 'Balance', render: fmtMoney },
    { key: 'ltv', label: 'LTV', render: (val) => <span className={val > 0.8 ? 'text-red-600 font-semibold' : 'text-gray-900'}>{((val || 0) * 100).toFixed(1)}%</span> },
  ]

  const redemptionColumns = [
    { key: 'loanNumber', label: 'Loan', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    { key: 'customerName', label: 'Customer' },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
    { key: 'date', label: 'Date', render: fmtDate },
    { key: 'loanAmount', label: 'Loan', render: fmtMoney },
    { key: 'interestCollected', label: 'Int. Collected', render: fmtMoney },
    { key: 'discount', label: 'Discount', render: fmtMoney },
    { key: 'itemWeight', label: 'Weight', render: (val) => (val != null ? formatWeight(val) : '-') },
    { key: 'marketValue', label: 'Market Value', render: fmtMoney },
  ]

  const summaryColumns = [
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
    { key: 'count', label: 'Loans' },
    { key: 'totalLoanAmount', label: 'Loan Amount', render: fmtMoney },
    { key: 'totalPaid', label: 'Paid', render: fmtMoney },
    { key: 'totalBalance', label: 'Balance', render: fmtMoney },
    { key: 'totalInterestCollected', label: 'Int. Collected', render: fmtMoney },
    { key: 'totalInterestToAcquire', label: 'Int. To Acquire', render: fmtMoney },
  ]

  const compare = previousPeriod.change || {}

  return (
    <div className="space-y-6">
      <PageHeader title="Bandaki Report" subtitle="Pawn lending summary with interest and risk breakdown">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">All</option>
              {Object.keys(STATUS_COLORS).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
            <input type="text" value={filters.phone} onChange={(e) => setFilter('phone', e.target.value)} placeholder="Customer phone" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Karat</label>
            <input type="number" value={filters.karat} onChange={(e) => setFilter('karat', e.target.value)} placeholder="e.g. 22" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Interest</label>
            <select value={filters.interestStatus} onChange={(e) => setFilter('interestStatus', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">All</option>
              <option value="paid">Interest Paid</option>
              <option value="unpaid">Interest Unpaid</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Loans" value={totals.totalLoans ?? 0} color="blue" />
        <StatCard title="Total Loan Amount" value={fmtMoney(totals.totalLoanAmount)} color="purple" />
        <StatCard title="Principal Outstanding" value={fmtMoney(totals.totalBalance)} color="orange" />
        <StatCard title="Interest Collected (Period)" value={fmtMoney(periodInterest)} color="green" />
        <StatCard title="Interest To be Acquired" value={fmtMoney(totals.totalInterestToAcquire)} color="yellow" />
        <StatCard title="Projected Interest at Maturity" value={fmtMoney(projectedInterest)} color="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Status Distribution" icon={TrendingUp}>
          {statusData.length === 0 ? (
            <EmptyState title="No data" description="No loans match the current filters" />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="h-56 w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Loans']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-1.5">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-semibold text-gray-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Lending Activity by Month" icon={BarChart3}>
          {monthlyActivity.length === 0 ? (
            <EmptyState title="No data" description="No loans in the selected period" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyActivity} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="issued" name="Issued" fill="#3b82f6" />
                  <Bar dataKey="redeemed" name="Redeemed" fill="#10b981" />
                  <Bar dataKey="forfeited" name="Forfeited" fill="#ef4444" />
                  <Bar dataKey="renewed" name="Renewed" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      </div>

      {Object.keys(compare).length > 0 && (
        <Section title="Period Comparison" icon={TrendingUp} action={<span className="text-xs text-gray-400">Current vs previous period</span>}>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Loans', cur: compare.totalLoans, val: previousPeriod.current?.totalLoans, prev: previousPeriod.previous?.totalLoans },
              { label: 'Loan Amount', cur: compare.totalLoanAmount, val: previousPeriod.current?.totalLoanAmount, prev: previousPeriod.previous?.totalLoanAmount },
              { label: 'Principal Paid', cur: compare.totalPaid, val: previousPeriod.current?.totalPaid, prev: previousPeriod.previous?.totalPaid },
              { label: 'Outstanding', cur: compare.totalBalance, val: previousPeriod.current?.totalBalance, prev: previousPeriod.previous?.totalBalance },
              { label: 'Interest Collected', cur: compare.totalInterestCollected, val: previousPeriod.current?.totalInterestCollected, prev: previousPeriod.previous?.totalInterestCollected },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <p className="text-xs font-medium text-gray-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{item.label === 'Loans' ? item.val ?? 0 : fmtMoney(item.val)}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <ChangePill value={item.cur} />
                  <span className="text-[10px] text-gray-400">prev {item.label === 'Loans' ? item.prev ?? 0 : fmtMoney(item.prev)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Overdue Loans" icon={AlarmClock} action={<span className="text-xs text-red-500">{overdue.length} overdue</span>}>
          {overdue.length === 0 ? <EmptyState title="No overdue loans" /> : <DataTable columns={shortLoanColumns} data={overdue} />}
        </Section>
        <Section title="Due Within 7 Days" icon={Hourglass} action={<span className="text-xs text-amber-500">{dueSoon.length} due soon</span>}>
          {dueSoon.length === 0 ? <EmptyState title="Nothing due soon" /> : <DataTable columns={dueSoonColumns} data={dueSoon} />}
        </Section>
      </div>

      <Section title="Collection Aging" icon={AlertTriangle}>
        {aging.every((a) => a.count === 0) ? <EmptyState title="No overdue loans" /> : <DataTable columns={agingColumns} data={aging} />}
      </Section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Avg LTV" value={ltv.loansWithValuation ? `${((ltv.avgLtv || 0) * 100).toFixed(1)}%` : '-'} color="blue" subtitle={`${ltv.loansWithValuation ?? 0} loans with valuation`} />
        <StatCard title="High Risk (LTV > 80%)" value={ltv.riskyCount ?? 0} color="red" />
        <StatCard title="Collateral Market Value" value={fmtMoney(ltv.totalMarketValue)} color="green" />
        <StatCard title="Renewals (Period)" value={renewals.count ?? 0} color="purple" subtitle={`Extra interest ${fmtMoney(renewals.extraInterest)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Loan-to-Value Details" icon={TrendingUp}>
          {ltv.loans?.length ? <DataTable columns={ltvColumns} data={ltv.loans} /> : <EmptyState title="No valued loans" />}
        </Section>
        <Section title="Top Customers by Exposure" icon={Users}>
          {topCustomers.length === 0 ? <EmptyState title="No active loans" /> : <DataTable columns={topCustomerColumns} data={topCustomers} />}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Interest Rate Distribution" icon={TrendingUp}>
          {rateDistribution.length === 0 ? <EmptyState title="No active loans" /> : <DataTable columns={rateColumns} data={rateDistribution} />}
        </Section>
        <Section title="Summary by Status" icon={TrendingUp}>
          {summary.length === 0 ? <EmptyState title="No loans" /> : <DataTable columns={summaryColumns} data={summary} />}
        </Section>
      </div>

      <Section title="Redemptions & Forfeitures" icon={TrendingUp}>
        {redemptionLog.length === 0 ? <EmptyState title="No redemptions or forfeitures in period" /> : <DataTable columns={redemptionColumns} data={redemptionLog} />}
      </Section>

      <Section title="Loan Details" icon={TrendingUp}>
        {loans.length === 0 ? <EmptyState title="No loans match the current filters" /> : <DataTable columns={loanColumns} data={loans} />}
      </Section>
    </div>
  )
}

export default PawnReport
