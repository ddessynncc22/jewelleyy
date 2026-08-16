import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  X, Plus, Minus, ShoppingCart, Package, TrendingUp, Layers, AlertTriangle,
} from 'lucide-react'
import { getLooseLots, getLooseLotByBarcode, createLooseBill } from '../../services/looseLotService'
import { getCustomers, createCustomer } from '../../services/customerService'
import { getLatestRates } from '../../services/rateService'
import { getDiamondVatStatus } from '../../services/posService'
import { getSettings } from '../../services/settingsService'
import Button from '../../components/ui/Button'
import SearchInput from '../../components/ui/SearchInput'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatCurrency, formatWeight, applyTransportRate, getTransportCharges, numberToWords } from '../../utils/helpers'
import { getBSDate, fmtMoney, fmtWt } from '../../components/invoice/invoiceUtils'
import InvoiceDocument from '../../components/invoice/InvoiceDocument'
import useBarcodeScanner from '../../hooks/useBarcodeScanner'

const PAYMENT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'khaata', label: 'Khaata (Credit)' },
  { value: 'partial', label: 'Partial' },
]

function getRatePerGram(rateObj) {
  if (!rateObj) return 0
  const rate = rateObj.rate || 0
  return rateObj.unit === 'tola' ? rate / 11.664 : rate
}

const LoosePOS = () => {
  const navigate = useNavigate()
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [paymentType, setPaymentType] = useState('cash')
  const [cashAmount, setCashAmount] = useState('')
  const [khaataAmount, setKhaataAmount] = useState('')
  const [actualAmountReceived, setActualAmountReceived] = useState('')
  const [tolerance, setTolerance] = useState(15)
  const [settings, setSettings] = useState({})
  const [rates, setRates] = useState({ gold: null, silver: null })
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [diamondVatInfo, setDiamondVatInfo] = useState(null)
  const DIAMOND_VAT_THRESHOLD = 4900000

  useEffect(() => {
    getDiamondVatStatus()
      .then((res) => setDiamondVatInfo(res.data?.data || res.data || null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    getSettings().then((s) => {
      if (s?.looseWeightTolerancePercent) setTolerance(Number(s.looseWeightTolerancePercent))
      setSettings(s || {})
    }).catch(() => {})
  }, [])

  useEffect(() => {
    getLatestRates().then((res) => {
      const d = res.data?.data || res.data
      if (d?.gold || d?.silver) setRates({ gold: d.gold || null, silver: d.silver || null })
    }).catch(() => {})
  }, [])

  const effectiveGoldRate = applyTransportRate(rates.gold, getTransportCharges().gold)
  const effectiveSilverRate = applyTransportRate(rates.silver, getTransportCharges().silver)

  const getRateForLot = (lot) => {
    const metal = (lot.metalType || '').toLowerCase()
    if (metal === 'gold') return getRatePerGram(effectiveGoldRate)
    if (metal === 'silver') return getRatePerGram(effectiveSilverRate)
    return 0
  }

  const fetchLots = useCallback(async () => {
    setLoading(true)
    try {
      const params = { status: 'active', limit: 500 }
      if (search) params.search = search
      const res = await getLooseLots(params)
      const data = res.data?.data || res.data || []
      setLots(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load loose lots')
      setLots([])
    } finally {
      setLoading(false)
    }
  }, [search])
  const fetchLotsDebounced = useCallback(() => {
    const t = setTimeout(fetchLots, 250)
    return () => clearTimeout(t)
  }, [fetchLots])
  useEffect(fetchLotsDebounced, [fetchLotsDebounced])

  const searchCustomers = useCallback(async (query) => {
    if (!query || query.length < 1) { setCustomerResults([]); return }
    try {
      const res = await getCustomers({ search: query, limit: 10 })
      const data = res.data?.data || res.data?.customers || res.data || []
      setCustomerResults(Array.isArray(data) ? data : [])
    } catch { setCustomerResults([]) }
  }, [])

  const addToCart = (lot) => {
    if (lot.status !== 'active' || lot.remainingPieces <= 0) {
      toast.error(`Lot ${lot.lotBarcode} has no stock`)
      return
    }
    setCart((prev) => {
      if (prev.some((c) => c.lot._id === lot._id)) return prev
      const ratePerGram = getRateForLot(lot)
      return [...prev, {
        lot,
        pieces: 1,
        actualWeight: lot.avgWeightPerPiece || 0,
        weightSource: 'average',
        makingCharge: Number(lot.makingChargeValue) || 0,
        wastagePercent: 0,
        ratePerGram,
        overrideReason: '',
        managerApproved: false,
      }]
    })
  }

  const handleScan = useCallback(
    async (barcode) => {
      try {
        const res = await getLooseLotByBarcode(barcode)
        const lot = res.data?.data || res.data
        if (lot?._id) {
          toast.success(`Scanned lot: ${lot.lotBarcode}`)
          addToCart(lot)
        }
      } catch {
        toast.error(`Loose lot not found for barcode: ${barcode}`)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addToCart],
  )
  useBarcodeScanner(handleScan)

  const updateCartField = (lotId, field, value) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.lot._id !== lotId) return c
        const next = { ...c, [field]: value }
        if (field === 'pieces') {
          const avg = c.lot.avgWeightPerPiece || 0
          next.actualWeight = Number((avg * Number(value || 0)).toFixed(4))
          next.weightSource = 'average'
          next.overrideReason = ''
          next.managerApproved = false
        }
        return next
      }),
    )
  }

  const updateQty = (lotId, delta) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.lot._id !== lotId) return c
          const pieces = Math.min(c.lot.remainingPieces, Math.max(1, c.pieces + delta))
          return { ...c, pieces, actualWeight: Number(((c.lot.avgWeightPerPiece || 0) * pieces).toFixed(4)), weightSource: 'average', overrideReason: '', managerApproved: false }
        })
        .filter((c) => c.pieces > 0),
    )
  }

  const removeFromCart = (lotId) => setCart((prev) => prev.filter((c) => c.lot._id !== lotId))

  const lineTotal = (c) => {
    const metalValue = Number(c.actualWeight || 0) * Number(c.ratePerGram || 0) * ((c.lot.purity || 0) / 1000)
    const wastageAmt = metalValue * ((Number(c.wastagePercent) || 0) / 100)
    return Number((metalValue + wastageAmt + Number(c.makingCharge || 0)).toFixed(2))
  }

  const buildPreviewItems = () => {
    const GRAMS_PER_TOLA = 11.664
    return cart.map((c, idx) => {
      const lot = c.lot
      const metal = lot.metalType ? lot.metalType.charAt(0).toUpperCase() + lot.metalType.slice(1) : ''
      const karat = lot.karat ? `${lot.karat}K` : ''
      const type = [metal, karat].filter(Boolean).join(' ') || '-'
      const purity = Number(lot.purity || 0)
      const purityPercent = purity > 0 ? Number(((purity / 1000) * 100).toFixed(2)) : '-'
      const weight = Number(c.actualWeight || 0)
      const ratePerGram = Number(c.ratePerGram || 0)
      const tolaRate = Math.round(ratePerGram * GRAMS_PER_TOLA)
      const makingCharge = Number(c.makingCharge || 0)
      const totalAmount = lineTotal(c)
      return {
        sn: idx + 1,
        hsCode: lot.hsCode || '',
        itemName: lot.itemName || lot.designCode || '-',
        type,
        purity: purityPercent,
        grossWeight: fmtWt(weight),
        lessWeight: fmtWt(0),
        netWeight: fmtWt(weight),
        wastage: Number(c.wastagePercent) > 0 ? `${Number(c.wastagePercent)}%` : '',
        totalWeight: fmtWt(weight),
        rate: ratePerGram > 0 ? `${ratePerGram.toFixed(3)} (${tolaRate})` : '',
        makingCharge: fmtMoney(makingCharge),
        other: fmtMoney(0),
        diamondWt: '',
        diamondAmount: '',
        stoneWt: '',
        stoneAmount: '',
        totalAmount: fmtMoney(totalAmount),
        _total: totalAmount,
      }
    })
  }

  const deviationOf = (c) => {
    const expected = Number(c.lot.avgWeightPerPiece || 0) * Number(c.pieces || 0)
    if (!expected) return 0
    return Number(((Math.abs(Number(c.actualWeight || 0) - expected) / expected) * 100).toFixed(2))
  }

  const subtotal = cart.reduce((s, c) => s + lineTotal(c), 0)
  const diamondSubtotal = cart
    .filter((c) => (c.lot.metalType || '').toLowerCase() === 'diamond')
    .reduce((s, c) => s + lineTotal(c), 0)
  const nonDiamondSubtotal = subtotal - diamondSubtotal

  const feeRate = 0.5
  const annualDiamondSales = Number(diamondVatInfo?.annualDiamondSales) || 0
  const diamondTaxRate = annualDiamondSales + diamondSubtotal > DIAMOND_VAT_THRESHOLD ? 13 : feeRate
  let discount = 0
  let received = Number(actualAmountReceived) || 0
  const rawSubtotalTaxable = nonDiamondSubtotal
  const feeAmount = Number((rawSubtotalTaxable * feeRate / 100).toFixed(2))
  const diamondTaxAmount = Number((diamondSubtotal * diamondTaxRate / 100).toFixed(2))
  const totalTaxAmount = Number((feeAmount + diamondTaxAmount).toFixed(2))
  let rawTotal = Number((subtotal + totalTaxAmount).toFixed(2))
  let billTotal = Math.floor(rawTotal)
  if (received > 0 && received < billTotal) {
    discount = Number((billTotal - received).toFixed(2))
    billTotal = Math.floor(received)
  }
  const changeDue = received > 0 ? Number((received - billTotal).toFixed(2)) : 0

  const customerRequired = paymentType === 'khaata' || paymentType === 'partial'

  const ensureCustomer = async () => {
    if (selectedCustomer) return selectedCustomer._id
    const name = customerName.trim()
    const phone = customerPhone.trim()
    if (!name || !phone) return null
    try {
      const res = await getCustomers({ search: phone, limit: 5 })
      const list = res.data?.data || res.data?.customers || res.data || []
      const match = (Array.isArray(list) ? list : []).find((c) => c.phone === phone)
      if (match) return match._id
      const created = await createCustomer({ name, phone, address: customerAddress.trim() })
      return created.data?.data?._id || created.data?._id || null
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save customer details')
      return null
    }
  }

  const handleCompleteSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    if (customerRequired && !selectedCustomer && (!customerName.trim() || !customerPhone.trim())) {
      toast.error('Customer name and phone are required for khaata/partial payment'); return
    }
    if (paymentType === 'partial' && !Number(cashAmount) && !Number(khaataAmount)) {
      toast.error('Enter cash or khaata amount for partial payment'); return
    }
    const deviating = cart.filter((c) => deviationOf(c) > tolerance)
    if (deviating.some((c) => !c.overrideReason.trim() || !c.managerApproved)) {
      toast.error('Lots deviating beyond tolerance need a reason and manager approval')
      return
    }
    for (const c of cart) {
      if (c.pieces > c.lot.remainingPieces) { toast.error(`Only ${c.lot.remainingPieces} pcs left in ${c.lot.lotBarcode}`); return }
      if (Number(c.actualWeight) > c.lot.remainingWeight) { toast.error(`Only ${c.lot.remainingWeight.toFixed(3)} g left in ${c.lot.lotBarcode}`); return }
    }
    let customerId = selectedCustomer?._id || null
    if (customerId || customerName.trim() || customerPhone.trim()) {
      customerId = await ensureCustomer()
      if (customerRequired && !customerId) return
    }

    const payload = {
      lines: cart.map((c) => ({
        lotId: c.lot._id,
        piecesSold: c.pieces,
        actualWeightSold: Number(c.actualWeight),
        weightSource: c.weightSource,
        makingCharge: Number(c.makingCharge) || 0,
        wastagePercent: Number(c.wastagePercent) || 0,
        ratePerGram: Number(c.ratePerGram) || 0,
        overrideReason: c.overrideReason,
        managerApproved: c.managerApproved,
      })),
      paymentType,
      cashAmount: Number(cashAmount) || 0,
      khaataAmount: Number(khaataAmount) || 0,
      actualAmountReceived: received || null,
      discountAmount: discount,
      paidAmount: paymentType === 'cash' ? billTotal : (Number(cashAmount) || 0) + (Number(khaataAmount) || 0),
      customerId: customerId || undefined,
      taxAmount: feeAmount,
      diamondTaxAmount,
    }

    setSubmitting(true)
    try {
      const res = await createLooseBill(payload)
      toast.success('Sale completed successfully!')
      setCart([])
      setPaymentType('cash')
      setCashAmount('')
      setKhaataAmount('')
      setActualAmountReceived('')
      setSelectedCustomer(null)
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      setShowConfirm(false)
      const saleId = res.data?.data?.sale?._id || res.data?.sale?._id
      if (saleId) navigate(`/pos/loose-bill/${saleId}?print=1`)
      else navigate('/pos/sales')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to complete sale')
    } finally {
      setSubmitting(false)
    }
  }

  const goldRate = effectiveGoldRate
  const silverRate = effectiveSilverRate

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="w-full lg:w-[60%] flex flex-col">
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          {goldRate && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-yellow-600" />
              <span className="font-medium text-yellow-800">Gold:</span>
              <span className="text-yellow-900">Rs.{goldRate.rate?.toLocaleString()}/{goldRate.unit}</span>
            </div>
          )}
          {silverRate && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-700">Silver:</span>
              <span className="text-gray-800">Rs.{silverRate.rate?.toLocaleString()}/{silverRate.unit}</span>
            </div>
          )}
          <div className="ml-auto text-xs text-[var(--color-text-secondary)]">Weight tolerance: {tolerance}%</div>
        </div>
        <div className="mb-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by design code, lot barcode, name..." />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : lots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No loose lots found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {lots.map((lot) => {
                const low = lot.lowStockPiecesThreshold > 0 && lot.remainingPieces <= lot.lowStockPiecesThreshold
                return (
                  <button
                    key={lot._id}
                    onClick={() => addToCart(lot)}
                    className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-amber-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{lot.itemName || lot.designCode || 'Loose item'}</p>
                        <p className="font-mono text-xs text-gray-500">{lot.lotBarcode}</p>
                      </div>
                      <Layers className="h-4 w-4 shrink-0 text-gray-300" />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {lot.designCode || '—'} · {lot.metalType} / {lot.purity}
                    </p>
                    <div className="mt-2 space-y-0.5">
                      <p className={`text-sm font-bold ${low ? 'text-amber-600' : 'text-gray-900'}`}>
                        {lot.remainingPieces} pcs left
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatWeight(lot.remainingWeight)} · avg {lot.avgWeightPerPiece} g/pc
                      </p>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-amber-700">
                      {getRateForLot(lot) ? `Rs. ${Math.round(getRateForLot(lot))}/g` : 'No rate'}
                    </p>
                    {low && <p className="mt-1 text-[10px] font-medium text-amber-600">Low stock</p>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-[40%] bg-white rounded-xl border border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Cart ({cart.length})
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Cart is empty</p>
              <p className="text-xs text-gray-300 mt-1">Scan or tap a lot to add it</p>
            </div>
          ) : (
            cart.map((c) => {
              const dev = deviationOf(c)
              const expected = Number((c.lot.avgWeightPerPiece || 0) * c.pieces).toFixed(4)
              const deviates = dev > tolerance
              return (
                <div key={c.lot._id} className="p-3 rounded-lg border border-gray-200 bg-white space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.lot.itemName || c.lot.designCode || 'Loose item'}</p>
                      <p className="text-xs text-gray-400">{c.lot.lotBarcode} · {formatWeight(c.lot.remainingWeight)} left</p>
                    </div>
                    <button onClick={() => removeFromCart(c.lot._id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-gray-500">Pieces (max {c.lot.remainingPieces})</label>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(c.lot._id, -1)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Minus className="h-3 w-3" /></button>
                        <input
                          type="number"
                          min="1"
                          max={c.lot.remainingPieces}
                          value={c.pieces}
                          onChange={(e) => updateCartField(c.lot._id, 'pieces', Math.max(1, Math.min(c.lot.remainingPieces, Math.floor(Number(e.target.value) || 1))))}
                          className="w-14 rounded border border-gray-200 px-2 py-1 text-center"
                        />
                        <button onClick={() => updateQty(c.lot._id, 1)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-500">Rate / g</label>
                      <input type="number" value={Math.round(c.ratePerGram)} onChange={(e) => updateCartField(c.lot._id, 'ratePerGram', Number(e.target.value))} className="w-full rounded border border-gray-200 px-2 py-1" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-gray-500">Actual Weight (g) <span className="text-gray-400">— expected {expected} g</span></label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={c.actualWeight}
                          onChange={(e) => updateCartField(c.lot._id, 'actualWeight', Number(e.target.value))}
                          onFocus={() => updateCartField(c.lot._id, 'weightSource', 'manual_weighed')}
                          className="w-full rounded border border-gray-200 px-2 py-1"
                        />
                        <select
                          value={c.weightSource}
                          onChange={(e) => updateCartField(c.lot._id, 'weightSource', e.target.value)}
                          className="rounded border border-gray-200 px-1 py-1 bg-white"
                        >
                          <option value="average">Avg</option>
                          <option value="manual_weighed">Weighed</option>
                        </select>
                      </div>
                      {deviates && (
                        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 space-y-1.5">
                          <p className="flex items-center gap-1 text-xs font-semibold text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" /> Deviates {dev}% from expected — exceeds {tolerance}% tolerance
                          </p>
                          <input
                            value={c.overrideReason}
                            onChange={(e) => updateCartField(c.lot._id, 'overrideReason', e.target.value)}
                            placeholder="Reason for variance"
                            className="w-full rounded border border-amber-300 px-2 py-1 text-xs"
                          />
                          <label className="flex items-center gap-1.5 text-xs text-amber-800">
                            <input
                              type="checkbox"
                              checked={c.managerApproved}
                              onChange={(e) => updateCartField(c.lot._id, 'managerApproved', e.target.checked)}
                            />
                            Manager approved
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="text-gray-500">Making Charge</label>
                      <input type="number" value={c.makingCharge} onChange={(e) => updateCartField(c.lot._id, 'makingCharge', Number(e.target.value))} className="w-full rounded border border-gray-200 px-2 py-1" />
                    </div>
                    <div>
                      <label className="text-gray-500">Wastage %</label>
                      <input type="number" step="0.1" min="0" value={c.wastagePercent} onChange={(e) => updateCartField(c.lot._id, 'wastagePercent', Number(e.target.value))} className="w-full rounded border border-gray-200 px-2 py-1" />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5 pt-1 border-t border-gray-100">
                    <div className="flex justify-between"><span>Metal Value</span><span>{formatCurrency(Number(c.actualWeight || 0) * Number(c.ratePerGram || 0) * ((c.lot.purity || 0) / 1000))}</span></div>
                    {Number(c.wastagePercent) > 0 && <div className="flex justify-between"><span>Wastage ({Number(c.wastagePercent)}%)</span><span>{formatCurrency(Number(c.actualWeight || 0) * Number(c.ratePerGram || 0) * ((c.lot.purity || 0) / 1000) * (Number(c.wastagePercent) / 100))}</span></div>}
                    <div className="flex justify-between"><span>Making Charge</span><span>{formatCurrency(Number(c.makingCharge) || 0)}</span></div>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100">
                    <span>Line Total</span>
                    <span>{formatCurrency(lineTotal(c))}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="space-y-1 pb-2 border-b border-gray-100">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Service Fee ({feeRate}%)</span>
              <span>{formatCurrency(feeAmount)}</span>
            </div>
            {diamondSubtotal > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Diamond {diamondTaxRate >= 13 ? 'VAT' : 'Service Fee'} ({diamondTaxRate}%)</span>
                <span>{formatCurrency(diamondTaxAmount)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between items-center text-sm text-green-600">
                <span>Discount</span>
                <span>- {formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-900">Grand Total</span>
              <span className="text-xl font-bold text-amber-700">{formatCurrency(billTotal)}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
              {PAYMENT_TYPES.map((pt) => (<option key={pt.value} value={pt.value}>{pt.label}</option>))}
            </select>
          </div>
          {paymentType !== 'khaata' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Actual Amount Received</label>
              <input
                type="number"
                value={actualAmountReceived}
                onChange={(e) => setActualAmountReceived(e.target.value)}
                placeholder={`Bill ${formatCurrency(billTotal)}`}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {discount > 0 && <p className="text-xs text-green-600 font-medium mt-1">Discount applied: {formatCurrency(discount)}</p>}
              {changeDue > 0 && <p className="text-xs text-green-600 font-medium mt-1">Change due: {formatCurrency(changeDue)}</p>}
            </div>
          )}
          {paymentType === 'cash' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cash Amount</label>
              <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Cash amount" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          )}
          {paymentType === 'khaata' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Credit Amount</label>
              <input type="number" value={khaataAmount} onChange={(e) => setKhaataAmount(e.target.value)} placeholder="Credit amount" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          )}
          {paymentType === 'partial' && (
            <div className="space-y-2">
              <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Cash amount" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input type="number" value={khaataAmount} onChange={(e) => setKhaataAmount(e.target.value)} placeholder="Khaata amount" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">Customer (optional)</label>
            <div className="relative">
              <input
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setShowCustomerModal(true) }}
                onBlur={() => setTimeout(() => setShowCustomerModal(false), 200)}
                onFocus={() => { setShowCustomerModal(true); if (customerSearch) searchCustomers(customerSearch) }}
                placeholder="Search existing customer..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {showCustomerModal && customerResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button key={c._id} type="button" onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setCustomerName(c.name); setCustomerPhone(c.phone || ''); setCustomerAddress(c.address || ''); setShowCustomerModal(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      {c.name} - {c.phone}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input value={customerName} onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomer(null) }} placeholder="Customer name" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setSelectedCustomer(null) }} placeholder="Phone number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input value={customerAddress} onChange={(e) => { setCustomerAddress(e.target.value); setSelectedCustomer(null) }} placeholder="Address" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={() => setShowPreview(true)} disabled={cart.length === 0}>
              Preview Bill
            </Button>
            <Button className="flex-1" onClick={() => setShowConfirm(true)} disabled={cart.length === 0}>
              Complete Sale
            </Button>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setShowPreview(false)}>
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #loose-bill-print, #loose-bill-print * { visibility: visible !important; }
              #loose-bill-print { position: absolute !important; left: 0; top: 0; width: 100%; }
            }
          `}</style>
          <div className="bg-white text-black w-full max-w-[1050px] my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Bill Preview</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700">
                  Print Bill
                </button>
                <button onClick={() => setShowPreview(false)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-100">
                  Close
                </button>
              </div>
            </div>
            <div id="loose-bill-print">
              {(() => {
                const previewItems = buildPreviewItems()
                const previewSubtotal = subtotal
                const previewTaxLines = [
                  ...(feeAmount > 0 ? [{ name: 'Service Fee', rate: feeRate, amount: feeAmount }] : []),
                  ...(diamondTaxAmount > 0 ? [{ name: diamondTaxRate >= 13 ? 'VAT (Diamond)' : 'Service Fee (Diamond)', rate: diamondTaxRate, amount: diamondTaxAmount }] : []),
                ]
                const previewTotalTax = Number((feeAmount + diamondTaxAmount).toFixed(2))
                const previewRawTotal = Number((previewSubtotal + previewTotalTax - discount).toFixed(2))
                const previewGrandTotal = Math.floor(previewRawTotal)
                const previewWords = `${numberToWords(previewGrandTotal)} only`
                const now = new Date()
                const dateAD = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const dateBS = getBSDate(now)
                const dateTime = `${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`

                return (
                  <InvoiceDocument
                    logoUrl={settings.logoUrl || ''}
                    companyName={settings.storeName || 'My Jewellery Store'}
                    tagline="AN EXCLUSIVE GOLD & DIAMOND JEWELLERY SHOWROOM"
                    address={settings.address || ''}
                    phone={settings.phone || ''}
                    panNumber={settings.panNumber || ''}
                    invoiceNumber="DRAFT"
                    dateAD={dateAD}
                    dateBS={dateBS}
                    dateTime={`${dateAD}-${dateTime}`}
                    title="Loose Items Bill"
                    customerName={selectedCustomer?.name || customerName || 'Walk-in Customer'}
                    customerPhone={selectedCustomer?.phone || customerPhone || ''}
                    customerAddress={selectedCustomer?.address || customerAddress || ''}
                    customerCode={selectedCustomer?.customerCode || ''}
                    customerPan=""
                    salesPerson=""
                    items={previewItems}
                    words={previewWords}
                    subtotal={previewSubtotal}
                    discount={discount}
                    taxableAmount={Number((previewSubtotal - discount).toFixed(2))}
                    totalTax={previewTotalTax}
                    taxLines={previewTaxLines}
                    grandTotal={previewGrandTotal}
                    paymentType={paymentType}
                    paidAmount={paymentType === 'cash' ? previewGrandTotal : (Number(cashAmount) || 0) + (Number(khaataAmount) || 0)}
                    oldGoldWeight=""
                    oldGoldAmount={0}
                    oldGoldPurity=""
                    oldGoldDeductionPercent=""
                    cashier=""
                  />
                )
              })()}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleCompleteSale}
        title="Complete Sale"
        message={
          <div className="text-sm">
            <p>Are you sure you want to complete this loose-items sale?</p>
            <div className="mt-2 space-y-0.5 text-right">
              <div><span className="font-medium">Subtotal:</span> {formatCurrency(subtotal)}</div>
              <div><span className="font-medium">Service Fee ({feeRate}%):</span> {formatCurrency(feeAmount)}</div>
              {diamondSubtotal > 0 && <div><span className="font-medium">Diamond {diamondTaxRate >= 13 ? 'VAT' : 'Service Fee'} ({diamondTaxRate}%):</span> {formatCurrency(diamondTaxAmount)}</div>}
              {discount > 0 && <div className="text-green-600"><span className="font-medium">Discount:</span> -{formatCurrency(discount)}</div>}
              <div className="font-bold pt-1 border-t"><span className="font-medium">Bill Total:</span> {formatCurrency(billTotal)}</div>
            </div>
          </div>
        }
        confirmText={submitting ? 'Processing...' : 'Complete Sale'}
        variant="primary"
      />
    </div>
  )
}

export default LoosePOS
