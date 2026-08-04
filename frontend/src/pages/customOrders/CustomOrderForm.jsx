import { useState, useEffect, useCallback, useMemo } from 'react'

import { useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { ArrowLeft } from 'lucide-react'

import { createCustomOrder } from '../../services/customOrderService'

import { getCustomers } from '../../services/customerService'

import { getKarigars } from '../../services/karigarService'

import { getLatestRates } from '../../services/rateService'

import { getSettings } from '../../services/settingsService'

import Button from '../../components/ui/Button'

import FormInput from '../../components/ui/FormInput'

import FormTextarea from '../../components/ui/FormTextarea'

import FormSelect from '../../components/ui/FormSelect'

import ImageUpload from '../../components/ui/ImageUpload'

import Card from '../../components/ui/Card'

import { gramsToLaal, laalToGrams, formatWeightTolaLaal, applyTransportRate, GRAMS_PER_TOLA } from '../../utils/helpers'

import { KARAT_OPTIONS } from '../../utils/constants'

const CATEGORY_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'diamond', label: 'Diamond' },
]

const KARAT_TO_PURITY = {
  '24K': '999',
  '22K': '916',
  '21K': '875',
  '18K': '750',
  '14K': '585',
  '10K': '417',
}

const PURITY_TO_KARAT = {
  999: '24K',
  995: '24K',
  916: '22K',
  875: '21K',
  750: '18K',
  585: '14K',
  375: '10K',
}

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

const OLD_GOLD_PURITY_OPTIONS = [
  { value: '999', label: '999' },
  { value: '995', label: '995' },
  { value: '916', label: '916' },
  { value: '875', label: '875' },
  { value: '750', label: '750' },
  { value: '585', label: '585' },
  { value: '375', label: '375' },
]

const OLD_GOLD_KARAT_OPTIONS = [
  { value: '24', label: '24K' },
  { value: '22', label: '22K' },
  { value: '21', label: '21K' },
  { value: '18', label: '18K' },
  { value: '14', label: '14K' },
  { value: '10', label: '10K' },
]

const CustomOrderForm = () => {
  const navigate = useNavigate()

   const [form, setForm] = useState({
     customerName: '', phone: '', address: '',
     branch: '', category: '', requestedWeight: '', purity: '', karat: '',
     weightLaal: '',
     ratePerGram: '', wastage: '', makingCharge: '',
     targetCompletionDate: '', advanceAmount: '', estimatedPrice: '',
     designReference: '', itemName: '',
     karigarId: '',
     oldGoldWeight: '', oldGoldKarat: '24', oldGoldPurity: '999', oldGoldDeductionPercent: '',
   })

  const [images, setImages] = useState([])
  const [karigars, setKarigars] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)

  const [rateData, setRateData] = useState({ rates: null, charges: { gold: 0, silver: 0 } })

  useEffect(() => {
    let active = true
    Promise.all([getSettings(), getLatestRates()])
      .then(([settings, res]) => {
        if (!active) return
        setRateData({
          rates: res.data?.data || null,
          charges: {
            gold: Number(settings?.goldTransportCharge) || 0,
            silver: Number(settings?.silverTransportCharge) || 0,
          },
        })
      })
      .catch(() => { if (active) setRateData((prev) => ({ ...prev, rates: null })) })
    return () => { active = false }
  }, [])

  const goldRate = applyTransportRate(rateData.rates?.gold, rateData.charges.gold)
  const silverRate = applyTransportRate(rateData.rates?.silver, rateData.charges.silver)
  const goldPerGram = goldRate ? Number((goldRate.rate / GRAMS_PER_TOLA).toFixed(2)) : 0
  const silverPerGram = silverRate ? Number((silverRate.rate / GRAMS_PER_TOLA).toFixed(2)) : 0

   const computedEstimated = useMemo(() => {
     const weight = Number(form.requestedWeight) || 0
     const rate = Number(form.ratePerGram) || 0
     const making = Number(form.makingCharge) || 0
     const wastage = Number(form.wastage) || 0
     if (weight <= 0 || rate <= 0) return 0
     const purityValue = Number(form.purity) || (form.karat ? Number(KARAT_TO_PURITY[form.karat]) : 0) || 0
     const purityFactor = purityValue > 0 ? purityValue / 1000 : 1
     const metalValue = weight * rate * purityFactor
     const wastageAmount = metalValue * (wastage / 100)
     const basePrice = metalValue + wastageAmount + making
     const oldGoldWeightNum = Number(form.oldGoldWeight) || 0
     const oldGoldDeductionPercentNum = Number(form.oldGoldDeductionPercent) || 0
     const oldGoldNetWeight = oldGoldWeightNum > 0 ? oldGoldWeightNum * (1 - oldGoldDeductionPercentNum / 100) : 0
     const oldGoldKaratNum = Number(form.oldGoldKarat) || 24
     const oldGoldValue = oldGoldNetWeight * (oldGoldKaratNum / 24) * rate * purityFactor
     const oldGoldCredit = Math.min(oldGoldValue, basePrice)
     return Math.round(basePrice - oldGoldCredit)
   }, [form.requestedWeight, form.ratePerGram, form.makingCharge, form.wastage, form.purity, form.karat, form.oldGoldWeight, form.oldGoldDeductionPercent, form.oldGoldKarat])

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

  useEffect(() => {
    getKarigars({ limit: 100 })
      .then((res) => {
        const data = res.data?.data || res.data?.karigars || res.data || []
        setKarigars(Array.isArray(data) ? data : [])
      })
      .catch(() => setKarigars([]))
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleKaratChange = (e) => {
    const value = e.target.value
    setForm((prev) => ({
      ...prev,
      karat: value,
      purity: value ? KARAT_TO_PURITY[value] ?? prev.purity : prev.purity,
    }))
    if (errors.karat) setErrors((prev) => ({ ...prev, karat: '' }))
  }

  const handlePurityChange = (e) => {
    const value = e.target.value
    setForm((prev) => ({
      ...prev,
      purity: value,
      karat: value && PURITY_TO_KARAT[Number(value)] ? PURITY_TO_KARAT[Number(value)] : '',
    }))
    if (errors.purity) setErrors((prev) => ({ ...prev, purity: '' }))
  }

  const handleOldGoldKaratChange = (value) => {
    setForm((prev) => ({
      ...prev,
      oldGoldKarat: value,
      oldGoldPurity: OLD_GOLD_KARAT_TO_PURITY[value] ?? prev.oldGoldPurity,
    }))
  }

  const handleOldGoldPurityChange = (value) => {
    setForm((prev) => ({
      ...prev,
      oldGoldPurity: value,
      oldGoldKarat: OLD_GOLD_PURITY_TO_KARAT[value] ?? prev.oldGoldKarat,
    }))
  }

  const handleWeightChange = (e) => {
    const value = e.target.value
    setForm((prev) => ({
      ...prev,
      requestedWeight: value,
      weightLaal: value !== '' ? gramsToLaal(Number(value)) : '',
    }))
    if (errors.requestedWeight) setErrors((prev) => ({ ...prev, requestedWeight: '' }))
  }

  const handleLaalChange = (e) => {
    const value = e.target.value
    setForm((prev) => ({
      ...prev,
      weightLaal: value,
      requestedWeight: value !== '' ? laalToGrams(Number(value)) : '',
    }))
    if (errors.requestedWeight) setErrors((prev) => ({ ...prev, requestedWeight: '' }))
  }

  const handleCategoryChange = (e) => {
    const value = e.target.value
    setForm((prev) => {
      let ratePerGram = prev.ratePerGram
      if (value === 'gold' && goldRate) ratePerGram = String(goldPerGram)
      if (value === 'silver' && silverRate) ratePerGram = String(silverPerGram)
      if (value === 'diamond') ratePerGram = ''
      return { ...prev, category: value, ratePerGram }
    })
    if (errors.category) setErrors((prev) => ({ ...prev, category: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.customerName.trim()) errs.customerName = 'Customer name is required'
    if (!form.phone.trim()) errs.phone = 'Phone is required'
    if (!form.category) errs.category = 'Category is required'
    if (!form.requestedWeight || Number(form.requestedWeight) <= 0) errs.requestedWeight = 'Enter a valid weight'
    if (!form.karat) errs.karat = 'Karat is required'
    if (form.purity && (Number(form.purity) < 0 || Number(form.purity) > 1000)) errs.purity = 'Purity must be 0-1000'
    if (form.advanceAmount && Number(form.advanceAmount) < 0) errs.advanceAmount = 'Enter a valid amount'
    if (form.estimatedPrice && Number(form.estimatedPrice) < 0) errs.estimatedPrice = 'Enter a valid amount'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setLoading(true)
    try {
      const payload = {
        customer: {
          name: form.customerName.trim(),
          phone: form.phone.trim(),
          address: form.address || '',
        },
        customerId: selectedCustomer?._id || '',
        branch: form.branch || '',
        category: form.category,
        requestedWeight: Number(form.requestedWeight),
        purity: form.purity ? Number(form.purity) : 0,
        karat: parseInt(form.karat) || 0,
        targetCompletionDate: form.targetCompletionDate || null,
        advanceAmount: form.advanceAmount ? Number(form.advanceAmount) : 0,
        estimatedPrice: computedEstimated > 0 ? computedEstimated : Number(form.estimatedPrice || 0),
        ratePerGram: Number(form.ratePerGram) || 0,
        wastagePercent: Number(form.wastage) || 0,
        makingCharge: Number(form.makingCharge) || 0,
        designReference: form.designReference || '',
        itemName: form.itemName || '',
        karigarId: form.karigarId || null,
        oldGoldWeight: form.oldGoldWeight ? Number(form.oldGoldWeight) : 0,
        oldGoldKarat: parseInt(form.oldGoldKarat) || 24,
        oldGoldPurity: Number(form.oldGoldPurity) || 999,
        oldGoldDeductionPercent: form.oldGoldDeductionPercent ? Number(form.oldGoldDeductionPercent) : 0,
      }
      if (images.length > 0) {
        const fd = new FormData()
        Object.entries(payload).forEach(([key, val]) => {
          if (val !== null && val !== undefined && val !== '') {
            fd.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val))
          }
        })
        images.forEach((img) => fd.append('images', img))
        await createCustomOrder(fd)
      } else {
        await createCustomOrder(payload)
      }
      toast.success('Custom order booked successfully')
      navigate('/custom-orders')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create custom order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/custom-orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Custom Order</h1>
          <p className="text-sm text-gray-500">Book a made-to-order jewellery request</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Card title="Customer Information">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Existing Customer</label>
            <div className="relative">
              <input
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }}
                onBlur={() => setTimeout(() => setShowCustomerModal(false), 200)}
                onFocus={() => { setShowCustomerModal(true); if (customerSearch) searchCustomers(customerSearch) }}
                placeholder="Search by name or phone..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {showCustomerModal && customerResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onMouseDown={() => {
                        setSelectedCustomer(c)
                        setCustomerSearch(`${c.name}${c.phone ? ` (${c.phone})` : ''}`)
                        setForm((prev) => ({ ...prev, customerName: c.name, phone: c.phone || '', address: c.address || '' }))
                        setShowCustomerModal(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {c.name} - {c.phone || 'no phone'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <p className="mt-1 text-xs text-emerald-600">
                Linked to customer record{selectedCustomer.customerCode ? ` (${selectedCustomer.customerCode})` : ''}. You can still edit the fields below.
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Customer Name" name="customerName" value={form.customerName} onChange={handleChange} error={errors.customerName} required placeholder="Enter customer name" />
            <FormInput label="Phone" name="phone" value={form.phone} onChange={handleChange} error={errors.phone} required placeholder="Enter phone number" />
            <FormTextarea label="Address" name="address" value={form.address} onChange={handleChange} error={errors.address} placeholder="Optional" rows={2} />
            <FormInput label="Branch" name="branch" value={form.branch} onChange={handleChange} error={errors.branch} placeholder="e.g. Kalimati" />
          </div>
        </Card>

        <Card title="Order Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormSelect label="Category" name="category" options={CATEGORY_OPTIONS} value={form.category} onChange={handleCategoryChange} error={errors.category} required placeholder="Select category" />
            <div>
              <FormInput label="Requested Weight (g)" name="requestedWeight" type="number" step="0.01" value={form.requestedWeight} onChange={handleWeightChange} error={errors.requestedWeight} required placeholder="e.g. 20" />
              <div className="mt-3">
                <FormInput label="Weight (laal)" name="weightLaal" type="number" step="0.001" value={form.weightLaal} onChange={handleLaalChange} placeholder="e.g. 171.468" />
                {form.requestedWeight && Number(form.requestedWeight) > 0 && (
                  <p className="mt-1 text-xs text-gray-500">{formatWeightTolaLaal(form.requestedWeight)}</p>
                )}
              </div>
            </div>
            <FormSelect label="Karat" name="karat" options={KARAT_OPTIONS.map((k) => ({ value: k, label: k }))} value={form.karat} onChange={handleKaratChange} error={errors.karat} required placeholder="Select karat" />
            <FormInput label="Purity (0-1000)" name="purity" type="number" step="0.1" value={form.purity} onChange={handlePurityChange} error={errors.purity} placeholder="e.g. 916" />
            <FormInput label="Target Completion Date" name="targetCompletionDate" type="date" value={form.targetCompletionDate} onChange={handleChange} />
            <FormInput label="Item Name" name="itemName" value={form.itemName} onChange={handleChange} error={errors.itemName} placeholder="e.g. Gold chain" />
          </div>
          <div className="mt-4">
            <FormTextarea label="Design Reference" name="designReference" value={form.designReference} onChange={handleChange} error={errors.designReference} rows={3} placeholder="Describe the design, reference sketch, measurements, stone settings..." />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Design Images</label>
            <ImageUpload images={images} onUpload={(files) => setImages((prev) => [...prev, ...files])} onRemove={(idx) => setImages((prev) => prev.filter((_, i) => i !== idx))} />
          </div>
        </Card>

         <Card title="Pricing & Assignment">
           <div className="mb-3 space-y-1">
             <p className="text-xs text-gray-500">
               Estimated price = weight × rate × purity + jarti (wastage % of metal value paid to the karigar) + making charge. The rate auto-fills from today&apos;s scraped rate including transport charge.
             </p>
             {(goldRate || silverRate) && (
               <p className="text-xs text-amber-700 font-medium">
                 Today&apos;s rate (incl. transport):
                 {goldRate && ` Gold Rs ${Number(goldRate.rate).toLocaleString()}/tola (Rs ${goldPerGram.toLocaleString()}/g)`}
                 {goldRate && silverRate && ' ·'}
                 {silverRate && ` Silver Rs ${Number(silverRate.rate).toLocaleString()}/tola (Rs ${silverPerGram.toLocaleString()}/g)`}
               </p>
             )}
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             <FormInput label="Rate (Rs./gram)" name="ratePerGram" type="number" step="1" value={form.ratePerGram} onChange={handleChange} error={errors.ratePerGram} placeholder="e.g. 8500" />
             <FormInput label="Wastage / Jarti (%)" name="wastage" type="number" step="0.1" value={form.wastage} onChange={handleChange} error={errors.wastage} placeholder="e.g. 5" />
             <FormInput label="Making Charge (Rs.)" name="makingCharge" type="number" step="1" value={form.makingCharge} onChange={handleChange} error={errors.makingCharge} placeholder="e.g. 1500" />
             <FormInput label="Advance / Booking Amount (Rs.)" name="advanceAmount" type="number" step="1" value={form.advanceAmount} onChange={handleChange} error={errors.advanceAmount} placeholder="0" />
             <FormInput label="Estimated Price (Rs.)" name="estimatedPrice" type="number" step="1" value={computedEstimated || ''} readOnly onChange={() => {}} />
             <FormSelect label="Assign Karigar" name="karigarId" options={karigars.map((k) => ({ value: k._id, label: k.name }))} value={form.karigarId} onChange={handleChange} error={errors.karigarId} placeholder="Assign later at issue" />
           </div>
         </Card>

          <Card title="Old Gold Exchange">
            <p className="text-xs text-gray-500 mb-3">
              If the customer is exchanging old gold, enter the details below. The old gold value will be computed and applied as a credit toward the order.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormInput label="Old Gold Weight (g)" name="oldGoldWeight" type="number" step="0.001" value={form.oldGoldWeight} onChange={handleChange} placeholder="e.g. 5.5" />
              <FormSelect label="Old Gold Karat" name="oldGoldKarat" options={OLD_GOLD_KARAT_OPTIONS} value={form.oldGoldKarat} onChange={(e) => handleOldGoldKaratChange(e.target.value)} />
              <FormSelect label="Old Gold Purity" name="oldGoldPurity" options={OLD_GOLD_PURITY_OPTIONS} value={form.oldGoldPurity} onChange={(e) => handleOldGoldPurityChange(e.target.value)} />
              <FormInput label="Deduction %" name="oldGoldDeductionPercent" type="number" step="0.1" value={form.oldGoldDeductionPercent} onChange={handleChange} placeholder="e.g. 10" helper="Deduction percentage applied to the old gold weight. Net weight = weight × (1 − %/100)." />
            </div>
            {Number(form.oldGoldWeight) > 0 && (() => {
              const oldGoldWeightNum = Number(form.oldGoldWeight) || 0
              const oldGoldDeductionPercentNum = Number(form.oldGoldDeductionPercent) || 0
              const oldGoldNetWeight = oldGoldWeightNum * (1 - oldGoldDeductionPercentNum / 100)
              const oldGoldKaratNum = Number(form.oldGoldKarat) || 24
              const rate = Number(form.ratePerGram) || 0
              const purityValue = Number(form.purity) || (form.karat ? Number(KARAT_TO_PURITY[form.karat]) : 0) || 0
              const purityFactor = purityValue > 0 ? purityValue / 1000 : 1
              const oldGoldValue = oldGoldNetWeight * (oldGoldKaratNum / 24) * rate * purityFactor
              const basePrice = (Number(form.requestedWeight) || 0) * rate * purityFactor + (Number(form.requestedWeight) || 0) * rate * purityFactor * (Number(form.wastage) || 0) / 100 + Number(form.makingCharge) || 0
              const oldGoldCredit = Math.min(oldGoldValue, basePrice)
              const amountToPay = Math.max(0, basePrice - oldGoldValue)
              const changeDue = Math.max(0, oldGoldValue - basePrice)
              return (
                <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Net Weight after {oldGoldDeductionPercentNum}% deduction</span>
                    <span className="font-medium text-gray-900">{oldGoldNetWeight.toFixed(3)} g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{oldGoldKaratNum}K pure equivalent</span>
                    <span className="font-medium text-gray-900">{(oldGoldNetWeight * (oldGoldKaratNum / 24)).toFixed(3)} g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Old Gold Value</span>
                    <span className="font-medium text-gray-900">Rs. {Math.round(oldGoldValue).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-700">Old Gold Credit Applied</span>
                    <span className="text-blue-700">Rs. {Math.round(oldGoldCredit).toLocaleString()}</span>
                  </div>
                  {amountToPay > 0 && (
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-700">Amount to Pay After Exchange</span>
                      <span className="text-green-700">Rs. {Math.round(amountToPay).toLocaleString()}</span>
                    </div>
                  )}
                  {changeDue > 0 && (
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-700">Old Gold Exceeds Order — Credit Due</span>
                      <span className="text-purple-700">Rs. {Math.round(changeDue).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )
            })()}
          </Card>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="ghost" onClick={() => navigate('/custom-orders')} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading}>Book Order</Button>
        </div>
      </form>
    </div>
  )
}

export default CustomOrderForm
