import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Eye, Trash2, Truck, User, Gem, AlertTriangle, Scale, FlaskConical, ChevronDown, ChevronRight } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import FormInput from '../../components/ui/FormInput'
import { getPurchases, deletePurchase, getPurchaseSummary } from '../../services/purchaseService'
import { formatDate, formatCurrency, formatWeightTolaLaal } from '../../utils/helpers'

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'pos_exchange', label: 'POS Exchange' },
]

const PAYMENT_BADGE = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  credit: 'bg-red-100 text-red-700',
}

const REFINE_BADGE = {
  none: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-100 text-amber-700',
  refined: 'bg-green-100 text-green-700',
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

  const s = summary || {}
  const refinedStock = s.refinedStock || {}
  const runsOut = refinedStock.balanceG != null && refinedStock.balanceG <= 0

  const columns = [
    { key: 'purchaseNumber', label: 'No.', render: (val) => <span className="font-semibold text-gray-900">{val}</span> },
    { key: 'date', label: 'Date', render: (val) => formatDate(val) },
    { key: 'type', label: 'Type', render: (val) => {
      if (val === 'supplier') return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          <Truck size={11} /> Supplier
        </span>
      )
      if (val === 'pos_exchange') return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
          <Gem size={11} /> POS Exchange
        </span>
      )
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
          <User size={11} /> Customer
        </span>
      )
    } },
    { key: 'partyName', label: 'Party', render: (val) => val || '-' },
    { key: 'saleRef', label: 'Sale', render: (val) => (val ? (
      <a
        href={`#/pos/sales/${val._id}`}
        onClick={(e) => { e.stopPropagation(); navigate(`/pos/sales/${val._id}`) }}
        className="font-medium text-blue-600 hover:underline"
        title={`View sale ${val.saleNumber}`}
      >
        {val.saleNumber || '-'}
      </a>
    ) : '-' ) },
    { key: 'totals', label: 'Gross Weight', render: (v) => v ? <span>{v.grossWeightG} g <span className="text-xs text-gray-400">({formatWeightTolaLaal(v.grossWeightG)})</span></span> : '-' },
    { key: 'totals', label: 'Total Value', render: (v) => v ? formatCurrency(v.totalValue) : '-' },
    { key: 'refineStatus', label: 'Refine', render: (_, row) => {
      const st = refineStatusFor(row)
      return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${REFINE_BADGE[st]}`}>
          <FlaskConical size={11} /> {st === 'refined' ? 'Refined' : st === 'pending' ? 'At Refinery' : 'Not Refined'}
        </span>
      )
    } },
    { key: 'paymentStatus', label: 'Payment', render: (val) => (
      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PAYMENT_BADGE[val] || 'bg-gray-100 text-gray-700'}`}>{val}</span>
    ) },
    { key: '_id', label: '', render: (_, row) => (
      <div className="flex justify-end gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${row._id}`) }} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="View"><Eye size={15} /></button>
        <button onClick={(e) => { e.stopPropagation(); setDeleting(row) }} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={15} /></button>
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
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={18} className="shrink-0" />
          <span><strong>Refined gold stock is empty.</strong> Custom orders cannot be issued until you record a purchase or receive refined gold from the refinery.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Supplier Gold (Period)" value={s.supplier ? `${s.supplier.grossWeightG || 0} g` : '-'} subtitle={s.supplier ? `${s.supplier.count || 0} purchase(s) • ${formatCurrency(s.supplier.totalValue || 0)}` : 'Loading...'} icon={<Truck size={18} />} color="blue" />
        <StatCard title="Customer Gold (Period)" value={s.customer ? `${s.customer.grossWeightG || 0} g` : '-'} subtitle={s.customer ? `${s.customer.count || 0} purchase(s) • ${formatCurrency(s.customer.totalValue || 0)}` : 'Loading...'} icon={<User size={18} />} color="purple" />
        <StatCard title="POS Old Gold Exchange" value={s.pos ? `${s.pos.grossWeightG || 0} g` : '-'} subtitle={s.pos ? `${s.pos.count || 0} sale(s) • ${formatCurrency(s.pos.value || 0)}` : 'Loading...'} icon={<Gem size={18} />} color="cyan" />
        <StatCard
          title="Refined Gold in Stock"
          value={refinedStock.balanceG != null ? `${refinedStock.balanceG} g` : '-'}
          subtitle={refinedStock.receivedInPeriodG != null ? `${refinedStock.receivedInPeriodG} g received in period` : ''}
          icon={<Scale size={18} />}
          color={runsOut ? 'red' : 'green'}
        />
      </div>

      {s.pos && (s.pos.sales || []).length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
          <button
            onClick={() => setPosOpen(!posOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-[var(--color-elevated)]"
          >
            <span className="flex items-center gap-2"><Gem size={16} className="text-cyan-600" /> POS Old Gold Exchange — Sale-wise Breakdown</span>
            {posOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {posOpen && (
            <div className="overflow-x-auto border-t border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-elevated)] text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2.5">Sale No.</th>
                    <th className="px-4 py-2.5 text-right">Weight Given (g)</th>
                    <th className="px-4 py-2.5 text-right">Net (g)</th>
                    <th className="px-4 py-2.5 text-right">Value Given</th>
                    <th className="px-4 py-2.5 text-right">Deducted</th>
                  </tr>
                </thead>
                <tbody>
                  {(s.pos.sales || []).map((sale) => (
                    <tr key={sale._id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-elevated)] cursor-pointer" onClick={() => navigate(`/pos/sales/${sale._id}`)}>
                      <td className="px-4 py-2.5 font-medium text-blue-600">{sale.saleNumber}</td>
                      <td className="px-4 py-2.5 text-right">{sale.grossWeightG} g</td>
                      <td className="px-4 py-2.5 text-right">{sale.netWeightG} g</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(sale.value)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(sale.deductibleAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setType(t.value); setPage(1) }}
            className={`px-3 py-1.5 text-sm font-medium rounded-xl border transition-colors ${type === t.value ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-[var(--color-card)] border-[var(--color-border)] hover:bg-[var(--color-elevated)]'}`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <FormInput label="Search" name="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Number / party / VAT no." />
        <FormInput label="From" name="startDate" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} />
        <FormInput label="To" name="endDate" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }} />
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-500">{total} purchase(s) in this view • {formatWeightTolaLaal(s.totals?.grossWeightG || 0)} total gold • {formatCurrency(s.totals?.totalValue || 0)}</p>
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
