import { useState, useEffect, useCallback, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { X, Plus, Minus, ShoppingCart, Package, TrendingUp, Printer, Layers, AlertTriangle } from 'lucide-react'
import { getItems, getItemByBarcode } from '../../services/itemService'
import { getLooseLots, getLooseLotByBarcode } from '../../services/looseLotService'
import { getCustomers, createCustomer } from '../../services/customerService'
import { getUsers } from '../../services/userService'
import { getLatestRates } from '../../services/rateService'
import { checkoutSale, getDiamondVatStatus } from '../../services/posService'
import { getSettings, getCachedSettings } from '../../services/settingsService'
import { AuthContext } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import SearchInput from '../../components/ui/SearchInput'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import InvoiceDocument from '../../components/invoice/InvoiceDocument'
import { buildInvoiceItems, getBSDate, fmtMoney, fmtWt, GRAMS_PER_TOLA } from '../../components/invoice/invoiceUtils'
import { formatCurrency, formatDate, formatWeight, formatWeightLaal, getImageSrc, numberToWords, applyTransportRate, getTransportCharges } from '../../utils/helpers'
import useBarcodeScanner from '../../hooks/useBarcodeScanner'

const PAYMENT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'khaata', label: 'Khaata (Credit)' },
  { value: 'partial', label: 'Partial' },
  { value: 'oldGoldExchange', label: 'Old Gold Exchange' },
]

const OLD_GOLD_KARAT_OPTIONS = [
  { value: '24', label: '24K' },
  { value: '22', label: '22K' },
  { value: '21', label: '21K' },
  { value: '18', label: '18K' },
  { value: '14', label: '14K' },
  { value: '10', label: '10K' },
]

const OLD_GOLD_PURITY_OPTIONS = [
  { value: '999', label: '999' },
  { value: '995', label: '995' },
  { value: '916', label: '916' },
  { value: '875', label: '875' },
  { value: '750', label: '750' },
  { value: '585', label: '585' },
  { value: '375', label: '375' },
]

const OLD_GOLD_KARAT_TO_PURITY = {
  '24': '999',
  '22': '916',
  '21': '875',
  '18': '750',
  '14': '585',
  '10': '375',
}

const OLD_GOLD_PURITY_TO_KARAT = {
  '999': '24',
  '995': '24',
  '916': '22',
  '875': '21',
  '750': '18',
  '585': '14',
  '375': '10',
}

function getRatePerGram(rateObj) {
  if (!rateObj) return 0
  const rate = rateObj.rate || 0
  return rateObj.unit === 'tola' ? rate / 11.664 : rate
}

function calcItemTotal(item, makingCharge, wastagePercent, ratePerGram, stonePrice) {
  const netWeight = item.netMetalWeight || item.grossWeight || 0
  const purity = item.purity || 0
  const metalValue = netWeight * ratePerGram * (purity / 1000)
  const wastageAmt = metalValue * (wastagePercent / 100)
  return metalValue + makingCharge + wastageAmt + (stonePrice || 0)
}

function lotLineTotal(c) {
  const metalValue = Number(c.actualWeight || 0) * Number(c.ratePerGram || 0) * ((c.lot.purity || 0) / 1000)
  return Number((metalValue + Number(c.makingCharge || 0)).toFixed(2))
}

function deviationOf(c) {
  const expected = Number(c.lot.avgWeightPerPiece || 0) * Number(c.pieces || 0)
  if (!expected) return 0
  return Number(((Math.abs(Number(c.actualWeight || 0) - expected) / expected) * 100).toFixed(2))
}

const POS = ({ mode = 'standard' }) => {
  const isDiamondMode = mode === 'diamond'
  const navigate = useNavigate()
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [showHoldDialog, setShowHoldDialog] = useState(false)
  const [completedSaleId, setCompletedSaleId] = useState(null)
  const [heldBills, setHeldBills] = useState([])
  const [diamondModalItem, setDiamondModalItem] = useState(null)
  const [diamondValue, setDiamondValue] = useState('')
  const [activeTab, setActiveTab] = useState('items')
  const [tolerance, setTolerance] = useState(15)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('heldBills') || '[]')
      setHeldBills(Array.isArray(saved) ? saved : [])
    } catch {
      setHeldBills([])
    }
  }, [])
  useEffect(() => {
    getSettings().then((s) => {
      if (s?.looseWeightTolerancePercent) setTolerance(Number(s.looseWeightTolerancePercent))
    }).catch(() => {})
  }, [])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [lots, setLots] = useState([])
  const [lotsLoading, setLotsLoading] = useState(false)
   const [search, setSearch] = useState('')
   const [categoryFilter, setCategoryFilter] = useState('')
   const [subcategoryFilter, setSubcategoryFilter] = useState('')
   const [metalFilter, setMetalFilter] = useState('')
  const [categories, setCategories] = useState([])
  const [metalTypes, setMetalTypes] = useState([])
  const [rates, setRates] = useState({ gold: null, silver: null })
  const [cart, setCart] = useState([])
  const [paymentType, setPaymentType] = useState('cash')
  const [cashAmount, setCashAmount] = useState('')
  const [khaataAmount, setKhaataAmount] = useState('')
  const [actualAmountReceived, setActualAmountReceived] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [cashierName, setCashierName] = useState('')
  const [cashierOptions, setCashierOptions] = useState([])
  const [oldGoldWeight, setOldGoldWeight] = useState('')
  const [oldGoldKarat, setOldGoldKarat] = useState('24')
  const [oldGoldPurity, setOldGoldPurity] = useState('999')
  const [oldGoldDeductionPercent, setOldGoldDeductionPercent] = useState('')
  const [oldGoldActualValue, setOldGoldActualValue] = useState('')
  const [oldGoldCash, setOldGoldCash] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [diamondVatInfo, setDiamondVatInfo] = useState(null)

  useEffect(() => {
    getDiamondVatStatus()
      .then((res) => setDiamondVatInfo(res.data?.data || res.data || null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    getUsers({ limit: 500 })
      .then((res) => {
        const data = res.data?.data || res.data
        const list = data?.users || data || []
        if (Array.isArray(list)) {
          setCashierOptions(list.map((u) => u.name).filter(Boolean))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    getLatestRates().then((res) => {
      const d = res.data?.data || res.data
      if (d?.gold || d?.silver) setRates({ gold: d.gold || null, silver: d.silver || null })
    }).catch(() => {})
  }, [])
  const DIAMOND_VAT_THRESHOLD = 4900000

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (isDiamondMode) params.diamond = true
      if (search) params.search = search
       if (categoryFilter) params.category = categoryFilter
       if (subcategoryFilter) params.subcategory = subcategoryFilter
       if (metalFilter) params.metalType = metalFilter
      params.itemType = 'tagged'
      params.status = 'In Stock'
      params.limit = 500
      const res = await getItems(params)
      const data = res.data?.data || res.data?.items || res.data || []
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load items')
      setItems([])
    } finally {
      setLoading(false)
    }
   }, [search, categoryFilter, subcategoryFilter, metalFilter, isDiamondMode])
  useEffect(() => { fetchItems() }, [fetchItems])
   useEffect(() => {
     if (items.length > 0) {
       const cats = [...new Set(items.map((i) => i.category).filter(Boolean))]
       const metals = [...new Set(items.map((i) => i.metalType).filter(Boolean))]
       if (cats.length) setCategories(cats)
       if (metals.length) setMetalTypes(metals)
     }
     setSubcategoryFilter('')
   }, [items])
   const subcategoryOptions = categoryFilter
     ? [...new Set(items.filter((i) => i.category === categoryFilter && i.subcategory).map((i) => i.subcategory))]
     : []

  const fetchLots = useCallback(async () => {
    if (activeTab !== 'lots') return
    setLotsLoading(true)
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
      setLotsLoading(false)
    }
  }, [activeTab, search])
  useEffect(() => {
    const t = setTimeout(fetchLots, 250)
    return () => clearTimeout(t)
  }, [fetchLots])

  const searchCustomers = useCallback(async (query) => {
    if (!query || query.length < 1) { setCustomerResults([]); return }
    try {
      const res = await getCustomers({ search: query, limit: 10 })
      const data = res.data?.data || res.data?.customers || res.data || []
      setCustomerResults(Array.isArray(data) ? data : [])
    } catch { setCustomerResults([]) }
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch) searchCustomers(customerSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch, searchCustomers])

  const effectiveGoldRate = applyTransportRate(rates.gold, getTransportCharges().gold)
  const effectiveSilverRate = applyTransportRate(rates.silver, getTransportCharges().silver)
  const goldPerGram = getRatePerGram(effectiveGoldRate)
  const silverPerGram = getRatePerGram(effectiveSilverRate)

  const getRateForMetal = (metalType) => {
    const metal = (metalType || '').toLowerCase()
    if (metal === 'gold') return goldPerGram
    if (metal === 'silver') return silverPerGram
    return 0
  }

  const addToCart = (item) => {
    setCart((prev) => {
      if (prev.some((c) => c.source === 'item' && c.item._id === item._id)) return prev
      const ratePerGram = getRateForMetal(item.metalType)
      return [...prev, {
        source: 'item',
        item,
        qty: 1,
        makingCharge: Number(item.sellingMakingCharge || item.makingCharge) || 0,
        wastagePercent: Number(item.sellingWastagePercent || item.wastagePercent) || 0,
        stonePrice: Number(item.sellingStonePrice || item.stonePrice) || 0,
        ratePerGram,
      }]
    })
    toast.success(`${item.itemName || item.name} added to cart`)
  }

  const addLotToCart = (lot) => {
    if (lot.status !== 'active' || lot.remainingPieces <= 0) {
      toast.error(`Lot ${lot.lotBarcode} has no stock`)
      return
    }
    setCart((prev) => {
      if (prev.some((c) => c.source === 'lot' && c.lot._id === lot._id)) return prev
      const ratePerGram = getRateForMetal(lot.metalType)
      return [...prev, {
        source: 'lot',
        lot,
        pieces: 1,
        actualWeight: lot.avgWeightPerPiece || 0,
        weightSource: 'average',
        makingCharge: Number(lot.makingChargeValue) || 0,
        ratePerGram,
        overrideReason: '',
        managerApproved: false,
      }]
    })
  }

  const hasDiamond = (item) => (item?.metalType || '').toLowerCase() === 'diamond' || (item?.stoneType || '') === 'diamond'

  const isDiamondLine = (c) => (c.source === 'lot' ? (c.lot.metalType || '').toLowerCase() === 'diamond' : hasDiamond(c.item))

  const handleAddItem = (item) => {
    if (isDiamondMode) {
      setDiamondValue(item.sellingStonePrice || item.stonePrice || '')
      setDiamondModalItem(item)
      return
    }
    addToCart(item)
  }

  const confirmDiamondAdd = () => {
    if (!diamondModalItem) return
    const value = Number(diamondValue)
    if (!value || value <= 0) {
      toast.error('Enter the diamond value')
      return
    }
    const item = diamondModalItem
    setCart((prev) => {
      if (prev.some((c) => c.source === 'item' && c.item._id === item._id)) return prev
      return [...prev, {
        source: 'item',
        item,
        qty: 1,
        makingCharge: Number(item.sellingMakingCharge || item.makingCharge) || 0,
        wastagePercent: Number(item.sellingWastagePercent || item.wastagePercent) || 0,
        stonePrice: value,
        ratePerGram: getRateForMetal(item.metalType),
      }]
    })
    setDiamondModalItem(null)
    setDiamondValue('')
    toast.success(`${item.itemName || item.name} added to cart`)
  }

  const handleScan = useCallback(
    async (barcode) => {
      try {
        const res = await getItemByBarcode(barcode)
        const item = res.data?.data || res.data
        if (item?._id) {
          toast.success(`Scanned: ${item.itemName || item.name}`)
          handleAddItem(item)
          return
        }
      } catch { /* not a tagged item */ }
      try {
        const res = await getLooseLotByBarcode(barcode)
        const lot = res.data?.data || res.data
        if (lot?._id) {
          toast.success(`Scanned lot: ${lot.lotBarcode}`)
          addLotToCart(lot)
          return
        }
      } catch { /* not a loose lot */ }
      toast.error(`No item or loose lot found for barcode: ${barcode}`)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleAddItem, addLotToCart],
  )
  useBarcodeScanner(handleScan)

  const updateCartField = (id, field, value) => {
    setCart((prev) => prev.map((c) => {
      if (c.item?._id !== id && c.lot?._id !== id) return c
      const next = { ...c, [field]: value }
      if (field === 'pieces') {
        const avg = c.lot.avgWeightPerPiece || 0
        next.actualWeight = Number((avg * Number(value || 0)).toFixed(4))
        next.weightSource = 'average'
        next.overrideReason = ''
        next.managerApproved = false
      }
      return next
    }))
  }

  const updateQty = (id, delta) => {
    setCart((prev) => prev
      .map((c) => {
        if (c.item?._id !== id && c.lot?._id !== id) return c
        if (c.source === 'lot') {
          const pieces = Math.min(c.lot.remainingPieces, Math.max(1, c.pieces + delta))
          return { ...c, pieces, actualWeight: Number(((c.lot.avgWeightPerPiece || 0) * pieces).toFixed(4)), weightSource: 'average', overrideReason: '', managerApproved: false }
        }
        return { ...c, qty: Math.max(1, c.qty + delta) }
      })
      .filter((c) => c.qty > 0)
    )
  }

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((c) => c.item?._id !== id && c.lot?._id !== id))
  }

  const lineSubtotal = (c) => (c.source === 'lot' ? lotLineTotal(c) : calcItemTotal(c.item, c.makingCharge, c.wastagePercent, c.ratePerGram, c.stonePrice) * c.qty)
  const cartTotal = cart.reduce((sum, c) => sum + lineSubtotal(c), 0)

  const feeRate = 0.5

  const diamondSubtotal = cart.reduce((sum, c) => (isDiamondLine(c) ? sum + lineSubtotal(c) : sum), 0)
  const nonDiamondSubtotal = cartTotal - diamondSubtotal

  // Diamonds below the annual threshold carry the 0.5% service fee; once the
  // tenant's cumulative yearly diamond sales cross Rs. 49,00,000, 13% VAT kicks
  // in. Best-effort on the frontend using the last fetched status + this cart.
  const annualDiamondSales = Number(diamondVatInfo?.annualDiamondSales) || 0
  const diamondTaxRate = annualDiamondSales + diamondSubtotal > DIAMOND_VAT_THRESHOLD ? 13 : feeRate

  // Old gold brought in for exchange is NON-taxable — the fee (0.5%) is only
  // charged on the net amount the customer actually pays for the new item.
  const oldGoldWeightNum = Number(oldGoldWeight) || 0
  const oldGoldDeductionPercentNum = Number(oldGoldDeductionPercent) || 0
  const oldGoldNetWeight = oldGoldWeightNum > 0 ? oldGoldWeightNum * (1 - oldGoldDeductionPercentNum / 100) : 0
  const oldGoldKaratNum = Number(oldGoldKarat) || 24
  const oldGoldComputedValue = oldGoldNetWeight * (oldGoldKaratNum / 24) * goldPerGram
  const oldGoldActualValueNum = Number(oldGoldActualValue) || 0
  const oldGoldValue = oldGoldActualValueNum > 0 ? oldGoldActualValueNum : oldGoldComputedValue

  // Taxes: the 0.5% service fee is charged on the FULL gold value sold (old
  // gold traded in does NOT reduce the taxable base), and diamonds carry 13%
  // VAT (the service fee does not apply to them). A discount is split
  // proportionally across diamond / non-diamond before either tax is applied.
  const computeTax = (discount) => {
    const d = Math.max(0, Number(discount) || 0)
    const diamondShare = cartTotal > 0 ? d * (diamondSubtotal / cartTotal) : 0
    const nonDiamondShare = d - diamondShare
    const taxableAmount = Math.max(0, nonDiamondSubtotal - nonDiamondShare)
    const feeAmount = Number((taxableAmount * feeRate / 100).toFixed(2))
    const diamondTaxable = Math.max(0, diamondSubtotal - diamondShare)
    const diamondTaxAmount = Number((diamondTaxable * diamondTaxRate / 100).toFixed(2))
    const totalTaxAmount = Number((feeAmount + diamondTaxAmount).toFixed(2))
    const totalTaxable = Number((taxableAmount + diamondTaxable).toFixed(2))
    const rawTotal = Number((taxableAmount + feeAmount + diamondTaxable + diamondTaxAmount).toFixed(2))
    return { taxableAmount, diamondTaxable, diamondTaxAmount, feeAmount, totalTaxAmount, totalTaxable, rawTotal }
  }

  const full = computeTax(0)
  const fullBill = Number((cartTotal + full.totalTaxAmount).toFixed(2))

  let { taxableAmount, feeAmount, diamondTaxAmount, totalTaxAmount, totalTaxable, rawTotal } = computeTax(0)
  let billTotal = Math.round(rawTotal)
  let roundOff = Number((billTotal - rawTotal).toFixed(2))

  let computedDiscount = 0
  let receivedAmount = 0
  let oldGoldCredit = 0
  let oldGoldAmountToPay = 0
  let oldGoldChange = 0
  let oldGoldCashPaid = 0

  if (paymentType === 'oldGoldExchange') {
    oldGoldCredit = Math.round(Math.min(oldGoldValue, billTotal))
    oldGoldAmountToPay = Math.max(0, billTotal - oldGoldCredit)
    oldGoldChange = Math.max(0, Math.round(oldGoldValue) - billTotal)
    oldGoldCashPaid = Number(oldGoldCash) > 0 ? Number(oldGoldCash) : oldGoldAmountToPay

    // The cashier records the actual money received from the customer. If it is
    // less than the remaining amount, the rest is treated as a discount and the
    // 0.5% fee is charged on the discounted amount.
    const actualCashReceived = Number(actualAmountReceived) || 0
    if (actualCashReceived > 0) {
      oldGoldCashPaid = actualCashReceived
    }
    if (actualCashReceived > 0 && actualCashReceived < oldGoldAmountToPay) {
      computedDiscount = Number((oldGoldAmountToPay - actualCashReceived).toFixed(2))
      const t = computeTax(computedDiscount)
      taxableAmount = t.taxableAmount
      feeAmount = t.feeAmount
      diamondTaxAmount = t.diamondTaxAmount
      totalTaxAmount = t.totalTaxAmount
      totalTaxable = t.totalTaxable
      rawTotal = t.rawTotal
      receivedAmount = oldGoldCredit + actualCashReceived
      billTotal = Math.round(receivedAmount)
      roundOff = Number((billTotal - rawTotal).toFixed(2))
      oldGoldAmountToPay = Math.max(0, billTotal - oldGoldCredit)
      oldGoldChange = Math.max(0, Math.round(oldGoldValue) - billTotal)
    } else {
      receivedAmount = oldGoldCredit + oldGoldCashPaid
    }
  } else {
    receivedAmount = Number(actualAmountReceived) || 0
    if (receivedAmount > 0 && receivedAmount < fullBill) {
      computedDiscount = Number((fullBill - receivedAmount).toFixed(2))
    }
    if (computedDiscount > 0) {
      const t = computeTax(computedDiscount)
      taxableAmount = t.taxableAmount
      feeAmount = t.feeAmount
      diamondTaxAmount = t.diamondTaxAmount
      totalTaxAmount = t.totalTaxAmount
      totalTaxable = t.totalTaxable
      rawTotal = t.rawTotal
      billTotal = Math.round(receivedAmount)
      roundOff = Number((billTotal - rawTotal).toFixed(2))
    }
  }

  const changeDue = receivedAmount > 0 ? Number((receivedAmount - billTotal).toFixed(2)) : 0

  const ensureCustomer = async () => {
    if (selectedCustomer) return selectedCustomer._id
    const name = customerName.trim()
    const phone = customerPhone.trim()
    if (!name || !phone) return null
    try {
      const res = await getCustomers({ search: phone, limit: 5 })
      const list = res.data?.data || res.data?.customers || res.data || []
      const match = (Array.isArray(list) ? list : []).find((c) => c.phone === phone)
      if (match) {
        setSelectedCustomer(match)
        return match._id
      }
      const created = await createCustomer({ name, phone, address: customerAddress.trim() })
      const newId = created.data?.data?._id || created.data?._id
      if (newId) setSelectedCustomer({ _id: newId, name, phone, address: customerAddress.trim() })
      return newId || null
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save customer details')
      return null
    }
  }

  const getPaymentBreakdown = () => {
    switch (paymentType) {
      case 'cash': return { cash: Number(cashAmount) || billTotal, khaata: 0 }
      case 'khaata': return { cash: 0, khaata: Number(khaataAmount) || cartTotal }
      case 'partial': return { cash: Number(cashAmount) || 0, khaata: Number(khaataAmount) || 0 }
      case 'oldGoldExchange': return {
        cash: oldGoldCashPaid, khaata: 0,
        oldGold: {
          weight: oldGoldWeightNum,
          purity: oldGoldKaratNum,
          deductionPercent: oldGoldDeductionPercentNum,
          netWeight: oldGoldNetWeight,
          deduction: oldGoldCredit,
          value: oldGoldValue,
          valuedAmount: oldGoldActualValueNum,
          amountToPay: oldGoldAmountToPay,
          change: oldGoldChange,
        },
      }
      default: return { cash: cartTotal, khaata: 0 }
    }
  }

  const handleCompleteSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    const customerRequired = paymentType === 'khaata' || paymentType === 'partial'
    if (customerRequired && !selectedCustomer && (!customerName.trim() || !customerPhone.trim())) {
      toast.error('Customer name and phone are required for khaata/partial payment'); return
    }
    if (paymentType === 'partial' && !Number(cashAmount) && !Number(khaataAmount)) {
      toast.error('Enter cash or khaata amount for partial payment'); return
    }
    if (paymentType === 'oldGoldExchange' && !Number(oldGoldWeight)) {
      toast.error('Enter old gold weight'); return
    }
    if (paymentType === 'oldGoldExchange' && oldGoldDeductionPercentNum >= 100) {
      toast.error('Deduction percent must be less than 100'); return
    }
    const lotLines = cart.filter((c) => c.source === 'lot')
    const deviating = lotLines.filter((c) => deviationOf(c) > tolerance)
    if (deviating.some((c) => !c.overrideReason.trim() || !c.managerApproved)) {
      toast.error('Lots deviating beyond tolerance need a reason and manager approval')
      return
    }
    for (const c of lotLines) {
      if (c.pieces > c.lot.remainingPieces) { toast.error(`Only ${c.lot.remainingPieces} pcs left in ${c.lot.lotBarcode}`); return }
      if (Number(c.actualWeight) > c.lot.remainingWeight) { toast.error(`Only ${c.lot.remainingWeight.toFixed(3)} g left in ${c.lot.lotBarcode}`); return }
    }
    let customerId = selectedCustomer?._id || null
    if (customerId || customerName.trim() || customerPhone.trim()) {
      customerId = await ensureCustomer()
      if (customerRequired && !customerId) return
    }
    const breakdown = getPaymentBreakdown()
    const payload = {
      items: cart.filter((c) => c.source === 'item').map((c) => {
        const itemTotal = calcItemTotal(c.item, c.makingCharge, c.wastagePercent, c.ratePerGram, c.stonePrice)
        return {
          item: c.item._id,
          quantity: c.qty,
          price: itemTotal,
          makingCharge: c.makingCharge,
          wastagePercent: c.wastagePercent,
          sellingMakingCharge: c.makingCharge,
          sellingWastagePercent: c.wastagePercent,
          ratePerGram: c.ratePerGram,
          stonePrice: c.stonePrice,
          metalValue: (c.item.netMetalWeight || c.item.grossWeight || 0) * c.ratePerGram * ((c.item.purity || 0) / 1000),
        }
      }),
      lotLines: lotLines.map((c) => ({
        lotId: c.lot._id,
        piecesSold: c.pieces,
        actualWeightSold: Number(c.actualWeight),
        weightSource: c.weightSource,
        makingCharge: Number(c.makingCharge) || 0,
        ratePerGram: Number(c.ratePerGram) || 0,
        overrideReason: c.overrideReason,
        managerApproved: c.managerApproved,
      })),
      paymentType,
      totalAmount: cartTotal,
      taxAmount: feeAmount,
      diamondTaxAmount,
      actualAmountReceived: receivedAmount || null,
      discountAmount: computedDiscount,
      paidAmount: paymentType === 'cash' ? billTotal : (breakdown.oldGold ? (breakdown.oldGold.deduction || 0) + (breakdown.cash || 0) : (breakdown.cash || 0)),
      cashAmount: breakdown.cash || 0,
      khaataAmount: breakdown.khaata || 0,
      customerId,
      cashierName: cashierName.trim(),
      oldGoldDetails: breakdown.oldGold ? {
        weight: breakdown.oldGold.weight,
        purity: breakdown.oldGold.purity,
        deductionPercent: breakdown.oldGold.deductionPercent,
        netWeight: breakdown.oldGold.netWeight,
        deductibleAmount: breakdown.oldGold.deduction,
        value: breakdown.oldGold.value,
        valuedAmount: breakdown.oldGold.valuedAmount,
      } : null,
    }
    setSubmitting(true)
    try {
      const res = await checkoutSale(payload)
      toast.success('Sale completed successfully!')
      setCart([])
      setPaymentType('cash')
      setCashAmount('')
      setKhaataAmount('')
      setActualAmountReceived('')
      setSelectedCustomer(null)
      setCustomerSearch('')
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      setOldGoldWeight('')
      setOldGoldKarat('24')
      setOldGoldPurity('999')
      setOldGoldDeductionPercent('')
      setOldGoldActualValue('')
      setOldGoldCash('')
      setShowConfirm(false)
      const saleId = res.data?.data?.sale?._id || res.data?.data?._id || res.data?._id
      if (saleId) {
        setCompletedSaleId(saleId)
        setShowPrintDialog(true)
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to complete sale')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePreviewBill = () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    setShowPreviewDialog(true)
  }

  const handleHoldBill = () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    const heldBill = {
      id: Date.now(),
      cart: [...cart],
      paymentType,
      cashAmount,
      khaataAmount,
      actualAmountReceived,
      customerName,
      customerPhone,
      customerAddress,
      cashierName,
      oldGoldWeight,
      oldGoldKarat,
      oldGoldPurity,
      oldGoldDeductionPercent,
      oldGoldActualValue,
      oldGoldCash,
      customerId: selectedCustomer?._id || null,
      heldAt: new Date().toISOString(),
    }
    const existing = JSON.parse(localStorage.getItem('heldBills') || '[]')
    existing.push(heldBill)
    localStorage.setItem('heldBills', JSON.stringify(existing))
    setHeldBills(existing)
    toast.success('Bill held successfully! You can resume it later.')
  }

  const handleLoadHeldBill = (heldBill) => {
    setCart(heldBill.cart || [])
    setPaymentType(heldBill.paymentType || 'cash')
    setCashAmount(heldBill.cashAmount || '')
    setKhaataAmount(heldBill.khaataAmount || '')
    setActualAmountReceived(heldBill.actualAmountReceived || '')
    setCustomerName(heldBill.customerName || '')
    setCustomerPhone(heldBill.customerPhone || '')
    setCustomerAddress(heldBill.customerAddress || '')
    setCashierName(heldBill.cashierName || user?.name || '')
    setOldGoldWeight(heldBill.oldGoldWeight || '')
    setOldGoldKarat(heldBill.oldGoldKarat || '24')
    setOldGoldPurity(heldBill.oldGoldPurity || '999')
    setOldGoldDeductionPercent(heldBill.oldGoldDeductionPercent || '')
    setOldGoldActualValue(heldBill.oldGoldActualValue || '')
    setOldGoldCash(heldBill.oldGoldCash || '')
    if (heldBill.customerId) {
      setSelectedCustomer({ _id: heldBill.customerId })
    }
    setShowHoldDialog(false)
    toast.success('Held bill loaded!')
  }

  const handleDeleteHeldBill = (id) => {
    const updated = heldBills.filter((b) => b.id !== id)
    localStorage.setItem('heldBills', JSON.stringify(updated))
    setHeldBills(updated)
    toast.success('Held bill deleted')
  }

  const handleOldGoldKaratChange = (value) => {
    setOldGoldKarat(value)
    const purity = OLD_GOLD_KARAT_TO_PURITY[value]
    if (purity) setOldGoldPurity(purity)
  }

  const handleOldGoldPurityChange = (value) => {
    setOldGoldPurity(value)
    const karat = OLD_GOLD_PURITY_TO_KARAT[value]
    if (karat) setOldGoldKarat(karat)
  }

  const { user } = useContext(AuthContext)
  useEffect(() => {
    if (user?.name && !cashierName) setCashierName(user.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])
  const buildPreviewItems = () => {
    const itemRows = buildInvoiceItems(cart.filter((c) => c.source === 'item').map((c) => ({
      item: c.item,
      qty: c.qty,
      ratePerGram: c.ratePerGram,
      makingCharge: c.makingCharge,
      wastagePercent: c.wastagePercent,
      stonePrice: c.stonePrice,
    })))
    const lotRows = cart.filter((c) => c.source === 'lot').map((c) => {
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
      const totalAmount = lotLineTotal(c)
      return {
        sn: 0,
        hsCode: lot.hsCode || '',
        itemName: lot.itemName || lot.designCode || '-',
        type,
        purity: purityPercent,
        grossWeight: fmtWt(weight),
        lessWeight: fmtWt(0),
        netWeight: fmtWt(weight),
        wastage: '',
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
    return [...itemRows, ...lotRows].map((row, i) => ({ ...row, sn: i + 1 }))
  }
  const previewItems = buildPreviewItems()
  const previewSubtotal = previewItems.reduce((sum, it) => sum + it._total, 0)
  const previewBreakdown = getPaymentBreakdown()
  const previewPaidAmount =
    paymentType === 'cash'
      ? billTotal
      : previewBreakdown.oldGold
        ? (previewBreakdown.oldGold.deduction || 0) + (previewBreakdown.cash || 0)
        : previewBreakdown.cash || 0
  const storeSettings = getCachedSettings() || {}
  const previewDate = new Date()
  const previewDateAD = formatDate(previewDate, 'd/M/yyyy')
  const previewDateBS = getBSDate(previewDate)
  const previewTime = formatDate(previewDate, 'hh:mm a')
  const previewDateTime = `${previewDateAD}-${previewTime}`
  const previewWords = `${numberToWords(billTotal)} only`
  const previewOldGold = previewBreakdown.oldGold || {}
  const previewPaymentLabel = PAYMENT_TYPES.find((p) => p.value === paymentType)?.label || paymentType

  const goldRate = effectiveGoldRate
  const silverRate = effectiveSilverRate

  const tabClass = (active) =>
    `px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
      active
        ? 'bg-amber-600 text-white border-amber-600'
        : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
    }`

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="w-full lg:w-[60%] flex flex-col">
        {isDiamondMode && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Diamond POS</p>
              <p className="text-xs text-amber-700">Tap an item to enter its diamond value at sale time</p>
            </div>
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          {goldRate && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-yellow-600" />
              <span className="font-medium text-yellow-800">Gold:</span>
              <span className="text-yellow-900">Rs.{goldRate.rate?.toLocaleString()}/{goldRate.unit}</span>
              <span className="text-yellow-600 text-xs">({formatCurrency(goldPerGram)}/g)</span>
            </div>
          )}
          {silverRate && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-700">Silver:</span>
              <span className="text-gray-800">Rs.{silverRate.rate?.toLocaleString()}/{silverRate.unit}</span>
              <span className="text-gray-500 text-xs">({formatCurrency(silverPerGram)}/g)</span>
            </div>
          )}
        </div>
        {!isDiamondMode && (
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={() => setActiveTab('items')} className={tabClass(activeTab === 'items')}>
              Tagged Items
            </button>
            <button type="button" onClick={() => setActiveTab('lots')} className={tabClass(activeTab === 'lots')}>
              Loose Lots
            </button>
          </div>
        )}
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder={activeTab === 'lots' ? 'Search by design code, lot barcode, name...' : 'Search by SKU, name, or barcode...'} />
            </div>
          </div>
          {activeTab === 'items' && (
            <div className="flex flex-wrap gap-2">
               <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setSubcategoryFilter('') }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white min-w-0 max-w-[160px]">
                 <option value="">All Categories</option>
                 {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
               </select>
               {subcategoryOptions.length > 0 && (
                 <select value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white min-w-0 max-w-[140px]">
                   <option value="">All Subcategories</option>
                   {subcategoryOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
                 </select>
               )}
              <select value={metalFilter} onChange={(e) => setMetalFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white min-w-0 max-w-[140px]">
                <option value="">All Metals</option>
                {metalTypes.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'items' && (
            loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 p-4 animate-pulse">
                    <div className="h-24 bg-gray-200 rounded-lg mb-3" />
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No items found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item) => {
                  const ratePerGram = getRateForMetal(item.metalType)
                  const netWt = item.netMetalWeight || item.grossWeight || 0
                  const purity = item.purity || 0
                  const metalValue = netWt * ratePerGram * (purity / 1000)
                  const isSold = item.status && item.status !== 'In Stock'
                  const itemHasDiamond = hasDiamond(item)
                  const displayPrice = itemHasDiamond
                    ? (item.sellingStonePrice || item.sellingPrice || item.price || 0)
                    : (ratePerGram > 0 ? metalValue : (item.sellingPrice || item.price || 0))
                  return (
                    <button key={item._id} onClick={() => !isSold && handleAddItem(item)} disabled={isSold} className={`rounded-xl border border-gray-200 bg-white p-4 text-left transition-all group ${isSold ? 'opacity-60 cursor-not-allowed' : 'hover:border-amber-300 hover:shadow-md'}`}>
                      <div className="h-24 bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                        {item.images?.[0] || item.image ? (
                          <img src={getImageSrc(item.images?.[0] || item.image)} alt={item.itemName} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-8 w-8 text-gray-300" />
                        )}
                        {itemHasDiamond && (
                          <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold">
                            Diamond
                          </span>
                        )}
                        {isSold && (
                          <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-gray-800/80 text-white text-[10px] font-semibold">
                            {item.status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-amber-600">{item.itemName || item.name}</p>
                      <p className="text-xs text-gray-500">{item.SKU || ''}</p>
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-gray-400">{item.metalType} / {item.karat ? `${item.karat}K` : ''} / {item.purity || ''}</p>
                        {netWt > 0 && <p className="text-xs text-gray-400">Net: {formatWeight(netWt)} ({formatWeightLaal(netWt)})</p>}
                        {item.stoneType && item.stoneType !== 'none' && (
                          <p className="text-xs text-gray-400">
                            Stone: {item.stoneType.charAt(0).toUpperCase() + item.stoneType.slice(1)}
                            {Number(item.stoneWeight) > 0 && ` · ${formatWeight(item.stoneWeight)}`}
                            {Number(item.carat) > 0 && ` · ${item.carat}ct`}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-bold text-amber-700 mt-1">
                        {formatCurrency(displayPrice)}
                      </p>
                      {isDiamondMode && <p className="text-[10px] text-gray-400">Tap to enter value at sale</p>}
                    </button>
                  )
                })}
              </div>
            )
          )}
          {activeTab === 'lots' && (
            lotsLoading ? (
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
                      onClick={() => addLotToCart(lot)}
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
                        {getRateForMetal(lot.metalType) ? `Rs. ${Math.round(getRateForMetal(lot.metalType))}/g` : 'No rate'}
                      </p>
                      {low && <p className="mt-1 text-[10px] font-medium text-amber-600">Low stock</p>}
                    </button>
                  )
                })}
              </div>
            )
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
              <p className="text-xs text-gray-300 mt-1">Click items or scan a barcode to add them</p>
            </div>
          ) : (
            cart.map((c) => {
              if (c.source === 'lot') {
                const dev = deviationOf(c)
                const expected = Number((c.lot.avgWeightPerPiece || 0) * c.pieces).toFixed(4)
                const deviates = dev > tolerance
                return (
                  <div key={`lot-${c.lot._id}`} className="p-3 rounded-lg border border-gray-200 bg-white space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.lot.itemName || c.lot.designCode || 'Loose item'}</p>
                        <p className="text-xs text-gray-400">{c.lot.lotBarcode} · {formatWeight(c.lot.remainingWeight)} left · <span className="text-amber-600">Loose lot</span></p>
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
                    </div>
                    <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100">
                      <span>Line Total</span>
                      <span>{formatCurrency(lineSubtotal(c))}</span>
                    </div>
                  </div>
                )
              }
              const itemTotal = calcItemTotal(c.item, c.makingCharge, c.wastagePercent, c.ratePerGram, c.stonePrice)
              const netWt = c.item.netMetalWeight || c.item.grossWeight || 0
              const metalVal = netWt * c.ratePerGram * ((c.item.purity || 0) / 1000)
              const wastageAmt = metalVal * (c.wastagePercent / 100)
              const itemHasDiamond = hasDiamond(c.item)
              return (
                <div key={`item-${c.item._id}`} className="p-3 rounded-lg border border-gray-200 bg-white space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.item.itemName || c.item.name} {itemHasDiamond && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold align-middle">Diamond</span>}</p>
                      <p className="text-xs text-gray-400">{c.item.SKU} · {c.item.metalType} · {formatWeight(netWt)} ({formatWeightLaal(netWt)})</p>
                    </div>
                    <button onClick={() => removeFromCart(c.item._id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-gray-500">Rate/g</label>
                      <input type="number" value={Math.round(c.ratePerGram)} onChange={(e) => updateCartField(c.item._id, 'ratePerGram', Number(e.target.value))} className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-gray-500">Making Charge</label>
                      <input type="number" value={c.makingCharge} onChange={(e) => updateCartField(c.item._id, 'makingCharge', Number(e.target.value))} className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-gray-500">Wastage %</label>
                      <input type="number" value={c.wastagePercent} onChange={(e) => updateCartField(c.item._id, 'wastagePercent', Number(e.target.value))} className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-gray-500">{itemHasDiamond ? 'Diamond Value' : 'Stone/Mala Price'}</label>
                      <input type="number" value={c.stonePrice} onChange={(e) => updateCartField(c.item._id, 'stonePrice', Number(e.target.value))} className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-gray-500">Qty</label>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(c.item._id, -1)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Minus className="h-3 w-3" /></button>
                        <span className="w-6 text-center text-sm font-medium">{c.qty}</span>
                        <button onClick={() => updateQty(c.item._id, 1)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5 pt-1 border-t border-gray-100">
                    <div className="flex justify-between"><span>Metal Value (×{c.qty})</span><span>{formatCurrency(metalVal * c.qty)}</span></div>
                    <div className="flex justify-between"><span>Making Charge (×{c.qty})</span><span>{formatCurrency(c.makingCharge * c.qty)}</span></div>
                    <div className="flex justify-between"><span>Wastage ({c.wastagePercent}%)</span><span>{formatCurrency(wastageAmt * c.qty)}</span></div>
                    {Number(c.stonePrice) > 0 && (
                      <div className="flex justify-between"><span>{itemHasDiamond ? 'Diamond Value' : 'Stone/Mala Price'} (×{c.qty})</span><span>{formatCurrency(c.stonePrice * c.qty)}</span></div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 pt-1"><span>Item Total</span><span>{formatCurrency(itemTotal * c.qty)}</span></div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="space-y-1 pb-2 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Subtotal</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Service Fee ({feeRate}%)</span>
              <span>{formatCurrency(feeAmount)}</span>
            </div>
            {diamondSubtotal > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Diamond {diamondTaxRate >= 13 ? 'VAT' : `Service Fee`} ({diamondTaxRate}%)</span>
                <span>{formatCurrency(diamondTaxAmount)}</span>
              </div>
            )}
            {computedDiscount > 0 && (
              <div className="flex justify-between items-center text-sm text-green-600">
                <span>Discount</span>
                <span>- {formatCurrency(computedDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>Round Off</span>
              <span>{roundOff >= 0 ? '+' : ''}{formatCurrency(roundOff)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-900">Grand Total</span>
              <span className="text-xl font-bold text-amber-700">{formatCurrency(billTotal)}</span>
            </div>
          </div>
          {paymentType !== 'oldGoldExchange' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Actual Amount Received</label>
            <input
              type="number"
              value={actualAmountReceived}
              onChange={(e) => setActualAmountReceived(e.target.value)}
              placeholder={`Enter amount received (bill ${formatCurrency(fullBill)})`}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {computedDiscount > 0 && (
              <p className="text-xs text-green-600 font-medium mt-1">
                Discount applied: {formatCurrency(computedDiscount)} — service fee charged on {formatCurrency(taxableAmount)}
              </p>
            )}
            {changeDue > 0 && (
              <p className="text-xs text-green-600 font-medium mt-1">
                Change due: {formatCurrency(changeDue)}
              </p>
            )}
          </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
              {PAYMENT_TYPES.map((pt) => (<option key={pt.value} value={pt.value}>{pt.label}</option>))}
            </select>
          </div>
          {paymentType === 'cash' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cash Amount</label>
              <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Cash amount" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              {Number(cashAmount) > billTotal && (
                <p className="text-xs text-green-600 font-medium mt-1">
                  Change due: {formatCurrency(Number(cashAmount) - billTotal)}
                </p>
              )}
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
          {paymentType === 'oldGoldExchange' && (
            <div className="space-y-2">
              <input type="number" value={oldGoldWeight} onChange={(e) => setOldGoldWeight(e.target.value)} placeholder="Old gold weight (g)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Karat</label>
                  <select value={oldGoldKarat} onChange={(e) => handleOldGoldKaratChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                    {OLD_GOLD_KARAT_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Purity</label>
                  <select value={oldGoldPurity} onChange={(e) => handleOldGoldPurityChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                    {OLD_GOLD_PURITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
              </div>
              <input type="number" value={oldGoldDeductionPercent} onChange={(e) => setOldGoldDeductionPercent(e.target.value)} placeholder="Deduction (%)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Actual Valued Price (Rs)</label>
                <input type="number" value={oldGoldActualValue} onChange={(e) => setOldGoldActualValue(e.target.value)} placeholder="Leave blank to auto-calculate from rate" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {oldGoldNetWeight > 0 && (
                <p className="text-xs text-gray-600">
                  Gold weight after {oldGoldDeductionPercentNum}% deduction: <b>{formatWeight(oldGoldNetWeight)}</b> ({oldGoldKaratNum}K pure equivalent: {formatWeight(oldGoldNetWeight * (oldGoldKaratNum / 24))}g)
                </p>
              )}
              {oldGoldValue > 0 && (
                <p className="text-xs text-green-600 font-medium">
                  Old gold value: {formatCurrency(Math.round(oldGoldValue))}
                </p>
              )}
              {oldGoldActualValueNum > 0 && oldGoldComputedValue > 0 && Math.abs(oldGoldActualValueNum - oldGoldComputedValue) > 0.01 && (
                <p className="text-xs text-amber-600">
                  Auto-calculated value was {formatCurrency(Math.round(oldGoldComputedValue))} — using actual valued price instead.
                </p>
              )}
              {oldGoldAmountToPay < billTotal && oldGoldValue > 0 && (
                <p className="text-xs text-blue-600 font-medium">
                  Amount to pay after exchange: {formatCurrency(oldGoldAmountToPay)}
                </p>
              )}
              {oldGoldChange > 0 && (
                <p className="text-xs text-purple-600 font-medium">
                  Old gold value exceeds bill — change/credit due: {formatCurrency(Math.round(oldGoldChange))}
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Actual Money Received</label>
                <input type="number" value={actualAmountReceived} onChange={(e) => setActualAmountReceived(e.target.value)} placeholder={`Amount received (due ${formatCurrency(oldGoldAmountToPay)})`} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                {computedDiscount > 0 && (
                  <p className="text-xs text-green-600 font-medium mt-1">
                    Remaining {formatCurrency(computedDiscount)} discounted — service fee charged on {formatCurrency(taxableAmount)}
                  </p>
                )}
                {Number(actualAmountReceived) > 0 && Number(actualAmountReceived) > oldGoldAmountToPay && (
                  <p className="text-xs text-green-600 font-medium mt-1">
                    Change due: {formatCurrency(Number(actualAmountReceived) - oldGoldAmountToPay)}
                  </p>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cashier</label>
            <div className="relative">
              <input
                list="cashier-options"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="Enter or select cashier name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <datalist id="cashier-options">
                {cashierOptions.map((name) => <option key={name} value={name} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer Details</label>
            <div className="space-y-2">
              <div className="relative">
                <input value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setShowCustomerModal(true) }} onBlur={() => setTimeout(() => setShowCustomerModal(false), 200)} onFocus={() => { setShowCustomerModal(true); if (customerSearch) searchCustomers(customerSearch) }} placeholder="Search existing customer..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                {showCustomerModal && customerResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {customerResults.map((c) => (
                      <button key={c._id} type="button" onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setCustomerName(c.name); setCustomerPhone(c.phone || ''); setCustomerAddress(c.address || ''); setShowCustomerModal(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                        {c.name} - {c.phone}
                      </button>
                    ))}
                    {customerSearch && (
                      <button type="button" onMouseDown={() => setShowCustomerModal(false)} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-t border-gray-100">
                        Close
                      </button>
                    )}
                  </div>
                )}
              </div>
              <input value={customerName} onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomer(null) }} placeholder="Customer name" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setSelectedCustomer(null) }} placeholder="Phone number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input value={customerAddress} onChange={(e) => { setCustomerAddress(e.target.value); setSelectedCustomer(null) }} placeholder="Address" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
           <Button className="w-full" onClick={() => setShowConfirm(true)} disabled={cart.length === 0}>
             Complete Sale
           </Button>
           <div className="flex gap-2">
             <Button
               variant="outline"
               className="flex-1"
               onClick={handlePreviewBill}
               disabled={cart.length === 0}
               icon={<Printer className="h-4 w-4" />}
             >
               Preview Bill
             </Button>
             <Button
               variant="secondary"
               className="flex-1"
               onClick={handleHoldBill}
               disabled={cart.length === 0}
             >
               Hold Bill
             </Button>
           </div>
           {heldBills.length > 0 && (
             <Button
               variant="ghost"
               className="w-full text-amber-600 border-amber-300"
               onClick={() => setShowHoldDialog(true)}
             >
               Resume Held Bill ({heldBills.length})
             </Button>
           )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleCompleteSale}
        title="Complete Sale"
         message={
          <div className="text-sm">
            <p>Are you sure you want to complete this sale?</p>
            <div className="mt-2 space-y-0.5 text-right">
              <div><span className="font-medium">Subtotal:</span> {formatCurrency(cartTotal)}</div>
              <div><span className="font-medium">Service Fee ({feeRate}%):</span> {formatCurrency(feeAmount)}</div>
              {diamondSubtotal > 0 && <div><span className="font-medium">Diamond {diamondTaxRate >= 13 ? 'VAT' : 'Service Fee'} ({diamondTaxRate}%):</span> {formatCurrency(diamondTaxAmount)}</div>}
              {computedDiscount > 0 && <div className="text-green-600"><span className="font-medium">Discount:</span> -{formatCurrency(computedDiscount)}</div>}
              <div className="font-bold pt-1 border-t"><span className="font-medium">Bill Total:</span> {formatCurrency(billTotal)}</div>
              {paymentType === 'oldGoldExchange' && oldGoldValue > 0 && (
                <>
                  <div className="text-green-600"><span className="font-medium">Old Gold Credit:</span> {formatCurrency(oldGoldCredit)}</div>
                  <div className="text-blue-600"><span className="font-medium">Cash Received:</span> {formatCurrency(oldGoldCashPaid)}</div>
                  {oldGoldChange > 0 && <div className="text-purple-600"><span className="font-medium">Change/Credit Due:</span> {formatCurrency(oldGoldChange)}</div>}
                </>
              )}
              {paymentType !== 'oldGoldExchange' && actualAmountReceived && <div className="text-blue-600"><span className="font-medium">Amount Received:</span> {formatCurrency(Number(actualAmountReceived))}</div>}
            </div>
          </div>
        }
        confirmText={submitting ? 'Processing...' : 'Complete Sale'}
        variant="primary"
      />
      <Modal
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        title="Sale Completed Successfully"
        size="md"
      >
        <div className="text-center py-4">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p className="text-gray-700 mb-6">Your sale has been completed successfully!</p>
          <div className="flex justify-center gap-3 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowPrintDialog(false) }}
            >
              No, Continue
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowPrintDialog(false)
                if (completedSaleId) navigate(`/pos/print-invoice/${completedSaleId}?print=1`)
              }}
              icon={<Printer className="h-4 w-4" />}
            >
              Print Invoice
            </Button>
          </div>
        </div>
       </Modal>
        <Modal
          isOpen={showPreviewDialog}
          onClose={() => setShowPreviewDialog(false)}
          title="Preview Bill"
          size="5xl"
        >
          <div className="mx-auto max-w-[1050px]">
            <InvoiceDocument
              logoUrl={storeSettings.logoUrl}
              companyName={storeSettings.storeName || 'My Jewellery Store'}
              tagline="AN EXCLUSIVE GOLD & DIAMOND JEWELLERY SHOWROOM"
              address={storeSettings.address || ''}
              phone={storeSettings.phone || ''}
              panNumber={storeSettings.panNumber || ''}
              invoiceNumber="Draft"
              dateAD={previewDateAD}
              dateBS={previewDateBS}
              dateTime={previewDateTime}
              title="Estimate"
              customerName={customerName.trim() || 'Walk-in Customer'}
              customerPhone={customerPhone}
              customerAddress={customerAddress}
              customerCode={selectedCustomer?.customerCode || ''}
              salesPerson={cashierName || user?.name || ''}
              items={previewItems}
              words={previewWords}
              subtotal={previewSubtotal}
              discount={computedDiscount}
              taxableAmount={totalTaxable}
              totalTax={totalTaxAmount}
              taxLines={[
                { name: 'Service Fee', rate: feeRate, amount: feeAmount },
                { name: diamondTaxRate >= 13 ? 'VAT (Diamond)' : 'Service Fee (Diamond)', rate: diamondTaxRate, amount: diamondTaxAmount },
              ].filter((t) => t.amount > 0)}
              roundOff={roundOff}
              grandTotal={billTotal}
              paymentType={previewPaymentLabel}
              paidAmount={previewPaidAmount}
              oldGoldWeight={previewOldGold.netWeight || previewOldGold.weight}
              oldGoldAmount={previewOldGold.deduction}
              oldGoldPurity={previewOldGold.purity}
              oldGoldDeductionPercent={previewOldGold.deductionPercent}
              oldGoldGrossWeight={previewOldGold.weight}
              oldGoldNetWeight={previewOldGold.netWeight || previewOldGold.weight}
              cashier={cashierName || user?.name || ''}
            />
          </div>
         <div className="flex justify-end gap-2 mt-4">
           <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
           <Button variant="primary" onClick={() => { setShowPreviewDialog(false); setShowConfirm(true) }}>
             Proceed to Complete Sale
           </Button>
         </div>
       </Modal>
       <Modal
         isOpen={showHoldDialog}
         onClose={() => setShowHoldDialog(false)}
         title="Held Bills"
         size="md"
       >
         {heldBills.length === 0 ? (
           <p className="text-center text-gray-500 py-4">No held bills</p>
         ) : (
           <div className="space-y-2 max-h-[60vh] overflow-y-auto">
             {heldBills.map((bill) => (
               <div key={bill.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                 <div className="flex justify-between items-start">
                   <div>
                     <p className="text-sm font-medium">{bill.cart.length} item(s)</p>
                     <p className="text-xs text-gray-500">{formatCurrency(cartTotal)}</p>
                     <p className="text-xs text-gray-400">Held: {formatDate(bill.heldAt, 'dd/MM/yyyy HH:mm')}</p>
                     {bill.customerName && <p className="text-xs text-gray-600">Customer: {bill.customerName}</p>}
                   </div>
                   <div className="flex gap-1">
                     <Button variant="primary" size="sm" onClick={() => handleLoadHeldBill(bill)}>Load</Button>
                     <Button variant="danger" size="sm" onClick={() => handleDeleteHeldBill(bill.id)}>Delete</Button>
                   </div>
                 </div>
               </div>
             ))}
           </div>
         )}
        </Modal>
        <Modal
          isOpen={!!diamondModalItem}
          onClose={() => { setDiamondModalItem(null); setDiamondValue('') }}
          title={`Enter Value — ${diamondModalItem?.itemName || diamondModalItem?.name || ''}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-1">
              <p className="font-semibold">{diamondModalItem?.itemName || diamondModalItem?.name}</p>
              <p className="text-xs">{diamondModalItem?.SKU} · {diamondModalItem?.metalType}</p>
              {diamondModalItem?.stoneType && diamondModalItem.stoneType !== 'none' && (
                <p className="text-xs">
                  Stone: {diamondModalItem.stoneType.charAt(0).toUpperCase() + diamondModalItem.stoneType.slice(1)}
                  {Number(diamondModalItem.stoneWeight) > 0 && ` · ${formatWeight(diamondModalItem.stoneWeight)}`}
                  {Number(diamondModalItem.carat) > 0 && ` · ${diamondModalItem.carat}ct`}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Diamond Value (Rs)</label>
              <input
                type="number"
                value={diamondValue}
                onChange={(e) => setDiamondValue(e.target.value)}
                placeholder="Enter the diamond value"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">This value is used as the stone price when the sale is created.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDiamondModalItem(null); setDiamondValue('') }}>Cancel</Button>
              <Button variant="primary" onClick={confirmDiamondAdd}>Add to Cart</Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  export default POS