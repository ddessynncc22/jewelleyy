import { useState, useEffect } from 'react'

import toast from 'react-hot-toast'

import { createCustomer, updateCustomer } from '../../services/customerService'

import Modal from '../../components/ui/Modal'

import Button from '../../components/ui/Button'

import FormInput from '../../components/ui/FormInput'

import FormTextarea from '../../components/ui/FormTextarea'

const CustomerForm = ({ customer, isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    citizenshipNumber: '',
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const isEditing = !!customer

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || '',
        email: customer.email || '',
        citizenshipNumber: customer.citizenshipNumber || '',
      })
    } else {
      setForm({
        name: '',
        phone: '',
        address: '',
        email: '',
        citizenshipNumber: '',
      })
    }
    setErrors({})
  }, [customer, isOpen])

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.phone.trim()) {
      errs.phone = 'Phone is required'
    } else if (!/^[\d\s\-+()]{7,15}$/.test(form.phone.trim())) {
      errs.phone = 'Invalid phone number'
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Invalid email address'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      if (isEditing) {
        await updateCustomer(customer._id, form)
        toast.success('Customer updated successfully')
      } else {
        await createCustomer(form)
        toast.success('Customer created successfully')
      }
      onSuccess?.()
    } catch (err) {
      const msg = err?.response?.data?.message || `Failed to ${isEditing ? 'update' : 'create'} customer`
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Customer' : 'Add Customer'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            error={errors.name}
            required
            placeholder="Enter customer name"
          />
          <FormInput
            label="Phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
            required
            placeholder="Enter phone number"
          />
        </div>

        <FormTextarea
          label="Address"
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="Enter address"
          rows={2}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="Enter email address"
          />
          <FormInput
            label="Citizenship Number"
            name="citizenshipNumber"
            value={form.citizenshipNumber}
            onChange={handleChange}
            placeholder="Enter citizenship number"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {isEditing ? 'Update Customer' : 'Create Customer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CustomerForm
