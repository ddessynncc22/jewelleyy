import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, Scale, Truck, User, Gem, ArrowDownToLine, ArrowUpFromLine, Database, X } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatCard from '../../components/ui/StatCard'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import FormInput from '../../components/ui/FormInput'
import FormSelect from '../../components/ui/FormSelect'
import FormTextarea from '../../components/ui/FormTextarea'
import { getPurchases, getPurchaseSummary, getRefinedStockEntries, createRefinedStockEntry } from '../../services/purchaseService'
import { getSettings } from '../../services/settingsService'
import { getLatestRates } from '../../services/rateService'
import { applyTransportRate, GRAMS_PER_TOLA, formatDate, formatCurrency, formatWeightTolaLaal } from '../../utils/helpers'

const SOURCE_LABEL = {
  purchase: 'Purchase',
  refine: 'Refine',
  custom_order: 'Custom Order',
  reversal: 'Reversal',
  manual: 'Manual',
}

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'pos_exchange', label: 'POS Exchange' },
]

const emptyEntry = () => ({
  type: 'in',
  weightG: '',
  referenceNumber: '',
  date: new Date().toISOString().slice(0, 10),
  note: '',
})

const GoldInStock = () => {
  const [summary, setSummary] = useState(null)
  const [entries, setEntries] = useState([])
  const [entryTotal, setEntryTotal] = useState(0)
  const [entryPage, setEntryPage] = useState(1)
  const [entryLimit, setEntryLimit] = useState(20)
  const [entryLoading, setEntryLoading] = useState(false)

  const [purchases, setPurchases] = useState([])
  const [purchaseTotal, setPurchaseTotal] = useState(0)
  const [purchasePage, setPurchasePage] = useState(1)
  const [purchaseLimit, setPurchaseLimit] = useState(20)
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [type, setType] = useState('')

  const [goldPerGram, setGoldPerGram] = useState(0)

  const [showEntry, setShowEntry] = useState(false)
  const [entry, setEntry] = useState(emptyEntry())
  const [entrySaving, setEntrySaving] = useState(false)

  const fetchSummary = useCallback(async () => {
    try {
      const res = await getPurchaseSummary()
      setSummary(res.data?.data || null)
    } catch { setSummary(null) }
  }, [])

  const fetchEntries = useCallback(async () => {
    setEntryLoading(true)
    try {
      const res = await getRefinedStockEntries({ page: entryPage, limit: entryLimit })
      const data = res.data?.data || []
      setEntries(Array.isArray(data) ? data : [])
      setEntryTotal(res.data?.pagination?.total || 0)
    } catch {
      setEntries([])
    } finally {
      setEntryLoading(false)
    }
  }, [entryPage, entryLimit])

  const fetchPurchases = useCallback(async () => {
    setPurchaseLoading(true)
    try {
      const res = await getPurchases({ page: purchasePage, limit: purchaseLimit, type })
      const data = res.data?.data || []
      setPurchases(Array.isArray(data) ? data : [])
      setPurchaseTotal(res.data?.pagination?.total || 0)
    } catch {
      setPurchases([])
    } finally {
      setPurchaseLoading(false)
    }
  }, [purchasePage, purchaseLimit, type])

  useEffect(() => {
    fetchSummary()
    fetchEntries()
  }, [fetchSummary, fetchEntries])

  useEffect(() => { fetchPurchases() }, [fetchPurchases])

  useEffect(() => {
    Promise.all([getSettings(), getLatestRates()])
      .then(([settings, res]) => {
        const rates = res.data?.data || null
        const gold = applyTransportRate(rates?.gold, Number(settings?.goldTransportCharge) || 0)
        setGoldPerGram(gold ? Number((gold.rate / GRAMS_PER_TOLA).toFixed(2)) : 0)
      })
      .catch(() => {})
  }, [])

  const s = summary || {}
  const refinedStock = s.refinedStock || {}
  const balanceG = refinedStock.balanceG != null ? refinedStock.balanceG : 0
  const balanceValue = balanceG * goldPerGram
  const runsOut = balanceG <= 0

  const handleCreateEntry = async () => {
    if (!entry.weightG || Number(entry.weightG) <= 0) {
      toast.error('Enter a positive weight in grams')
      return
    }
    setEntrySaving(true)
    try {
      await createRefinedStockEntry({
        type: entry.type,
        weightG: Number(entry.weightG),
        referenceNumber: entry.referenceNumber,
        date: entry.date || undefined,
        note: entry.note,
      })
      toast.success(entry.type === 'in' ? 'Old refined stock added' : 'Refined stock removed')
      setShowEntry(false)
      setEntry(emptyEntry())
      fetchSummary()
      fetchEntries()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save entry')
    } finally {
      setEntrySaving(false)
    }
  }

  const entryColumns = [
    { key: 'date', label: 'Date', render: (val) => formatDate(val) },
    {
      key: 'type',
      label: 'Type',
      render: (val) => (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${val === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {val === 'in' ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />} {val === 'in' ? 'In' : 'Out'}
        </span>
      ),
    },
    { key: 'source', label: 'Source', render: (val) => SOURCE_LABEL[val] || val || '-' },
    { key: 'referenceNumber', label: 'Reference', render: (val) => val || '-' },
    { key: 'weightG', label: 'Weight', render: (val, row) => (
      <span className={row.type === 'in' ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
        {row.type === 'in' ? '+' : '−'}{val} g
      </span>
    ) },
    { key: 'balanceAfter', label: 'Balance After', render: (val) => `${val} g` },
    { key: 'note', label: 'Note', render: (val) => val || '-' },
    { key: 'performedBy', label: 'By', render: (val) => val?.name || '-' },
  ]

  const purchaseColumns = [
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
    { key: 'totals', label: 'Gross Weight', render: (v) => v ? `${v.grossWeightG} g` : '-' },
    { key: 'totals', label: 'Fine Weight', render: (v) => v ? `${v.fineWeightG} g` : '-' },
    { key: 'totals', label: 'Value', render: (v) => v ? formatCurrency(v.totalValue) : '-' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Gold in Stock" subtitle="Refined gold ledger, purchased gold and manual entries for gold you already had">
        <Button icon={<Plus size={16} />} onClick={() => { setEntry(emptyEntry()); setShowEntry(true) }}>
          Add Old Refined Stock
        </Button>
      </PageHeader>

      {runsOut && summary && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangleInline />
          <span><strong>Refined gold balance is zero.</strong> Custom orders cannot be issued until refined gold is available. Add old refined stock or record a purchase.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Refined Gold Balance" value={balanceG != null ? `${balanceG} g` : '-'} subtitle={goldPerGram ? `${formatCurrency(balanceValue)} at Rs ${goldPerGram}/g` : 'Loading rate...'} icon={<Scale size={18} />} color={runsOut ? 'red' : 'green'} />
        <StatCard title="Supplier Gold (Period)" value={s.supplier ? `${s.supplier.grossWeightG || 0} g` : '-'} subtitle={s.supplier ? `${s.supplier.count || 0} purchase(s) • ${formatCurrency(s.supplier.totalValue || 0)}` : 'Loading...'} icon={<Truck size={18} />} color="blue" />
        <StatCard title="Customer Gold (Period)" value={s.customer ? `${s.customer.grossWeightG || 0} g` : '-'} subtitle={s.customer ? `${s.customer.count || 0} purchase(s) • ${formatCurrency(s.customer.totalValue || 0)}` : 'Loading...'} icon={<User size={18} />} color="purple" />
        <StatCard title="POS Old Gold Exchange" value={s.pos ? `${s.pos.grossWeightG || 0} g` : '-'} subtitle={s.pos ? `${s.pos.count || 0} sale(s) • ${formatCurrency(s.pos.value || 0)}` : 'Loading...'} icon={<Gem size={18} />} color="cyan" />
      </div>

      <Card
        title="Refined Gold Ledger"
        subtitle="Every gram of fine gold in and out — purchases, refinery returns, custom order use and manual entries"
        icon={<Database size={18} />}
      >
        {entries.length === 0 && !entryLoading ? (
          <EmptyState icon={<Scale size={32} />} title="No ledger entries yet" description="Record a purchase, receive refined gold or add old refined stock to start the ledger" />
        ) : (
          <DataTable
            columns={entryColumns}
            data={entries}
            loading={entryLoading}
            pagination={{ page: entryPage, limit: entryLimit, total: entryTotal, onPageChange: setEntryPage, onLimitChange: setEntryLimit }}
          />
        )}
      </Card>

      <Card title="Purchased Gold" subtitle="Gold bought from suppliers and customers" icon={<Gem size={18} />}>
        <div className="flex flex-wrap gap-3 items-end mb-3">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setType(t.value); setPurchasePage(1) }}
              className={`px-3 py-1.5 text-sm font-medium rounded-xl border transition-colors ${type === t.value ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-[var(--color-card)] border-[var(--color-border)] hover:bg-[var(--color-elevated)]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {purchases.length === 0 && !purchaseLoading ? (
          <EmptyState icon={<Gem size={32} />} title="No purchases yet" description="Purchases you record will appear here" />
        ) : (
          <DataTable
            columns={purchaseColumns}
            data={purchases}
            loading={purchaseLoading}
            pagination={{ page: purchasePage, limit: purchaseLimit, total: purchaseTotal, onPageChange: setPurchasePage, onLimitChange: setPurchaseLimit }}
          />
        )}
      </Card>

      <Modal isOpen={showEntry} onClose={() => setShowEntry(false)} title="Add / Remove Refined Stock" size="md">
        <p className="text-sm text-gray-600 mb-4">
          Use this to bring <strong>old refined gold</strong> (gold the shop already had before using this system) onto the books, or to correct the balance manually.
        </p>
        <div className="space-y-3">
          <FormSelect
            label="Type"
            name="type"
            options={[
              { value: 'in', label: 'Add (In)' },
              { value: 'out', label: 'Remove (Out)' },
            ]}
            value={entry.type}
            onChange={(e) => setEntry((p) => ({ ...p, type: e.target.value }))}
          />
          <FormInput
            label="Weight (g)"
            name="weightG"
            type="number"
            step="0.001"
            value={entry.weightG}
            onChange={(e) => setEntry((p) => ({ ...p, weightG: e.target.value }))}
            placeholder="0.000"
            autoFocus
            hint={entry.weightG ? formatWeightTolaLaal(Number(entry.weightG) || 0) : ''}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Reference (optional)" name="referenceNumber" value={entry.referenceNumber} onChange={(e) => setEntry((p) => ({ ...p, referenceNumber: e.target.value }))} placeholder="e.g. Opening balance" />
            <FormInput label="Date" name="date" type="date" value={entry.date} onChange={(e) => setEntry((p) => ({ ...p, date: e.target.value }))} />
          </div>
          <FormTextarea label="Note" name="note" value={entry.note} onChange={(e) => setEntry((p) => ({ ...p, note: e.target.value }))} rows={2} placeholder="Optional — e.g. Gold kept before using this software" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowEntry(false)} disabled={entrySaving} icon={<X size={14} />}>Cancel</Button>
          <Button loading={entrySaving} icon={entry.type === 'in' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />} onClick={handleCreateEntry}>
            {entry.type === 'in' ? 'Add to Stock' : 'Remove from Stock'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function AlertTriangleInline() {
  return <span className="shrink-0 font-semibold text-red-600">!</span>
}

export default GoldInStock
