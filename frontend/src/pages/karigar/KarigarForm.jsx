import { useState, useEffect } from 'react'

import toast from 'react-hot-toast'

import { createKarigar, updateKarigar } from '../../services/karigarService'

import Modal from '../../components/ui/Modal'

import Button from '../../components/ui/Button'

import FormInput from '../../components/ui/FormInput'

import FormSelect from '../../components/ui/FormSelect'

import FormTextarea from '../../components/ui/FormTextarea'

const specializationOptions = [
  { value: 'Gold', label: 'Gold' },
  { value: 'Silver', label: 'Silver' },
  { value: 'Both', label: 'Both' },
  { value: 'Stone Setting', label: 'Stone Setting' },
  { value: 'Polishing', label: 'Polishing' },
  { value: 'Other', label: 'Other' },
]

const KarigarForm = ({ isOpen, onClose, karigar, onSave }) => {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    specialization: '',
    isActive: true,
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (karigar) {
      setForm({
        name: karigar.name || '',
        phone: karigar.phone || '',
        address: karigar.address || '',
        specialization: karigar.specialization || '',
        isActive: karigar.isActive !== undefined ? karigar.isActive : true,
      })
    } else {
      setForm({
        name: '',
        phone: '',
        address: '',
        specialization: '',
        isActive: true,
      })
    }
    setErrors({})
  }, [karigar, isOpen])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.phone.trim()) errs.phone = 'Phone is required'
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
      if (karigar) {
        await updateKarigar(karigar._id, form)
        toast.success('Karigar updated successfully')
      } else {
        await createKarigar(form)
        toast.success('Karigar created successfully')
      }
      onSave?.()
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save karigar'
      if (err?.response?.data?.errors) {
        setErrors(err.response.data.errors)
      } else {
        setErrors({ submit: msg })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={karigar ? 'Edit Karigar' : 'Add Karigar'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Name"
          name="name"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
          required
          placeholder="Enter karigar name"
        />
        <FormInput
          label="Phone"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          error={errors.phone}
          placeholder="Enter phone number"
        />
        <FormTextarea
          label="Address"
          name="address"
          value={form.address}
          onChange={handleChange}
          error={errors.address}
          placeholder="Enter full address"
          rows={3}
        />
        <FormSelect
          label="Specialization"
          name="specialization"
          options={specializationOptions}
          value={form.specialization}
          onChange={handleChange}
          error={errors.specialization}
          placeholder="Select specialization"
        />
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            <span className="ms-3 text-sm font-medium text-gray-700">
              Is Active
            </span>
          </label>
        </div>

        {errors.submit && (
          <p className="text-sm text-red-600" role="alert">
            {errors.submit}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {karigar ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default KarigarForm
