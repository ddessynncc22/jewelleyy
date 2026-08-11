import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Eye, Trash2, Truck, User, Gem, AlertTriangle, Scale, FlaskConical,
  ChevronDown, ChevronRight, Search, Calendar, X, RotateCcw,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { getPurchases, deletePurchase, getPurchaseSummary } from '../../services/purchaseService'
import { formatDate, formatCurrency, formatWeightTolaLaal } from '../../utils/helpers'

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'pos_exchange', label: 'POS Exchange' },
]

const TYPE_BADGE = {
  supplier: 'bg-[var(--color-gold-100)] text-[var(--color-gold-800)]',
  customer: 'bg-violet-100 text-violet-700',
  pos_exchange: 'bg-cyan-100 text-cyan-700',
}

const PAYMENT_BADGE = {
  paid: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  partial: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
  credit: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
}

const REFINE_BADGE = {
  none: 'bg-[var(--color-ink-100)] text-[var(--color-ink-500)]',
  pending: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
  refined: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
}

// A supplier purchase is always refined bars; a customer purchase is refined
// once its items come back from the refinery.
const refineStatusFor = (row) => {
  if (row.type === 'supplier') return 'refined'
  const items = row.items || []
  if (items.some((it) => it.refineStatus === 'refined')) return 'refined'
  if (items.some((it) => it.refineStatus === 'pending')) return 'pending'
  return 'none'
}

const FilterInput = ({ icon, children, className = '' }) => (
  <div className={`relative ${className}`}>
    {icon && (
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]">
        {icon}
      </span>
    )}
    {children}
  </div>
)

const PurchaseList = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [summary, setSummary] = useState(null)
  const [posOpen, setPosOpen] = useState(true)

  const fetchSummary = useCallback(async () => {
    try {
      const res = await getPurchaseSummary({ startDate, endDate })
      setSummary(res.data?.data || null)
    } catch { setSummary(null) }
  }, [startDate, endDate])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPurchases({ page, limit, type, search, startDate, endDate })
      const data = res.data?.data || []
      setRows(Array.isArray(data) ? data : [])
      setTotal(res.data?.pagination?.total || 0)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, limit, type, search, startDate, endDate])

  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  const handleDelete = async () => {
    try {
      await deletePurchase(deleting._id)
      toast.success('Purchase deleted')
      setDeleting(null)
      fetchRows()
      fetchSummary()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete purchase')
      setDeleting(null)
    }
  }

  const hasFilters = search || startDate || endDate || type
  const clearFilters = () => {
    setType('')
    setSearch('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const s = summary || {}
  const refinedStock = s.refinedStock || {}
  const runsOut = refinedStock.balanceG != null && refinedStock.balanceG <= 0

  const tabCount = (key) => {
    const k = key === 'pos_exchange' ? 'pos' : key
    const c = s[k]?.count
    return typeof c === 'number' ? c : null
  }

  const columns = [
    { key: 'purchaseNumber', label: 'No.', render: (val) => <span className="font-semibold text-[var(--color-text)]">{val}</span> },
    { key: 'date', label: 'Date', render: (val) => <span className="text-[var(--color-text-secondary)]">{formatDate(val)}</span> },
    { key: 'type', label: 'Type', render: (val) => (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${TYPE_BADGE[val] || 'bg-[var(--color-ink-100)] text-[var(--color-ink-500)]'}`}>
        {val === 'supplier' ? <Truck size={11} /> : val === 'pos_exchange' ? <Gem size={11} /> : <User size={11} />}
        {val === 'pos_exchange' ? 'POS Exchange' : val === 'supplier' ? 'Supplier' : 'Customer'}
      </span>
    ) },
    { key: 'partyName', label: 'Party', render: (val) => val ? <span className="font-medium text-[var(--color-text)]">{val}</span> : <span className="text-[var(--color-ink-400)]">—</span> },
    { key: 'saleRef', label: 'Sale', render: (val) => (val ? (
      <a
        href={`#/pos/sales/${val._id}`}
        onClick={(e) => { e.stopPropagation(); navigate(`/pos/sales/${val._id}`) }}
        className="font-medium text-[var(--color-gold-700)] hover:underline"
        title={`View sale ${val.saleNumber}`}
      >
        {val.saleNumber || '—'}
      </a>
    ) : <span className="text-[var(--color-ink-400)]">—</span> ) },
    { key: 'totals', label: 'Gross Weight', render: (v) => v
      ? <span className="num">{v.grossWeightG} <span className="text-[var(--color-ink-400)]">g · {formatWeightTolaLaal(v.grossWeightG)}</span></span>
      : <span className="text-[var(--color-ink-400)]">—</span> },
    { key: 'totals', label: 'Total Value', render: (v) => v
      ? <span className="num font-medium text-[var(--color-text)]">{formatCurrency(v.totalValue)}</span>
      : <span className="text-[var(--color-ink-400)]">—</span> },
    { key: 'refineStatus', label: 'Refine', render: (_, row) => {
      const st = refineStatusFor(row)
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${REFINE_BADGE[st]}`}>
          <FlaskConical size={11} /> {st === 'refined' ? 'Refined' : st === 'pending' ? 'At Refinery' : 'Not Refined'}
        </span>
      )
    } },
    { key: 'paymentStatus', label: 'Payment', render: (val) => (
      <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full capitalize ${PAYMENT_BADGE[val] || 'bg-[var(--color-ink-100)] text-[var(--color-ink-500)]'}`}>{val}</span>
    ) },
    { key: '_id', label: '', render: (_, row) => (
      <div className="flex justify-end gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${row._id}`) }}
          className="p-2 rounded-lg text-[var(--color-ink-500)] hover:bg-[var(--color-gold-50)] hover:text-[var(--color-gold-700)] transition-colors"
          title="View"
        >
          <Eye size={15} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setDeleting(row) }}
          className="p-2 rounded-lg text-[var(--color-ink-500)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    ) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Purchases" subtitle="Gold bought from suppliers and customers — every purchase locks its own rate snapshot">
        <Button icon={<Plus size={16} />} onClick={() => navigate('/purchases/new')}>
          New Purchase
        </Button>
      </PageHeader>

      {runsOut && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-4 py-3.5 text-sm text-[var(--color-danger)]">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span><strong>Refined gold stock is empty.</strong> Custom orders cannot be issued until you record a purchase or receive refined gold from the refinery.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Supplier Gold (Period)" value={s.supplier ? `${s.supplier.grossWeightG || 0} g` : '-'} subtitle={s.supplier ? `${s.supplier.count || 0} purchase(s) • ${formatCurrency(s.supplier.totalValue || 0)}` : 'Loading...'} icon={<Truck size={22} />} color="gold" />
        <StatCard title="Customer Gold (Period)" value={s.customer ? `${s.customer.grossWeightG || 0} g` : '-'} subtitle={s.customer ? `${s.customer.count || 0} purchase(s) • ${formatCurrency(s.customer.totalValue || 0)}` : 'Loading...'} icon={<User size={22} />} color="purple" />
        <StatCard title="POS Old Gold Exchange" value={s.pos ? `${s.pos.grossWeightG || 0} g` : '-'} subtitle={s.pos ? `${s.pos.count || 0} sale(s) • ${formatCurrency(s.pos.value || 0)}` : 'Loading...'} icon={<Gem size={22} />} color="cyan" />
        <StatCard
          title="Refined Gold in Stock"
          value={refinedStock.balanceG != null ? `${refinedStock.balanceG} g` : '-'}
          subtitle={refinedStock.receivedInPeriodG != null ? `${refinedStock.receivedInPeriodG} g received in period` : ''}
          icon={<Scale size={22} />}
          color={runsOut ? 'red' : 'green'}
        />
      </div>

      {s.pos && (s.pos.sales || []).length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sm)] overflow-hidden">
          <button
            onClick={() => setPosOpen(!posOpen)}
            className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-elevated)]/60 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                <Gem size={16} />
              </span>
              POS Old Gold Exchange — Sale-wise Breakdown
            </span>
            {posOpen ? <ChevronDown size={16} className="text-[var(--color-ink-400)]" /> : <ChevronRight size={16} className="text-[var(--color-ink-400)]" />}
          </button>
          {posOpen && (
            <div className="overflow-x-auto border-t border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-primary-bg)]/60 text-left text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                    <th className="px-5 py-3 font-semibold">Sale No.</th>
                    <th className="px-5 py-3 text-right font-semibold">Weight Given (g)</th>
                    <th className="px-5 py-3 text-right font-semibold">Net (g)</th>
                    <th className="px-5 py-3 text-right font-semibold">Value Given</th>
                    <th className="px-5 py-3 text-right font-semibold">Deducted</th>
                  </tr>
                </thead>
                <tbody>
                  {(s.pos.sales || []).map((sale) => (
                    <tr key={sale._id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-ink-50)] cursor-pointer transition-colors" onClick={() => navigate(`/pos/sales/${sale._id}`)}>
                      <td className="px-5 py-3 font-medium text-[var(--color-gold-700)]">{sale.saleNumber}</td>
                      <td className="px-5 py-3 text-right num">{sale.grossWeightG} g</td>
                      <td className="px-5 py-3 text-right num">{sale.netWeightG} g</td>
                      <td className="px-5 py-3 text-right num">{formatCurrency(sale.value)}</td>
                      <td className="px-5 py-3 text-right num">{formatCurrency(sale.deductibleAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sm)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_TABS.map((t) => {
            const active = type === t.value
            const count = t.value === '' ? null : tabCount(t.value)
            return (
              <button
                key={t.value}
                onClick={() => { setType(t.value); setPage(1) }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl transition-all duration-150 ${
                  active
                    ? 'bg-[var(--color-gold-600)] text-white shadow-sm'
                    : 'text-[var(--color-ink-500)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]'
                }`}
              >
                {t.label}
                {count != null && (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${active ? 'bg-white/20 text-white' : 'bg-[var(--color-elevated)] text-[var(--color-ink-500)]'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">Search</label>
            <FilterInput icon={<Search size={14} />}>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Number / party / VAT no."
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-8 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-ink-400)] transition-all focus:outline-none focus:border-[var(--color-gold-500)] focus:ring-2 focus:ring-[var(--color-gold-500)]/20"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setPage(1) }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--color-ink-400)] hover:text-[var(--color-text)]"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </FilterInput>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">From</label>
              <FilterInput icon={<Calendar size={14} />}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-3 py-2.5 text-sm text-[var(--color-text)] transition-all focus:outline-none focus:border-[var(--color-gold-500)] focus:ring-2 focus:ring-[var(--color-gold-500)]/20"
                />
              </FilterInput>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">To</label>
              <FilterInput icon={<Calendar size={14} />}>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-3 py-2.5 text-sm text-[var(--color-text)] transition-all focus:outline-none focus:border-[var(--color-gold-500)] focus:ring-2 focus:ring-[var(--color-gold-500)]/20"
                />
              </FilterInput>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={clearFilters} className="mb-0.5">
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-ink-500)]">
          <span className="font-semibold text-[var(--color-text)]">{total}</span> purchase(s) in this view
          {s.totals?.grossWeightG != null && (
            <> • <span className="num">{formatWeightTolaLaal(s.totals.grossWeightG)}</span> total gold • <span className="num">{formatCurrency(s.totals.totalValue || 0)}</span></>
          )}
        </p>
      </div>

      {rows.length === 0 && !loading ? (
        <EmptyState icon={<Truck size={32} />} title="No purchases yet" description="Record your first purchase to lock today's rate into it" />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          pagination={{ page, limit, total, onPageChange: setPage, onLimitChange: setLimit }}
          onRowClick={(row) => navigate(`/purchases/${row._id}`)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete purchase?"
        message={`This deletes ${deleting?.purchaseNumber}. Refined gold it added to stock is reversed. Purchases with refine entries cannot be deleted.`}
        confirmText="Delete"
      />
    </div>
  )
}

export default PurchaseList
