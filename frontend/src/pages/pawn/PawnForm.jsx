import { useState, useEffect, useCallback } from 'react'

import { useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { createPawnLoan, updatePawnLoan } from '../../services/pawnService'

import { getCustomers } from '../../services/customerService'

import Modal from '../../components/ui/Modal'

import Button from '../../components/ui/Button'

import FormInput from '../../components/ui/FormInput'

import FormTextarea from '../../components/ui/FormTextarea'

import FormSelect from '../../components/ui/FormSelect'

import ImageUpload from '../../components/ui/ImageUpload'

import DatePicker from '../../components/ui/DatePicker'

import { ArrowLeft } from 'lucide-react'

import { KARAT_OPTIONS } from '../../utils/constants'

const PawnForm = ({ isOpen: modalOpen, onClose, loan, onSave }) => {
  const navigate = useNavigate()

  const isStandalone = modalOpen === undefined
  const isOpen = isStandalone ? true : modalOpen
  const handleClose = isStandalone ? () => navigate('/pawn') : onClose

  const [form, setForm] = useState({
    customerName: '', phone: '', address: '', citizenshipNumber: '',
    itemDescription: '', weight: '', purity: '', karat: '',
    principalAmount: '', interestRate: '',
    startDate: new Date().toISOString().split('T')[0],
    dueDate: '',
  })

  const [images, setImages] = useState([])

  const [existingImages, setExistingImages] = useState([])

  const [errors, setErrors] = useState({})

  const [loading, setLoading] = useState(false)

  const [uploading, setUploading] = useState(false)

  const [customerSearch, setCustomerSearch] = useState('')

  const [customerResults, setCustomerResults] = useState([])

  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const [showCustomerModal, setShowCustomerModal] = useState(false)

  const searchCustomers = useCallback(async (query) => {
    if (!query || query.length < 1) { setCustomerResults([]); return }
    try {
      const res = await getCustomers({ search: query, limit: 10 })
      const data = res.data?.data || res.data?.customers || res.data || []
      setCustomerResults(Array.isArray(data) ? data : [])
    } catch { setCustomerResults([]) }
  }, [])
  useEffect(() => {
    if (loan) {
      setForm({
        customerName: loan.customer?.name || '',
        phone: loan.customer?.phone || '',
        address: loan.customer?.address || '',
        citizenshipNumber: loan.customer?.citizenshipNumber || '',
        itemDescription: loan.itemDetails?.description || '',
        weight: loan.itemDetails?.weight || '',
        purity: loan.itemDetails?.purity || '',
        karat: loan.itemDetails?.karat || '',
        principalAmount: loan.loanAmount || '',
        interestRate: loan.interestRate || '',
        startDate: loan.startDate ? loan.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
        dueDate: loan.dueDate ? loan.dueDate.split('T')[0] : '',
      }); setExistingImages(loan.collateralPhotos || [])
      setImages([])
      if (loan.customerId) {
        setSelectedCustomer({ _id: loan.customerId, name: loan.customer?.name || '', phone: loan.customer?.phone || '' })
        setCustomerSearch(loan.customer?.name || '')
      } else {
        setSelectedCustomer(null)
        setCustomerSearch('')
      }
    } else {
      setForm({
        customerName: '', phone: '', address: '', citizenshipNumber: '',
        itemDescription: '', weight: '', purity: '', karat: '',
        principalAmount: '', interestRate: '',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: '',
      }); setExistingImages([])
      setImages([])
      setSelectedCustomer(null)
      setCustomerSearch('')
    }
    setErrors({})
  }, [loan, isOpen])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch) searchCustomers(customerSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch, searchCustomers])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleImageUpload = (files) => {
    setImages((prev) => [...prev, ...files])
  }

  const handleImageRemove = (index) => {
    const totalExisting = existingImages.length
    if (index < totalExisting) {
      setExistingImages((prev) => prev.filter((_, i) => i !== index))
    } else {
      setImages((prev) => prev.filter((_, i) => i !== index - totalExisting))
    }
  }

  const allImages = [...existingImages, ...images]
  const validate = () => {
    const errs = {}; if (!form.customerName.trim()) errs.customerName = 'Customer name is required'; if (!form.phone.trim()) errs.phone = 'Phone is required'; if (!form.itemDescription.trim()) errs.itemDescription = 'Item description is required'; if (!form.weight) errs.weight = 'Weight is required'
    else if (isNaN(form.weight) || Number(form.weight) <= 0) errs.weight = 'Enter a valid weight'; if (form.purity && (isNaN(form.purity) || Number(form.purity) < 0 || Number(form.purity) > 100)) errs.purity = 'Enter a valid purity (0-100)'; if (!form.karat) errs.karat = 'Karat is required'; if (!form.principalAmount) errs.principalAmount = 'Principal amount is required'
    else if (isNaN(form.principalAmount) || Number(form.principalAmount) <= 0) errs.principalAmount = 'Enter a valid amount'; if (!form.interestRate) errs.interestRate = 'Interest rate is required'
    else if (isNaN(form.interestRate) || Number(form.interestRate) < 0) errs.interestRate = 'Enter a valid rate'
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
          name: form.customerName,
          phone: form.phone,
          address: form.address || '',
          citizenshipNumber: form.citizenshipNumber || '',
        },
        customerId: selectedCustomer?._id || null,
        itemDetails: {
          description: form.itemDescription,
          weight: Number(form.weight),
          purity: form.purity ? Number(form.purity) : 0,
          karat: parseInt(form.karat) || 0,
        },
        loanAmount: Number(form.principalAmount),
        interestRate: Number(form.interestRate),
        startDate: form.startDate,
        dueDate: form.dueDate,
      }; if (loan) {
        const res = await updatePawnLoan(loan._id, payload)
        console.log('update response:', res)
        toast.success('Bandaki updated successfully')
      } else {
        const res = await createPawnLoan(payload)
        console.log('create response:', res)
        toast.success('Bandaki created successfully')
      }; if (isStandalone) {
        navigate('/pawn'); } else {
        onSave?.()
      }
    } catch (err) {
      console.error('PawnForm submit error:', err)

      const msg = err?.response?.data?.message || err?.message || 'Failed to save Bandaki'
      setErrors({ submit: msg })
    } finally {
      setLoading(false)
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">Customer Information</h3>
        <div className="space-y-2">
          <div className="relative">
            <input value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }} onBlur={() => setTimeout(() => setShowCustomerModal(false), 200)} onFocus={() => { setShowCustomerModal(true); if (customerSearch) searchCustomers(customerSearch) }} placeholder="Search existing customer..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            {showCustomerModal && customerResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {customerResults.map((c) => (
                  <button key={c._id} type="button" onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setForm((prev) => ({ ...prev, customerName: c.name, phone: c.phone || '', address: c.address || '', citizenshipNumber: c.citizenshipNumber || '' })); setShowCustomerModal(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
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
          <FormInput label="Customer Name" name="customerName" value={form.customerName} onChange={handleChange} error={errors.customerName} required placeholder="Enter customer name" />
          <FormInput label="Phone" name="phone" value={form.phone} onChange={handleChange} error={errors.phone} required placeholder="Enter phone number" />
          <FormTextarea label="Address" name="address" value={form.address} onChange={handleChange} error={errors.address} placeholder="Enter address" rows={2} />
          <FormInput label="Citizenship Number" name="citizenshipNumber" value={form.citizenshipNumber} onChange={handleChange} error={errors.citizenshipNumber} placeholder="Optional" />
        </div>
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">Collateral Details</h3>
        <div className="space-y-4">
          <FormTextarea label="Item Description" name="itemDescription" value={form.itemDescription} onChange={handleChange} error={errors.itemDescription} required placeholder="Describe the collateral item" rows={2} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput label="Weight (g)" name="weight" type="number" step="0.01" value={form.weight} onChange={handleChange} error={errors.weight} required />
            <FormInput label="Purity (%)" name="purity" type="number" step="0.1" value={form.purity} onChange={handleChange} error={errors.purity} placeholder="Optional" />
            <FormSelect label="Karat" name="karat" options={KARAT_OPTIONS.map((k) => ({ value: k, label: k }))} value={form.karat} onChange={handleChange} error={errors.karat} required placeholder="Select karat" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Images</label>
            <ImageUpload images={allImages} onUpload={handleImageUpload} onRemove={handleImageRemove} />
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">Loan Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput label="Principal Amount (Rs.)" name="principalAmount" type="number" step="1" value={form.principalAmount} onChange={handleChange} error={errors.principalAmount} required placeholder="Enter loan amount" />
          <FormInput label="Interest Rate (%)" name="interestRate" type="number" step="0.1" value={form.interestRate} onChange={handleChange} error={errors.interestRate} required placeholder="Monthly interest rate" />
          <FormInput label="Start Date" name="startDate" type="date" value={form.startDate} onChange={handleChange} required />
          <FormInput label="Due Date" name="dueDate" type="date" value={form.dueDate} onChange={handleChange} />
        </div>
      </div>
      {errors.submit && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{errors.submit}</p>
        </div>
      )}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Button variant="ghost" onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>{loan ? 'Update' : 'Create'} Bandaki</Button>
      </div>
    </form>
  )
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={loan ? 'Edit Bandaki' : 'New Bandaki'} size="xl">
      {formContent}
    </Modal>
  )
}

export default PawnForm