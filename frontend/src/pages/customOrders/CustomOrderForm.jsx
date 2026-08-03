import { useState, useEffect } from 'react'

import { useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { ArrowLeft } from 'lucide-react'

import { createCustomOrder } from '../../services/customOrderService'

import { getKarigars } from '../../services/karigarService'

import Button from '../../components/ui/Button'

import FormInput from '../../components/ui/FormInput'

import FormTextarea from '../../components/ui/FormTextarea'

import FormSelect from '../../components/ui/FormSelect'

import ImageUpload from '../../components/ui/ImageUpload'

import Card from '../../components/ui/Card'

import { KARAT_OPTIONS } from '../../utils/constants'

const CATEGORY_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'diamond', label: 'Diamond' },
]

const CustomOrderForm = () => {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    customerName: '', phone: '', address: '',
    branch: '', category: '', requestedWeight: '', purity: '', karat: '',
    targetCompletionDate: '', advanceAmount: '', estimatedPrice: '',
    designReference: '', itemName: '',
    karigarId: '',
  })

  const [images, setImages] = useState([])
  const [karigars, setKarigars] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

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
        branch: form.branch || '',
        category: form.category,
        requestedWeight: Number(form.requestedWeight),
        purity: form.purity ? Number(form.purity) : 0,
        karat: parseInt(form.karat) || 0,
        targetCompletionDate: form.targetCompletionDate || null,
        advanceAmount: form.advanceAmount ? Number(form.advanceAmount) : 0,
        estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : 0,
        designReference: form.designReference || '',
        itemName: form.itemName || '',
        karigarId: form.karigarId || null,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Customer Name" name="customerName" value={form.customerName} onChange={handleChange} error={errors.customerName} required placeholder="Enter customer name" />
            <FormInput label="Phone" name="phone" value={form.phone} onChange={handleChange} error={errors.phone} required placeholder="Enter phone number" />
            <FormTextarea label="Address" name="address" value={form.address} onChange={handleChange} error={errors.address} placeholder="Optional" rows={2} />
            <FormInput label="Branch" name="branch" value={form.branch} onChange={handleChange} error={errors.branch} placeholder="e.g. Kalimati" />
          </div>
        </Card>

        <Card title="Order Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormSelect label="Category" name="category" options={CATEGORY_OPTIONS} value={form.category} onChange={handleChange} error={errors.category} required placeholder="Select category" />
            <FormInput label="Requested Weight (g)" name="requestedWeight" type="number" step="0.01" value={form.requestedWeight} onChange={handleChange} error={errors.requestedWeight} required placeholder="e.g. 20" />
            <FormSelect label="Karat" name="karat" options={KARAT_OPTIONS.map((k) => ({ value: k, label: k }))} value={form.karat} onChange={handleChange} error={errors.karat} required placeholder="Select karat" />
            <FormInput label="Purity (0-1000)" name="purity" type="number" step="0.1" value={form.purity} onChange={handleChange} error={errors.purity} placeholder="e.g. 916" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormInput label="Advance / Booking Amount (Rs.)" name="advanceAmount" type="number" step="1" value={form.advanceAmount} onChange={handleChange} error={errors.advanceAmount} placeholder="0" />
            <FormInput label="Estimated Price (Rs.)" name="estimatedPrice" type="number" step="1" value={form.estimatedPrice} onChange={handleChange} error={errors.estimatedPrice} placeholder="0" />
            <FormSelect label="Assign Karigar" name="karigarId" options={karigars.map((k) => ({ value: k._id, label: k.name }))} value={form.karigarId} onChange={handleChange} error={errors.karigarId} placeholder="Assign later at issue" />
          </div>
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
