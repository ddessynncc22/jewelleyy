import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, FlaskConical, Trash2, PackagePlus, TrendingUp } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import FormInput from '../../components/ui/FormInput'
import FormSelect from '../../components/ui/FormSelect'
import { getRefines, getRefineCandidates, createRefine, receiveRefine, deleteRefine } from '../../services/purchaseService'
import { getSettings } from '../../services/settingsService'
import { getLatestRates } from '../../services/rateService'
import { applyTransportRate, GRAMS_PER_TOLA, formatDate, formatCurrency, formatWeightTolaLaal } from '../../utils/helpers'
import { KARAT_OPTIONS, KARAT_PURITY, PURITY_OPTIONS, SILVER_PURITIES } from '../../utils/purchaseUtils'

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
}

const METAL_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
]

const emptyManual = () => ({
  description: '',
  metalType: 'gold',
  karat: '22K',
  purityPercent: '916',
  actualWeightG: '',
  givenWeightG: '',
})

const emptyReceive = () => ({
  receivedWeightG: '',
  receivedPurity: '999',
})

const RefineList = () => {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [manual, setManual] = useState(emptyManual())
  const [createSaving, setCreateSaving] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  const [receiving, setReceiving] = useState(null)
  const [receive, setReceive] = useState(emptyReceive())
  const [receiveSaving, setReceiveSaving] = useState(false)

  const [deleting, setDeleting] = useState(null)
  const [goldPerGram, setGoldPerGram] = useState(0)

  useEffect(() => {
    Promise.all([getSettings(), getLatestRates()])
      .then(([settings, res]) => {
        const rates = res.data?.data || null
        const gold = applyTransportRate(rates?.gold, Number(settings?.goldTransportCharge) || 0)
        setGoldPerGram(gold ? Number((gold.rate / GRAMS_PER_TOLA).toFixed(2)) : 0)
      })
      .catch(() => {})
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRefines({ page, limit, status, search })
      const data = res.data?.data || []
      setRows(Array.isArray(data) ? data : [])
      setTotal(res.data?.pagination?.total || 0)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, limit, status, search])

  useEffect(() => { fetchRows() }, [fetchRows])

  const openReceive = (row) => {
    setReceiving(row)
    setReceive(emptyReceive())
  }

  const handleReceive = async () => {
    if (!receive.receivedWeightG || Number(receive.receivedWeightG) < 0) {
      toast.error('Enter the received gold weight')
      return
    }
    setReceiveSaving(true)
    try {
      await receiveRefine(receiving._id, {
        receivedWeightG: Number(receive.receivedWeightG),
        receivedPurity: Number(receive.receivedPurity) || 0,
      })
      toast.success(`Refine ${receiving.refineNumber} received — added to refined gold stock`)
      setReceiving(null)
      fetchRows()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to receive refine')
    } finally {
      setReceiveSaving(false)
    }
  }

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await getRefineCandidates()
      setCandidates(Array.isArray(res.data?.data) ? res.data.data : [])
    } catch {
      setCandidates([])
    }
  }, [])

  useEffect(() => { fetchCandidates() }, [fetchCandidates])

  const openCreate = () => {
    setManual(emptyManual())
    setSelectedCandidate(null)
    setShowCreate(true)
  }

  const pickCandidate = (e) => {
    const key = e.target.value
    if (!key) {
      setSelectedCandidate(null)
      return
    }
    const cand = candidates.find((c) => `${c.purchaseId}:${c.purchaseItemIndex}` === key)
    setSelectedCandidate(cand)
    if (cand) {
      setManual((p) => ({
        ...p,
        metalType: cand.metalType,
        karat: cand.karat ? `${cand.karat}K` : '22K',
        purityPercent: String(cand.purityPercent),
        actualWeightG: String(cand.grossWeightG),
        givenWeightG: String(cand.givenWeightG || cand.fineWeightG),
      }))
    }
  }

  const handleCreate = async () => {
    if (!manual.actualWeightG || Number(manual.actualWeightG) < 0) {
      toast.error('Actual gold weight is required')
      return
    }
    if (!manual.givenWeightG || Number(manual.givenWeightG) < 0) {
      toast.error('Gold weight given to customer is required')
      return
    }
    setCreateSaving(true)
    try {
      const payload = {
        sourceType: selectedCandidate ? 'purchase' : 'manual',
        metalType: manual.metalType,
        description: manual.description,
        actualWeightG: Number(manual.actualWeightG),
        givenWeightG: Number(manual.givenWeightG),
        purityPercent: Number(manual.purityPercent) || 0,
        karat: manual.karat ? Number(manual.karat.replace('K', '')) : 0,
      }
      if (selectedCandidate) {
        payload.purchaseId = selectedCandidate.purchaseId
        payload.purchaseItemIndex = selectedCandidate.purchaseItemIndex
      }
      await createRefine(payload)
      toast.success('Refine entry created — enter the received weight when the refinery returns the gold')
      setShowCreate(false)
      setManual(emptyManual())
      setSelectedCandidate(null)
      fetchRows()
      fetchCandidates()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create refine entry')
    } finally {
      setCreateSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteRefine(deleting._id)
      toast.success('Refine entry deleted')
      setDeleting(null)
      fetchRows()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete refine entry')
      setDeleting(null)
    }
  }

  const columns = [
    { key: 'refineNumber', label: 'Refine No.', render: (val) => <span className="font-semibold text-gray-900">{val}</span> },
    { key: 'createdAt', label: 'Date', render: (val) => formatDate(val) },
    { key: 'sourceType', label: 'Source', render: (val, row) => row.purchaseId ? `Purchase ${row.purchaseId.purchaseNumber || ''}` : 'Manual' },
    { key: 'description', label: 'Item', render: (val) => val || '-' },
    { key: 'actualWeightG', label: 'Actual Wt', render: (val) => `${val} g` },
    { key: 'givenWeightG', label: 'Given Wt', render: (val) => `${val} g` },
    { key: 'receivedWeightG', label: 'Received Wt', render: (val, row) => row.status === 'received' ? `${val} g` : <span className="text-amber-600">—</span> },
    {
      key: 'profitG',
      label: 'Profit (Wt / Amount)',
      render: (val, row) => {
        if (row.status !== 'received') return <span className="text-gray-400">Pending</span>
        const positive = row.profitG >= 0
        return (
          <span className={positive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
            {row.profitG > 0 ? '+' : ''}{row.profitG} g / {formatCurrency(row.profitAmount)}
          </span>
        )
      },
    },
    { key: 'status', label: 'Status', render: (val) => (
      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[val] || 'bg-gray-100 text-gray-700'}`}>{val}</span>
    ) },
    {
      key: '_id',
      label: '',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          {row.status === 'pending' && (
            <button onClick={(e) => { e.stopPropagation(); openReceive(row) }} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title="Receive Refined Gold">
              <PackagePlus size={15} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setDeleting(row) }} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Refine Gold" subtitle="Gold sent to the refinery — one entry per item. Received weight is entered later, profit shows on the same line">
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          Create Refine Material
        </Button>
      </PageHeader>

      <Card title="How it works" icon={<TrendingUp size={18} />}>
        <p className="text-sm text-gray-600">
          Enter the <strong>actual gold weight</strong> (on the scale) and the <strong>gold weight given to the customer</strong> when the item is sent. The rate is locked at issue.
          When the refinery returns the gold, enter the <strong>received weight</strong> later — the profit (received − given) and its amount at the locked rate appear on the same line.
        </p>
      </Card>

      <div className="flex flex-wrap gap-3 items-end">
        {[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'received', label: 'Received' }].map((t) => (
          <button
            key={t.value}
            onClick={() => { setStatus(t.value); setPage(1) }}
            className={`px-3 py-1.5 text-sm font-medium rounded-xl border transition-colors ${status === t.value ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-[var(--color-card)] border-[var(--color-border)] hover:bg-[var(--color-elevated)]'}`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <FormInput label="Search" name="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Refine no. / item" />
      </div>

      {rows.length === 0 && !loading ? (
        <EmptyState icon={<FlaskConical size={32} />} title="No refine entries" description="Send a purchase item to the refinery or create a refine material on its own" />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          pagination={{ page, limit, total, onPageChange: setPage, onLimitChange: setLimit }}
        />
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Refine Material" size="md">
        <div className="space-y-3">
          <FormSelect
            label="Link to purchase (auto-fill)"
            name="candidate"
            placeholder="None — manual entry"
            value={selectedCandidate ? `${selectedCandidate.purchaseId}:${selectedCandidate.purchaseItemIndex}` : ''}
            onChange={pickCandidate}
            options={candidates.map((c) => ({
              value: `${c.purchaseId}:${c.purchaseItemIndex}`,
              label: `${c.purchaseNumber} — ${c.customerName} • ${c.grossWeightG} g gross, ${c.givenWeightG || c.fineWeightG} g given • ${c.purityPercent}/${c.karat}K`,
            }))}
          />
          {candidates.length === 0 && (
            <p className="text-xs text-gray-500">No gold purchased from customers waiting to be refined right now.</p>
          )}
          {selectedCandidate && (
            <p className="text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2">
              Linked to purchase <strong>{selectedCandidate.purchaseNumber}</strong> ({selectedCandidate.customerName}) — weights auto-filled, adjust if the scale reads differently.
            </p>
          )}
          <FormSelect
            label="Metal"
            name="metalType"
            options={METAL_OPTIONS}
            value={manual.metalType}
            onChange={(e) => setManual((p) => ({ ...p, metalType: e.target.value }))}
          />
          <FormInput label="Item Description" name="description" value={manual.description} onChange={(e) => setManual((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. Old chain from walk-in customer" />
          <div className="grid grid-cols-2 gap-3">
            <FormSelect
              label="Karat"
              name="karat"
              options={KARAT_OPTIONS.map((k) => ({ value: k, label: k }))}
              value={manual.karat}
              onChange={(e) => setManual((p) => ({ ...p, karat: e.target.value, purityPercent: KARAT_PURITY[e.target.value] ?? p.purityPercent }))}
            />
            <FormSelect
              label="Purity"
              name="purityPercent"
              options={(manual.metalType === 'silver' ? SILVER_PURITIES : PURITY_OPTIONS).map((v) => ({ value: v, label: v }))}
              value={manual.purityPercent}
              onChange={(e) => setManual((p) => ({ ...p, purityPercent: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Actual Gold Weight (g)" name="actualWeightG" type="number" step="0.001" value={manual.actualWeightG} onChange={(e) => setManual((p) => ({ ...p, actualWeightG: e.target.value }))} placeholder="0.000" hint={manual.actualWeightG ? formatWeightTolaLaal(Number(manual.actualWeightG) || 0) : ''} />
            <FormInput label="Given to Customer (g)" name="givenWeightG" type="number" step="0.001" value={manual.givenWeightG} onChange={(e) => setManual((p) => ({ ...p, givenWeightG: e.target.value }))} placeholder="0.000" />
          </div>
          <p className="text-xs text-gray-500">
            Profit will be booked at today&apos;s gold rate <strong>Rs {goldPerGram} / g</strong>, locked now at issue — it won&apos;t change when the refinery returns the gold.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={createSaving}>Cancel</Button>
            <Button loading={createSaving} onClick={handleCreate}>Create Entry</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!receiving} onClose={() => setReceiving(null)} title={`Receive Refined Gold — ${receiving?.refineNumber || ''}`} size="md">
        <p className="text-sm text-gray-600 mb-4">
          Given: <strong>{receiving?.givenWeightG} g</strong>. Enter the weight the refinery returned. Profit = received − given, booked at the rate locked when this item was issued to the refinery.
        </p>
        <div className="space-y-3">
          <FormInput label="Received Weight (g)" name="receivedWeightG" type="number" step="0.001" value={receive.receivedWeightG} onChange={(e) => setReceive((p) => ({ ...p, receivedWeightG: e.target.value }))} placeholder="0.000" autoFocus hint={receive.receivedWeightG ? formatWeightTolaLaal(Number(receive.receivedWeightG) || 0) : ''} />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Received Purity" name="receivedPurity" type="number" step="1" value={receive.receivedPurity} onChange={(e) => setReceive((p) => ({ ...p, receivedPurity: e.target.value }))} />
            <div className="rounded-xl bg-[var(--color-elevated)] px-3 py-2 text-sm self-end">
              <p className="text-xs text-gray-500">Rate locked at issue</p>
              <p className="font-semibold">Rs {receiving?.ratePerGram || 0} / g</p>
            </div>
          </div>
          {receive.receivedWeightG && (
            <div className="rounded-xl bg-[var(--color-elevated)] px-3 py-2 text-sm">
              Profit: <strong className={Number(receive.receivedWeightG) - Number(receiving?.givenWeightG) >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Number(receive.receivedWeightG) - Number(receiving?.givenWeightG) >= 0 ? '+' : ''}{(Number(receive.receivedWeightG) - Number(receiving?.givenWeightG)).toFixed(4)} g
              </strong>{' '}
              ≈ {formatCurrency((Number(receive.receivedWeightG) - Number(receiving?.givenWeightG)) * (Number(receiving?.ratePerGram) || 0))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setReceiving(null)} disabled={receiveSaving}>Cancel</Button>
            <Button loading={receiveSaving} icon={<PackagePlus size={14} />} onClick={handleReceive}>Receive & Add to Stock</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete refine entry?"
        message={`This deletes ${deleting?.refineNumber}. Refined gold it added to stock is reversed.`}
        confirmText="Delete"
      />
    </div>
  )
}

export default RefineList
