import { useState, useEffect, useCallback } from 'react'

import toast from 'react-hot-toast'

import { createStockIn, createStockOut } from '../../services/stockService'

import { getItems } from '../../services/itemService'

import Modal from '../../components/ui/Modal'

import FormInput from '../../components/ui/FormInput'

import FormSelect from '../../components/ui/FormSelect'

import FormTextarea from '../../components/ui/FormTextarea'

import FormField from '../../components/ui/FormField'

import Button from '../../components/ui/Button'
import { formatWeight } from '../../utils/helpers'

const STOCK_IN_TYPES = [
  { value: 'Purchase', label: 'Purchase' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Return from Karigar', label: 'Return from Karigar' },
  { value: 'Pawn Redemption', label: 'Bandaki Redemption' },
  { value: 'Sale Return', label: 'Sale Return' },
  { value: 'Transfer In', label: 'Transfer In' },
  { value: 'Adjustment', label: 'Adjustment' },
]

const STOCK_OUT_TYPES = [
  { value: 'Sale', label: 'Sale' },
  { value: 'Branch Transfer', label: 'Branch Transfer' },
  { value: 'Damaged', label: 'Damaged' },
  { value: 'With Karigar', label: 'With Karigar' },
  { value: 'Pawn Issuance', label: 'Bandaki Intake' },
  { value: 'Melted', label: 'Melted' },
  { value: 'Purchase Return', label: 'Purchase Return' },
  { value: 'Transfer Out', label: 'Transfer Out' },
  { value: 'Adjustment', label: 'Adjustment' },
]

const PURITY_OPTIONS = [
  { value: '999', label: '999' },
  { value: '995', label: '995' },
  { value: '916', label: '916' },
  { value: '875', label: '875' },
  { value: '750', label: '750' },
  { value: '585', label: '585' },
  { value: '375', label: '375' },
]

const initialState = {
  category: '',
  itemId: '',
  quantity: '',
  weight: '',
  purity: '',
  reference: '',
  notes: '',
  movementDate: new Date().toISOString().split('T')[0],
}

const validate = (values, mode) => {
  const errors = {}
  if (!values.category) errors.category = 'Category is required'
  if (!values.itemId) errors.itemId = 'Item is required'
  if (!values.quantity || Number(values.quantity) <= 0) {
    errors.quantity = 'Quantity must be greater than 0'
  }
  if (!values.weight || Number(values.weight) <= 0) {
    errors.weight = 'Weight must be greater than 0'
  }
  if (!values.movementDate) errors.movementDate = 'Date is required'
  return errors
}

const StockForm = ({ mode, onClose, onSuccess }) => {
  const isStockIn = mode === 'in'

  const [form, setForm] = useState(initialState)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [itemSearch, setItemSearch] = useState('')
  const [itemsLoading, setItemsLoading] = useState(false)
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  const categoryOptions = isStockIn ? STOCK_IN_TYPES : STOCK_OUT_TYPES

  const fetchItems = useCallback(async (searchTerm) => {
    setItemsLoading(true)
    try {
      const params = { limit: 20 }
      if (searchTerm) params.search = searchTerm

      const res = await getItems(params)
      setItems(res.data.data || res.data || [])
    } catch {
      setItems([])
    } finally {
      setItemsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (itemSearch) {
      const timer = setTimeout(() => fetchItems(itemSearch), 300)
      return () => clearTimeout(timer)
    }
  }, [itemSearch, fetchItems])

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target
      setForm((prev) => ({ ...prev, [name]: value }))
      if (errors[name]) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next[name]
          return next
        })
      }
    },
    [errors],
  )

  const handleSelectItem = (item) => {
    setSelectedItem(item)
    setForm((prev) => ({ ...prev, itemId: item._id }))
    setShowItemDropdown(false)
    setItemSearch(
      `${item.itemName || item.name}${item.SKU ? ` (${item.SKU})` : item.sku ? ` (${item.sku})` : ''}`,
    )
    if (errors.itemId) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.itemId
        return next
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validationErrors = validate(form, mode)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    try {
      const payload = {
        itemId: form.itemId,
        category: form.category,
        quantity: Number(form.quantity),
        weight: Number(form.weight),
        movementDate: form.movementDate,
        notes: form.notes,
        reference: form.reference,
      }
      if (isStockIn) {
        payload.purity = form.purity
        await createStockIn(payload)
        toast.success('Stock In recorded successfully')
      } else {
        await createStockOut(payload)
        toast.success('Stock Out recorded successfully')
      }
      onSuccess?.()
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to record stock ${mode}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isStockIn ? 'New Stock In' : 'New Stock Out'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect
            label="Category"
            name="category"
            value={form.category}
            onChange={handleChange}
            options={categoryOptions}
            placeholder={`Select ${isStockIn ? 'stock in' : 'stock out'} category`}
            error={errors.category}
            required
          />

          <div className="sm:col-span-2">
            <FormField label="Item" name="itemId" error={errors.itemId} required>
              <div className="relative">
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value)
                    setShowItemDropdown(true)
                    setSelectedItem(null)
                    setForm((prev) => ({ ...prev, itemId: '' }))
                  }}
                  onFocus={() => {
                    if (!selectedItem) setShowItemDropdown(true)
                  }}
                  onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
                  placeholder="Search by item name or SKU..."
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all focus:outline-none focus:ring-2 ${
                    errors.itemId
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20'
                  }`}
                />
                {showItemDropdown && (
                  <div className="absolute z-10 mt-1 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg max-h-48">
                    {itemsLoading ? (
                      <div className="px-3.5 py-2 text-sm text-[var(--color-text-secondary)]">Loading...</div>
                    ) : items.length === 0 ? (
                      <div className="px-3.5 py-2 text-sm text-[var(--color-text-secondary)]">No items found</div>
                    ) : (
                      items.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          onMouseDown={() => handleSelectItem(item)}
                          className="w-full text-left px-3.5 py-2 text-sm transition-colors hover:bg-[var(--color-primary-light)] focus:bg-[var(--color-primary-light)]"
                        >
                          <span className="font-medium text-[var(--color-text)]">
                            {item.itemName || item.name}
                          </span>
                          {(item.SKU || item.sku) && (
                            <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                              SKU: {item.SKU || item.sku}
                            </span>
                          )}
                          {item.grossWeight && (
                            <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                              ({formatWeight(item.grossWeight)})
                            </span>
                          )}
                          <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                            Qty: {item.quantity ?? '-'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {selectedItem && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                      {selectedItem.itemName || selectedItem.name}
                      {selectedItem.SKU && <span className="ml-1">({selectedItem.SKU})</span>}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
                      Current stock: {selectedItem.quantity ?? '-'}
                    </span>
                  </div>
                )}
              </div>
            </FormField>
          </div>

          <FormInput
            label="Quantity"
            name="quantity"
            type="number"
            step="1"
            min="1"
            value={form.quantity}
            onChange={handleChange}
            error={errors.quantity}
            required
            placeholder="1"
          />

          <FormInput
            label="Weight (g)"
            name="weight"
            type="number"
            step="0.001"
            value={form.weight}
            onChange={handleChange}
            error={errors.weight}
            required
            placeholder="0.000"
          />
        </div>

        {isStockIn && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Purity"
              name="purity"
              value={form.purity}
              onChange={handleChange}
              options={PURITY_OPTIONS}
              placeholder="Select purity"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Reference Number"
            name="reference"
            value={form.reference}
            onChange={handleChange}
            placeholder="Invoice / challan / note number"
          />
          <FormInput
            label="Date"
            name="movementDate"
            type="date"
            value={form.movementDate}
            onChange={handleChange}
            error={errors.movementDate}
            required
          />
        </div>

        <FormTextarea
          label="Notes"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="Additional notes..."
          rows={3}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isStockIn ? 'Record Stock In' : 'Record Stock Out'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default StockForm
