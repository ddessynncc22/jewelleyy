import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, Scale, Banknote } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import FormInput from '../../components/ui/FormInput'
import FormSelect from '../../components/ui/FormSelect'
import FormTextarea from '../../components/ui/FormTextarea'
import Modal from '../../components/ui/Modal'
import DatePicker from '../../components/ui/DatePicker'
import { getSettings } from '../../services/settingsService'
import { getLatestRates } from '../../services/rateService'
import { getCustomers, createCustomer } from '../../services/customerService'
import { createPurchase } from '../../services/purchaseService'
import { applyTransportRate, GRAMS_PER_TOLA, formatWeightTolaLaal, formatCurrency, gramsToLaal, laalToGrams } from '../../utils/helpers'
import { KARAT_PURITY, KARAT_OPTIONS, PURITY_OPTIONS, SILVER_PURITIES, PAYMENT_METHODS, computeLine, computeTotals } from '../../utils/purchaseUtils'

const TYPE_OPTIONS = [
  { value: 'supplier', label: 'Supplier Purchase' },
  { value: 'customer', label: 'Customer Purchase (Walk-in / Buy-back)' },
]

const METAL_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
]

const emptyItem = () => ({
  description: '',
  metalType: 'gold',
  karat: '22K',
  purityPercent: '916',
  grossWeightG: '',
  laal: '',
  stoneWeightG: '',
  deductionPercent: '0',
  ratePerGram: '',
  value: '',
})

const emptyPayment = () => ({ method: 'cash', amount: '', reference: '', date: '' })

const PurchaseForm = () => {
  const navigate = useNavigate()
  const [type, setType] = useState('supplier')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [supplierName, setSupplierName] = useState('')
  const [vatInvoiceNo, setVatInvoiceNo] = useState('')
  const [customer, setCustomer] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [payments, setPayments] = useState([emptyPayment()])
  const [rateLocked, setRateLocked] = useState({ goldPerGram: 0, silverPerGram: 0, source: 'live' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [showCustomerModal, setShowCustomerModal] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([getSettings(), getLatestRates()])
      .then(([settings, res]) => {
        if (!active) return
        const rates = res.data?.data || null
        const charges = {
          gold: Number(settings?.goldTransportCharge) || 0,
          silver: Number(settings?.silverTransportCharge) || 0,
        }
        const gold = applyTransportRate(rates?.gold, charges.gold)
        const silver = applyTransportRate(rates?.silver, charges.silver)
        setRateLocked({
          goldPerGram: gold ? Number((gold.rate / GRAMS_PER_TOLA).toFixed(2)) : 0,
          silverPerGram: silver ? Number((silver.rate / GRAMS_PER_TOLA).toFixed(2)) : 0,
          source: 'live',
        })
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!customerSearch || customerSearch.length < 1) { setCustomerResults([]); return }
      getCustomers({ search: customerSearch, limit: 10 })
        .then((res) => {
          const data = res.data?.data || res.data || []
          setCustomerResults(Array.isArray(data) ? data : [])
        })
        .catch(() => setCustomerResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const updateLine = (index, field, value) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== index) return it
      const next = { ...it, [field]: value }
      if (field === 'grossWeightG') next.laal = value === '' || value == null ? '' : gramsToLaal(Number(value)).toFixed(3)
      if (field === 'laal') next.grossWeightG = value === '' || value == null ? '' : laalToGrams(Number(value)).toFixed(4)
      if (field === 'karat') next.purityPercent = value ? (KARAT_PURITY[value] ?? next.purityPercent) : next.purityPercent
      return next
    }))
  }

  const computedItems = useMemo(
    () => items.map((it) => computeLine(it, rateLocked)),
    [items, rateLocked]
  )
  const totals = useMemo(() => computeTotals(computedItems), [computedItems])

  const paidTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const balanceDue = Math.max(0, totals.totalValue - paidTotal)
  const paymentStatus = totals.totalValue > 0 && paidTotal >= totals.totalValue ? 'paid' : paidTotal > 0 ? 'partial' : 'credit'

  const pickCustomer = (c) => {
    setCustomer(c)
    setCustomerName(c?.name || '')
    setCustomerPhone(c?.phone || '')
    setCustomerAddress(c?.address || '')
    setShowCustomerModal(false)
  }

  const validate = () => {
    const e = {}
    if (type === 'supplier' && !supplierName.trim()) e.supplierName = 'Supplier name is required'
    if (type === 'customer' && !customerName.trim()) e.customerName = 'Customer name is required'
    if (items.length === 0 || items.every((it) => !it.grossWeightG || Number(it.grossWeightG) <= 0)) {
      e.items = 'Add at least one item with a valid weight'
    }
    if (items.some((it) => it.grossWeightG && it.value === '')) {
      e.items = e.items || 'Enter the value (NPR) for each item'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const payload = {
      type,
      date,
      supplierName,
      vatInvoiceNo,
      customer: null,
      customerName: type === 'customer' ? customerName : '',
      items: computedItems.map((it) => ({
        description: it.description,
        metalType: it.metalType,
        karat: it.karat ? Number(it.karat.replace('K', '')) : 0,
        purityPercent: Number(it.purityPercent),
        grossWeightG: Number(it.grossWeightG),
        stoneWeightG: Number(it.stoneWeightG) || 0,
        deductionPercent: type === 'customer' ? Number(it.deductionPercent) || 0 : 0,
        ratePerGram: it.ratePerGram === '' || it.ratePerGram == null ? undefined : Number(it.ratePerGram),
        value: it.value === '' || it.value == null ? 0 : Number(it.value),
      })),
      payments: payments
        .filter((p) => Number(p.amount) > 0)
        .map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference, date: p.date || undefined })),
      rateLocked,
      notes,
    }
    try {
      // Customer purchases: link the chosen customer, or save a brand-new
      // walk-in customer with the details entered on the form.
      if (type === 'customer' && customerName.trim()) {
        if (customer) {
          payload.customer = customer._id || customer.id
        } else {
          try {
            const created = await createCustomer({ name: customerName, phone: customerPhone, address: customerAddress })
            payload.customer = created.data?.data?._id || created.data?.data?.id || null
          } catch {
            if (customerPhone) {
              try {
                const res = await getCustomers({ search: customerPhone, limit: 10 })
                const found = (res.data?.data || []).find((c) => c.phone && String(c.phone) === String(customerPhone))
                if (found) payload.customer = found._id || found.id
              } catch { /* keep the purchase unlinked */ }
            }
          }
        }
      }
      const res = await createPurchase(payload)
      const data = res.data?.data || {}
      toast.success(`Purchase ${data.purchase?.purchaseNumber || ''} recorded`)
      navigate('/purchases')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save purchase')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="New Purchase" subtitle="Record gold bought from a supplier or from a customer (walk-in / buy-back)">
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/purchases')}>
          Back
        </Button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card title="Purchase Details" icon={<Banknote size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect
              label="Purchase Type"
              name="type"
              options={TYPE_OPTIONS}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <DatePicker label="Date" name="date" value={date} onChange={(e) => setDate(e.target.value)} />

            {type === 'supplier' ? (
              <>
                <FormInput
                  label="Supplier Name"
                  name="supplierName"
                  value={supplierName}
                  onChange={(e) => { setSupplierName(e.target.value); if (errors.supplierName) setErrors((p) => ({ ...p, supplierName: '' })) }}
                  error={errors.supplierName}
                  placeholder="e.g. Ramesh Gold Traders"
                  required
                />
                <FormInput
                  label="VAT Invoice No."
                  name="vatInvoiceNo"
                  value={vatInvoiceNo}
                  onChange={(e) => setVatInvoiceNo(e.target.value)}
                  placeholder="Optional"
                />
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Customer</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormInput
                    label="Customer Name"
                    name="customerName"
                    value={customerName}
                    onChange={(e) => { setCustomerName(e.target.value); setCustomer(null); if (errors.customerName) setErrors((p) => ({ ...p, customerName: '' })) }}
                    error={errors.customerName}
                    placeholder="Customer name"
                    required
                  />
                  <FormInput
                    label="Phone"
                    name="customerPhone"
                    value={customerPhone}
                    onChange={(e) => { setCustomerPhone(e.target.value); setCustomer(null) }}
                    placeholder="98XXXXXXXX"
                  />
                  <FormInput
                    label="Address"
                    name="customerAddress"
                    value={customerAddress}
                    onChange={(e) => { setCustomerAddress(e.target.value); setCustomer(null) }}
                    placeholder="e.g. New Road, Kathmandu"
                  />
                  <div className="flex items-end pb-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCustomerModal(true)}
                      className="w-full"
                    >
                      Find a customer
                    </Button>
                  </div>
                </div>
                {customer && (
                  <p className="text-xs text-gray-500 mt-1">Linked: {customer.name} — {customer.customerCode || ''} {customer.phone || ''}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">New customer? Fill in the details — they are saved automatically when you record the purchase.</p>
              </div>
            )}
          </div>
        </Card>

        <Card
          title="Purchase Items"
          subtitle="Supplier gold is always a refined bar; customer gold is an item that can later be sent to the refinery"
          icon={<Scale size={18} />}
          actions={
            <Button type="button" variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setItems((p) => [...p, emptyItem()])}>
              Add Item
            </Button>
          }
        >
          {errors.items && <p className="text-xs text-red-600 mb-3">{errors.items}</p>}
          <div className="space-y-3">
            {computedItems.map((it, idx) => (
              <div key={idx} className="border border-[var(--color-border)] rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500">Item {idx + 1} — {type === 'supplier' ? 'Refined Bar' : 'Customer Item'}</p>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2 md:col-span-2">
                    <FormInput label="Description" name={`desc-${idx}`} value={it.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} placeholder="e.g. 22K old chain / 999 gold bar" />
                  </div>
                  <FormSelect
                    label="Metal"
                    name={`metal-${idx}`}
                    options={METAL_OPTIONS}
                    value={it.metalType}
                    onChange={(e) => updateLine(idx, 'metalType', e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <FormSelect
                      label="Karat"
                      name={`karat-${idx}`}
                      options={KARAT_OPTIONS.map((k) => ({ value: k, label: k }))}
                      value={it.karat}
                      onChange={(e) => updateLine(idx, 'karat', e.target.value)}
                    />
                    <FormSelect
                      label="Purity"
                      name={`purity-${idx}`}
                      options={(it.metalType === 'silver' ? SILVER_PURITIES : PURITY_OPTIONS).map((p) => ({ value: p, label: p }))}
                      value={it.purityPercent}
                      onChange={(e) => updateLine(idx, 'purityPercent', e.target.value)}
                    />
                  </div>
                  <FormInput label="Gross Weight (g)" name={`gross-${idx}`} type="number" step="0.001" value={it.grossWeightG} onChange={(e) => updateLine(idx, 'grossWeightG', e.target.value)} placeholder="0.000" />
                  <FormInput label="Weight (laal)" name={`laal-${idx}`} type="number" step="0.001" value={it.laal} onChange={(e) => updateLine(idx, 'laal', e.target.value)} placeholder="0.000" hint={it.grossWeightG ? formatWeightTolaLaal(Number(it.grossWeightG)) : ''} />
                  <FormInput label="Stone Weight (g)" name={`stone-${idx}`} type="number" step="0.001" value={it.stoneWeightG} onChange={(e) => updateLine(idx, 'stoneWeightG', e.target.value)} placeholder="0.000" />
                  {type === 'customer' && (
                    <FormInput
                      label="Deduction %"
                      name={`deduction-${idx}`}
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={it.deductionPercent}
                      onChange={(e) => updateLine(idx, 'deductionPercent', e.target.value)}
                      placeholder="0"
                      hint="Weight loss on old gold"
                    />
                  )}
                  <FormInput
                    label={`Rate / g (${it.metalType === 'gold' ? 'Gold' : 'Silver'})`}
                    name={`rate-${idx}`}
                    type="number"
                    step="0.01"
                    value={it.ratePerGram}
                    onChange={(e) => { updateLine(idx, 'ratePerGram', e.target.value); setRateLocked((p) => ({ ...p, source: 'manual' })) }}
                    placeholder={String(it.metalType === 'gold' ? rateLocked.goldPerGram : rateLocked.silverPerGram)}
                    hint="Reference only — value is entered manually"
                  />
                  <FormInput
                    label="Value (NPR)"
                    name={`value-${idx}`}
                    type="number"
                    step="0.01"
                    value={it.value}
                    onChange={(e) => updateLine(idx, 'value', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                  <div className="flex flex-col justify-end pb-1 gap-0.5">
                    <p className="text-xs text-gray-500">{type === 'customer' ? 'Given to Customer' : 'Fine'}: <strong>{Number(it.givenWeightG || 0).toFixed(4)} g</strong></p>
                    {type === 'customer' && Number(it.deductionPercent || 0) > 0 && (
                      <p className="text-xs text-gray-400">Fine: {Number(it.fineWeightG || 0).toFixed(4)} g − {it.deductionPercent}%</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Payments"
          subtitle="Cash, bank transfer or cheque — split the payment any way you like, each with its own reference"
          icon={<Banknote size={18} />}
          actions={
            <Button type="button" variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setPayments((p) => [...p, emptyPayment()])}>
              Add Payment
            </Button>
          }
        >
          <div className="space-y-3">
            {payments.map((p, idx) => (
              <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <FormSelect
                  label={idx === 0 ? 'Method' : ''}
                  name={`method-${idx}`}
                  options={PAYMENT_METHODS}
                  value={p.method}
                  onChange={(e) => setPayments((prev) => prev.map((x, i) => (i === idx ? { ...x, method: e.target.value } : x)))}
                />
                <FormInput
                  label={idx === 0 ? 'Amount' : ''}
                  name={`amount-${idx}`}
                  type="number"
                  step="0.01"
                  value={p.amount}
                  onChange={(e) => setPayments((prev) => prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))}
                  placeholder="0.00"
                />
                <div className="col-span-2">
                  <FormInput
                    label={idx === 0 ? 'Reference (cheque no / bank / note)' : ''}
                    name={`ref-${idx}`}
                    value={p.reference}
                    onChange={(e) => setPayments((prev) => prev.map((x, i) => (i === idx ? { ...x, reference: e.target.value } : x)))}
                    placeholder="Reference"
                  />
                </div>
                {payments.length > 1 && (
                  <button type="button" onClick={() => setPayments((p2) => p2.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 mb-2">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Totals & Rate Lock" icon={<Scale size={18} />}>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Gross Weight</p>
              <p className="font-semibold">{totals.grossWeightG} g <span className="text-xs text-gray-400">({formatWeightTolaLaal(totals.grossWeightG)})</span></p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{type === 'customer' ? 'Given to Customer' : 'Fine Weight'}</p>
              <p className="font-semibold">{totals.givenWeightG} g</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Gold Value</p>
              <p className="font-semibold">{formatCurrency(totals.goldValue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Silver Value</p>
              <p className="font-semibold">{formatCurrency(totals.silverValue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-semibold text-gray-900">{formatCurrency(totals.totalValue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Paid / Balance</p>
              <p className="font-semibold">{formatCurrency(paidTotal)} / <span className={balanceDue > 0 ? 'text-red-600' : ''}>{formatCurrency(balanceDue)}</span></p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--color-border)] grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Locked Gold Rate</p>
              <p className="font-semibold">{rateLocked.goldPerGram} / g</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Locked Silver Rate</p>
              <p className="font-semibold">{rateLocked.silverPerGram} / g</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Rate Source</p>
              <p className="font-semibold capitalize">{rateLocked.source}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Payment Status</p>
              <p className={`font-semibold capitalize ${paymentStatus === 'paid' ? 'text-green-600' : paymentStatus === 'partial' ? 'text-amber-600' : 'text-red-600'}`}>{paymentStatus}</p>
            </div>
          </div>
        </Card>

        <FormTextarea label="Notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes" />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/purchases')} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>Record Purchase</Button>
        </div>
      </form>

      <Modal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Find Customer" size="md">
        <FormInput label="Search by name / phone" name="customerSearch" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} autoFocus placeholder="Type to search..." />
        <div className="mt-3 space-y-2 max-h-80 overflow-auto">
          {customerResults.length === 0 ? (
            <p className="text-sm text-gray-500">No customers found. You can still type the name above without linking.</p>
          ) : (
            customerResults.map((c) => (
              <button key={c._id} type="button" onClick={() => pickCustomer(c)} className="w-full text-left border border-[var(--color-border)] rounded-xl px-3 py-2 hover:bg-[var(--color-elevated)] transition-colors">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-gray-500">{c.customerCode || ''} {c.phone ? `• ${c.phone}` : ''}</p>
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}

export default PurchaseForm
