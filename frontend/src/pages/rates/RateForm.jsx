import { useState, useEffect, useCallback, useMemo } from 'react'

import toast from 'react-hot-toast'

import { createRate, updateRate } from '../../services/rateService'

import Modal from '../../components/ui/Modal'

import Button from '../../components/ui/Button'

import FormInput from '../../components/ui/FormInput'

import FormSelect from '../../components/ui/FormSelect'

const TOLA_TO_GRAM = 11.664

const TODAY = new Date().toISOString().split('T')[0]

const RateForm = ({ rate, isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    metalType: 'gold',
    rate: '',
    unit: 'tola',
    date: TODAY,
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const isEditing = !!rate

  useEffect(() => {
    if (rate) {
      setForm({
        metalType: rate.metalType || 'gold',
        rate: String(rate.rate ?? ''),
        unit: rate.unit || 'tola',
        date: rate.date
          ? new Date(rate.date).toISOString().split('T')[0]
          : TODAY,
      })
    } else {
      setForm({
        metalType: 'gold',
        rate: '',
        unit: 'tola',
        date: TODAY,
      })
    }
    setErrors({})
  }, [rate, isOpen])

  const ratePerGram = useMemo(
    () =>
      form.unit === 'gram'
        ? Number(form.rate)
        : Number(form.rate) / TOLA_TO_GRAM,
    [form.rate, form.unit],
  )

  const validate = useCallback(() => {
    const errs = {}
    if (!form.rate || Number(form.rate) <= 0) {
      errs.rate = 'Rate is required and must be greater than 0'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [form.rate])

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!validate()) return

      const payload = {
        metalType: form.metalType,
        rate: Number(form.rate),
        unit: form.unit,
        date: form.date,
      }

      setSubmitting(true)
      try {
        if (isEditing) {
          await updateRate(rate._id, payload)
          toast.success('Rate updated successfully')
        } else {
          await createRate(payload)
          toast.success('Rate created successfully')
        }
        onSuccess?.()
      } catch (err) {
        toast.error(
          err?.response?.data?.message ||
            `Failed to ${isEditing ? 'update' : 'create'} rate`,
        )
      } finally {
        setSubmitting(false)
      }
    },
    [form, isEditing, rate, validate, onSuccess],
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Rate' : 'Add Rate'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSelect
          label="Metal Type"
          name="metalType"
          value={form.metalType}
          onChange={handleChange}
          options={[
            { value: 'gold', label: 'Gold' },
            { value: 'silver', label: 'Silver' },
          ]}
          required
        />

        <FormInput
          label="Rate"
          name="rate"
          type="number"
          step="0.01"
          value={form.rate}
          onChange={handleChange}
          error={errors.rate}
          required
          placeholder="Enter rate"
        />

        <FormSelect
          label="Unit"
          name="unit"
          value={form.unit}
          onChange={handleChange}
          options={[
            { value: 'tola', label: 'Per Tola (11.664g)' },
            { value: 'gram', label: 'Per Gram' },
          ]}
          required
        />

        {Number(form.rate) > 0 && form.unit === 'tola' && (
          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm">
            <p className="text-blue-800">
              <span className="font-medium">Auto-calculated:</span>{' '}
              Rate per Gram ={' '}
              <span className="font-bold">
                {ratePerGram.toFixed(2)}
              </span>
            </p>
          </div>
        )}

        <FormInput
          label="Date"
          name="date"
          type="date"
          value={form.date}
          onChange={handleChange}
          required
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {isEditing ? 'Update Rate' : 'Create Rate'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default RateForm
