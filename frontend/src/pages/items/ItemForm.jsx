import { useState, useEffect, useCallback } from 'react'

import toast from 'react-hot-toast'

import { createItem, updateItem } from '../../services/itemService'
import { getKarigars } from '../../services/karigarService'
import { getCategories, createCategory } from '../../services/categoryService'

import Modal from '../../components/ui/Modal'

import FormInput from '../../components/ui/FormInput'

import FormSelect from '../../components/ui/FormSelect'

import FormTextarea from '../../components/ui/FormTextarea'

import Button from '../../components/ui/Button'



const METAL_TYPE_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'gemstone', label: 'Gemstone' },
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

const KARAT_OPTIONS = [
  { value: '24K', label: '24K' },
  { value: '22K', label: '22K' },
  { value: '21K', label: '21K' },
  { value: '18K', label: '18K' },
  { value: '14K', label: '14K' },
  { value: '10K', label: '10K' },
]



const STONE_TYPE_OPTIONS = [
  { value: 'diamond', label: 'Diamond' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'sapphire', label: 'Sapphire' },
  { value: 'pearl', label: 'Pearl' },
  { value: 'none', label: 'None' },
]

const CUT_OPTIONS = [
  { value: 'round', label: 'Round' },
  { value: 'princess', label: 'Princess' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'cushion', label: 'Cushion' },
  { value: 'marquise', label: 'Marquise' },
  { value: 'oval', label: 'Oval' },
  { value: 'pear', label: 'Pear' },
  { value: 'none', label: 'None' },
]

const CLARITY_OPTIONS = [
  { value: 'IF', label: 'IF' },
  { value: 'VVS1', label: 'VVS1' },
  { value: 'VVS2', label: 'VVS2' },
  { value: 'VS1', label: 'VS1' },
  { value: 'VS2', label: 'VS2' },
  { value: 'SI1', label: 'SI1' },
  { value: 'SI2', label: 'SI2' },
  { value: 'I1', label: 'I1' },
  { value: 'I2', label: 'I2' },
  { value: 'I3', label: 'I3' },
  { value: 'none', label: 'None' },
]

const STATUS_OPTIONS = [
  { value: 'In Stock', label: 'In Stock' },
  { value: 'Sold', label: 'Sold' },
  { value: 'With Karigar', label: 'With Karigar' },
  { value: 'Pawn Collateral', label: 'Bandaki Collateral' },
  { value: 'On Approval', label: 'On Approval' },
  { value: 'Branch Transfer', label: 'Branch Transfer' },
  { value: 'Damaged', label: 'Damaged' },
  { value: 'Melted', label: 'Melted' },
]

const initialState = {
  name: '',
  category: '',
  designCode: '',
  description: '',
  grossWeight: '',
  stoneWeight: '0',
  quantity: '1',
  metalType: '',
  purity: '',
  karat: '',
  karigarId: '',
  stoneType: '',
  carat: '',
  cut: '',
  clarity: '',
  certificationNumber: '',
  status: 'In Stock',
  costPrice: '',
  costMakingCharge: '',
  costWastagePercent: '',
  sellingPrice: '',
  sellingMakingCharge: '',
  sellingWastagePercent: '',
  makingCharge: '',
  wastagePercent: '',
}

const validate = (values) => {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Item name is required'
  if (!values.category) errors.category = 'Category is required'
  if (!values.metalType) errors.metalType = 'Metal type is required'
  if (!values.purity) errors.purity = 'Purity is required'
  if (!values.karat) errors.karat = 'Karat is required'
  if (!values.grossWeight || Number(values.grossWeight) <= 0) {
    errors.grossWeight = 'Gross weight must be greater than 0'
  }
  if (Number(values.stoneWeight) < 0) {
    errors.stoneWeight = 'Stone weight cannot be negative'
  }
  if (!values.costPrice) {
    errors.costPrice = 'Cost price is required'
  } else if (isNaN(values.costPrice) || Number(values.costPrice) <= 0) {
    errors.costPrice = 'Enter a valid cost price'
  }
  if (!values.costMakingCharge && !values.costWastagePercent) {
    errors.costPricing = 'Either making charge or wastage is required for cost'
  }
  if (values.sellingPrice && (isNaN(values.sellingPrice) || Number(values.sellingPrice) <= 0)) {
    errors.sellingPrice = 'Enter a valid selling price'
  }
  if (values.sellingPrice && !values.sellingMakingCharge && !values.sellingWastagePercent) {
    errors.sellingPricing = 'Either making charge or wastage is required for selling price'
  }
  return errors
}

const ItemForm = ({ item, onClose, onSuccess }) => {
  const isEditing = !!item
  const [form, setForm] = useState(initialState)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [karigars, setKarigars] = useState([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [images, setImages] = useState([])
  const [newFiles, setNewFiles] = useState([])

  useEffect(() => {
    getCategories().then((res) => {
      const list = res.data?.data || res.data || []
      setCategories(Array.isArray(list) ? list : [])
    }).catch(() => {})
    getKarigars({ limit: 100 }).then((res) => {
      const list = res.data?.data || res.data || []
      setKarigars(Array.isArray(list) ? list : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (item) {
      setForm({
        name: item.itemName || item.name || '',
        category: item.category || '',
        designCode: item.designCode || '',
        description: item.description || '',
        grossWeight: item.grossWeight ?? '',
        stoneWeight: item.stoneWeight ?? '0',
        quantity: item.quantity ?? '1',
        metalType: item.metalType || '',
        purity: item.purity || '',
        karat: item.karat || '',
        karigarId: item.karigarId || '',
        stoneType: item.stoneType || '',
        carat: item.carat ?? '',
        cut: item.cut || '',
        clarity: item.clarity || '',
        certificationNumber: item.certificationNumber || '',
        status: item.status || 'In Stock',
        costPrice: item.costPrice ?? '',
        costMakingCharge: item.costMakingCharge ?? '',
        costWastagePercent: item.costWastagePercent ?? '',
        sellingPrice: item.sellingPrice ?? '',
        sellingMakingCharge: item.sellingMakingCharge ?? '',
        sellingWastagePercent: item.sellingWastagePercent ?? '',
        makingCharge: item.makingCharge ?? '',
        wastagePercent: item.wastagePercent ?? '',
      })
      if (item.images?.length) {
        setImages(item.images)
      }
    }
  }, [item])

  const netMetalWeight = (
    Math.max(0, Number(form.grossWeight || 0) - Number(form.stoneWeight || 0))
  ).toFixed(3)

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

  const handleImageInput = useCallback((e) => {
    setNewFiles((prev) => [...prev, ...Array.from(e.target.files)])
  }, [])

  const removeExistingImage = useCallback((index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const removeNewFile = useCallback((index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validationErrors = validate(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('itemName', form.name.trim())
      formData.append('category', form.category)
      formData.append('designCode', form.designCode)
      formData.append('description', form.description)
      formData.append('grossWeight', form.grossWeight)
      formData.append('stoneWeight', form.stoneWeight || '0')
      formData.append('netMetalWeight', netMetalWeight)
      formData.append('metalType', form.metalType)
      formData.append('purity', form.purity)
      formData.append('karat', form.karat ? form.karat.replace('K', '') : '')
      formData.append('karigarId', form.karigarId)
      formData.append('stoneType', form.stoneType)
      formData.append('carat', form.carat)
      formData.append('cut', form.cut)
      formData.append('clarity', form.clarity)
      formData.append('certificationNumber', form.certificationNumber)
      formData.append('status', form.status)
      formData.append('quantity', form.quantity || '1')
       formData.append('costPrice', form.costPrice)
       formData.append('costMakingCharge', form.costMakingCharge || '0')
       formData.append('costWastagePercent', form.costWastagePercent || '0')
       formData.append('sellingPrice', form.sellingPrice)
       formData.append('sellingMakingCharge', form.sellingMakingCharge || '0')
       formData.append('sellingWastagePercent', form.sellingWastagePercent || '0')
       formData.append('makingCharge', form.makingCharge || '0')
       formData.append('wastagePercent', form.wastagePercent || '0')
      if (isEditing) {
        formData.append('existingImages', JSON.stringify(images))
      }
      newFiles.forEach((file) => {
        formData.append('images', file)
      })

      if (isEditing) {
        await updateItem(item._id, formData)
        toast.success('Item updated successfully')
      } else {
        await createItem(formData)
        toast.success('Item created successfully')
      }
      onSuccess?.()
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          `Failed to ${isEditing ? 'update' : 'create'} item`,
      )
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    try {
      const res = await createCategory({ name })
      const cat = res.data?.data || res.data
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
      setForm((prev) => ({ ...prev, category: cat.name }))
      setNewCategoryName('')
      toast.success('Category created')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category')
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Edit Item' : 'Add New Item'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            General
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Item Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              error={errors.name}
              required
              placeholder="Enter item name"
            />
            <div>
              <FormSelect
                label="Category"
                name="category"
                value={form.category}
                onChange={handleChange}
                options={categories.map((c) => ({ value: c.name, label: c.name }))}
                placeholder="Select category"
                required
                error={errors.category}
              />
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name..."
                  className="flex-1 rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs bg-[var(--color-card)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors"
                >
                  + Add
                </button>
              </div>
            </div>
            <FormInput
              label="Design Code"
              name="designCode"
              value={form.designCode}
              onChange={handleChange}
              placeholder="Enter design code"
            />
            <div className="sm:col-span-2">
              <FormTextarea
                label="Description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Enter item description"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Weight
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Gross Weight (g)"
              name="grossWeight"
              type="number"
              step="0.001"
              value={form.grossWeight}
              onChange={handleChange}
              error={errors.grossWeight}
              required
              placeholder="0.000"
            />
            <FormInput
              label="Net Metal Weight (g)"
              name="netMetalWeight"
              value={netMetalWeight}
              disabled
            />
            <FormInput
              label="Stone Weight (g)"
              name="stoneWeight"
              type="number"
              step="0.001"
              value={form.stoneWeight}
              onChange={handleChange}
              error={errors.stoneWeight}
              placeholder="0.000"
            />
            <FormInput
              label="Quantity"
              name="quantity"
              type="number"
              min="0"
              step="1"
              value={form.quantity}
              onChange={handleChange}
              placeholder="1"
            />
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Metal
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormSelect
              label="Metal Type"
              name="metalType"
              value={form.metalType}
              onChange={handleChange}
              options={METAL_TYPE_OPTIONS}
              placeholder="Select metal type"
              required
              error={errors.metalType}
            />
            <FormSelect
              label="Purity"
              name="purity"
              value={form.purity}
              onChange={handleChange}
              options={PURITY_OPTIONS}
              placeholder="Select purity"
              required
              error={errors.purity}
            />
            <FormSelect
              label="Karat"
              name="karat"
              value={form.karat}
              onChange={handleChange}
              options={KARAT_OPTIONS}
              placeholder="Select karat"
              required
              error={errors.karat}
            />
            <FormSelect
              label="Karigar"
              name="karigarId"
              value={form.karigarId}
              onChange={handleChange}
              options={[
                { value: '', label: 'None' },
                ...karigars.map((k) => ({ value: k._id, label: k.name })),
              ]}
              placeholder="Select karigar"
            />
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Stone
          </h3>
          <div className="space-y-4">
            <FormSelect
              label="Stone Type"
              name="stoneType"
              value={form.stoneType}
              onChange={handleChange}
              options={STONE_TYPE_OPTIONS}
              placeholder="Select stone type"
            />
            {form.stoneType && form.stoneType !== 'none' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormInput
                  label="Carat"
                  name="carat"
                  type="number"
                  step="0.01"
                  value={form.carat}
                  onChange={handleChange}
                  placeholder="0.00"
                />
                <FormSelect
                  label="Cut"
                  name="cut"
                  value={form.cut}
                  onChange={handleChange}
                  options={CUT_OPTIONS}
                  placeholder="Select cut"
                />
                <FormSelect
                  label="Clarity"
                  name="clarity"
                  value={form.clarity}
                  onChange={handleChange}
                  options={CLARITY_OPTIONS}
                  placeholder="Select clarity"
                />
                <FormInput
                  label="Certification Number"
                  name="certificationNumber"
                  value={form.certificationNumber}
                  onChange={handleChange}
                  placeholder="Enter certification number"
                />
              </div>
            )}
            {(!form.stoneType || form.stoneType === 'none') && (
              <p className="text-sm text-gray-400 italic">
                Stone fields hidden — select a stone type to show them.
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Images
          </h3>
          <div className="space-y-3">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageInput}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="relative h-16 w-16 rounded-lg overflow-hidden border border-gray-200 group"
                  >
                    <img
                      src={typeof img === 'string' ? img : URL.createObjectURL(img)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(i)}
                      className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            {newFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {newFiles.map((f, i) => (
                  <div
                    key={i}
                    className="relative h-16 w-16 rounded-lg overflow-hidden border border-gray-200 group"
                  >
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewFile(i)}
                      className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Pricing
          </h3>
          {errors.costPricing && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-3">
              <p className="text-sm text-red-700">{errors.costPricing}</p>
            </div>
          )}
          {errors.sellingPricing && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-3">
              <p className="text-sm text-red-700">{errors.sellingPricing}</p>
            </div>
          )}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Cost</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="Cost Price ($)"
                  name="costPrice"
                  type="number"
                  step="0.01"
                  value={form.costPrice}
                  onChange={handleChange}
                  error={errors.costPrice}
                  required
                  placeholder="0.00"
                />
                <FormInput
                  label="Making Charge ($)"
                  name="costMakingCharge"
                  type="number"
                  step="0.01"
                  value={form.costMakingCharge}
                  onChange={handleChange}
                  placeholder="0.00"
                />
                <FormInput
                  label="Wastage (%)"
                  name="costWastagePercent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.costWastagePercent}
                  onChange={handleChange}
                  placeholder="0"
                />
                <div className="flex items-end">
                  <p className="text-xs text-gray-500">
                    Either making charge or wastage is required
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Selling</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="Selling Price ($)"
                  name="sellingPrice"
                  type="number"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={handleChange}
                  error={errors.sellingPrice}
                  placeholder="0.00 (optional)"
                />
                <FormInput
                  label="Making Charge ($)"
                  name="sellingMakingCharge"
                  type="number"
                  step="0.01"
                  value={form.sellingMakingCharge}
                  onChange={handleChange}
                  placeholder="0.00"
                />
                <FormInput
                  label="Wastage (%)"
                  name="sellingWastagePercent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.sellingWastagePercent}
                  onChange={handleChange}
                  placeholder="0"
                />
                <div className="flex items-end">
                  {form.sellingPrice && !form.sellingMakingCharge && !form.sellingWastagePercent ? (
                    <p className="text-xs text-red-500">Either making charge or wastage is required</p>
                  ) : (
                    <p className="text-xs text-gray-500">Either making charge or wastage is required</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Update Item' : 'Create Item'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ItemForm
