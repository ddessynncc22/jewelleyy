import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileSpreadsheet, FileText, Receipt, Percent, Gem, Banknote, Wallet, TrendingUp, ShoppingBag } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { getTaxReport, exportReport } from '../../services/reportService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import DataTable from '../../components/ui/DataTable'
import Button from '../../components/ui/Button'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import { formatCurrency, formatDate } from '../../utils/helpers'

const PAYMENT_LABELS = {
  cash: 'Cash',
  khaata: 'Khaata',
  partial: 'Partial',
  oldGoldExchange: 'Old Gold Exchange',
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

const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'

export default function TaxReport() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ from: '', to: '', paymentType: '' })

  const params = useMemo(() => {
    const p = {}
    if (filters.from) p.startDate = filters.from
    if (filters.to) p.endDate = filters.to
    if (filters.paymentType) p.paymentType = filters.paymentType
    return p
  }, [filters])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tax-report', filters],
    queryFn: () => getTaxReport(params),
  })

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleExport = async (format) => {
    try {
      const res = await exportReport('tax', { ...params, format })
      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      downloadBlob(blob, `tax-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
      toast.success(`${format.toUpperCase()} exported successfully`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed')
    }
  }

  if (isLoading) return <LoadingSkeleton count={5} type="card" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const body = data?.data?.data ?? data?.data ?? {}
  const summary = body.summary || {}
  const breakdown = body.taxTypeBreakdown || []
  const monthly = body.monthly || []
  const byPaymentType = body.byPaymentType || []
  const sales = body.sales || []
  const taxableBase = Number(summary.serviceFeeBase || 0) + Number(summary.vatBase || 0)

  const saleColumns = [
    { key: 'saleNumber', label: 'Sale', render: (v) => <span className="font-medium text-[var(--color-text)]">{v || '-'}</span> },
    { key: 'saleDate', label: 'Date', render: fmtDate },
    { key: 'customerName', label: 'Customer', render: (v) => v || '-' },
    { key: 'paymentType', label: 'Payment', render: (v) => PAYMENT_LABELS[v] || v || '-' },
    { key: 'revenue', label: 'Revenue', render: fmtMoney },
    { key: 'discount', label: 'Discount', render: fmtMoney },
    {
      key: 'serviceFee',
      label: 'Service Fee',
      render: (v) => (v > 0 ? <span className="font-medium text-amber-600">{fmtMoney(v)}</span> : <span className="text-gray-300">-</span>),
    },
    {
      key: 'diamondVat',
      label: 'VAT (Diamond)',
      render: (v) => (v > 0 ? <span className="font-medium text-cyan-600">{fmtMoney(v)}</span> : <span className="text-gray-300">-</span>),
    },
    { key: 'totalTax', label: 'Total Tax', render: (v) => <span className="font-semibold text-[var(--color-text)]">{fmtMoney(v)}</span> },
    { key: 'grandTotal', label: 'Grand Total', render: fmtMoney },
  ]

  const payColumns = [
    { key: 'paymentType', label: 'Payment Type', render: (v) => <span className="font-medium text-[var(--color-text)] capitalize">{PAYMENT_LABELS[v] || v}</span> },
    { key: 'count', label: 'Sales' },
    { key: 'revenue', label: 'Revenue', render: fmtMoney },
    { key: 'serviceFee', label: 'Service Fee', render: fmtMoney },
    { key: 'diamondVat', label: 'VAT (Diamond)', render: fmtMoney },
    { key: 'totalTax', label: 'Total Tax', render: (v) => <span className="font-semibold text-[var(--color-text)]">{fmtMoney(v)}</span> },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Tax Report" subtitle="Tax collected on sales, broken down by rate and period">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')} icon={<FileSpreadsheet size={14} />}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} icon={<FileText size={14} />}>
            PDF
          </Button>
        </div>
      </PageHeader>

      <Card title="Filters" icon={<Wallet size={16} />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Type</label>
            <select value={filters.paymentType} onChange={(e) => setFilter('paymentType', e.target.value)} className={inputClass}>
              <option value="">All</option>
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => setFilters({ from: '', to: '', paymentType: '' })}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Tax Collected" value={fmtMoney(summary.totalTax)} icon={Receipt} color="gold" subtitle={`${summary.totalSales || 0} sales`} />
        <StatCard title="Service Fee (0.5%)" value={fmtMoney(summary.serviceFee)} icon={Percent} color="yellow" subtitle={`Base ${fmtMoney(summary.serviceFeeBase)}`} />
        <StatCard title="VAT (Diamond) 13%" value={fmtMoney(summary.diamondVat)} icon={Gem} color="cyan" subtitle={`Base ${fmtMoney(summary.vatBase)}`} />
        <StatCard title="Taxable Sales" value={fmtMoney(taxableBase)} icon={Banknote} color="blue" subtitle="Sum of tax bases" />
        <StatCard title="Avg Tax / Sale" value={fmtMoney(summary.avgTaxPerSale)} icon={ShoppingBag} color="green" subtitle="Per transaction" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {breakdown.map((t) => {
          const share = summary.totalTax > 0 ? (t.amount / summary.totalTax) * 100 : 0
          const isService = t.type === 'serviceFee'
          return (
            <Card key={t.type} title={t.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${isService ? 'bg-amber-50 text-amber-600' : 'bg-cyan-50 text-cyan-600'}`}>
                      Rate {t.rate}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{t.count} sale(s)</span>
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--color-text)]">{fmtMoney(t.amount)}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Taxable base {fmtMoney(t.taxableBase)}</p>
                </div>
                <div className="shrink-0 rounded-xl px-3 py-2 text-right">
                  <p className={`text-xl font-bold ${isService ? 'text-amber-600' : 'text-cyan-600'}`}>{share.toFixed(1)}%</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">of total tax</p>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${isService ? 'bg-amber-400' : 'bg-cyan-400'}`} style={{ width: `${share}%` }} />
              </div>
            </Card>
          )
        })}
      </div>

      <Card title="Monthly Tax Trend" icon={TrendingUp} actions={<span className="text-xs text-gray-400">Stacked by tax type</span>}>
        {monthly.length === 0 ? (
          <EmptyState title="No data" description="No taxable sales in the selected period" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => fmtMoney(value)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="serviceFee" name="Service Fee (0.5%)" stackId="tax" fill="#f59e0b" />
                <Bar dataKey="diamondVat" name="VAT (Diamond) 13%" stackId="tax" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Tax by Payment Type" icon={Wallet}>
        {byPaymentType.length === 0 ? (
          <EmptyState title="No data" />
        ) : (
          <DataTable columns={payColumns} data={byPaymentType} loading={false} />
        )}
      </Card>

      <Card title="Sales Detail" icon={Receipt} actions={<span className="text-xs text-gray-400">{sales.length} sales</span>}>
        {sales.length === 0 ? (
          <EmptyState title="No sales" description="No sales found in the selected period" />
        ) : (
          <DataTable
            columns={saleColumns}
            data={sales}
            loading={false}
            onRowClick={(row) => row._id && navigate(`/pos/sales/${row._id}`)}
          />
        )}
      </Card>
    </div>
  )
}
