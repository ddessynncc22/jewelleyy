import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, X } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import FormInput from '../../components/ui/FormInput'
import FormSelect from '../../components/ui/FormSelect'
import { createLooseLot, updateLooseLot } from '../../services/looseLotService'
import { getItems } from '../../services/itemService'
import { getKarigars } from '../../services/karigarService'
import { getCategories, createCategory, deleteCategory } from '../../services/categoryService'
import { gramsToLaal } from '../../utils/helpers'

const METAL_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'gemstone', label: 'Gemstone' },
]

const CHARGE_TYPES = [
  { value: 'per_piece', label: 'Per piece' },
  { value: 'per_gram', label: 'Per gram' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'none', label: 'None' },
]

const PURITY_OPTIONS = [
  { value: '999', label: '999 (24K)' },
  { value: '995', label: '995' },
  { value: '916', label: '916 (22K)' },
  { value: '875', label: '875 (21K)' },
  { value: '750', label: '750 (18K)' },
  { value: '585', label: '585 (14K)' },
  { value: '375', label: '375 (10K)' },
]

const emptyForm = {
  itemId: '',
  category: '',
  subcategory: '',
  metalType: 'gold',
  purity: '916',
  karat: '22',
  length: '',
  lengthUnit: 'mm',
  diameter: '',
  diameterUnit: 'mm',
  karigarId: '',
  itemName: '',
  designCode: '',
  totalGrossWeight: '',
  totalGrossWeightLaal: '',
  totalPieces: '',
  makingChargeType: 'per_piece',
  makingChargeValue: '0',
  lowStockPiecesThreshold: '0',
  lowStockWeightThreshold: '0',
  notes: '',
}

const LooseLotForm = ({ lot, onClose, onSuccess }) => {
  const isEdit = !!lot
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [karigars, setKarigars] = useState([])
  const [showCategoryInput, setShowCategoryInput] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState(null)
  const [newSubcategory, setNewSubcategory] = useState('')
  const [showSubcategoryInput, setShowSubcategoryInput] = useState(false)
  const [subcategoryToDelete, setSubcategoryToDelete] = useState(null)
  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState([])
  const [linkedItem, setLinkedItem] = useState(null)
  const [itemPickerOpen, setItemPickerOpen] = useState(false)

  const loadCategories = () =>
    getCategories()
      .then((res) => {
        const d = res.data?.data || []
        setCategories(Array.isArray(d) ? d.map((c) => ({
          value: c.name,
          label: c.name,
          id: c._id,
          parent: c.parent?._id || c.parent || null,
        })) : [])
      })
      .catch(() => {})

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    getKarigars({ limit: 500 })
      .then((res) => {
        const d = res.data?.data || []
        setKarigars(Array.isArray(d) ? d.map((k) => ({ value: k._id, label: k.name })) : [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!lot) return
    if (lot.length || lot.diameter) setShowDimensions(true)
      setForm({
      itemId: lot.item?._id || lot.item || '',
      category: lot.category || '',
      subcategory: lot.subcategory || '',
      metalType: lot.metalType || 'gold',
      purity: String(lot.purity ?? ''),
      karat: String(lot.karat ?? ''),
      length: String(lot.length ?? ''),
      lengthUnit: lot.lengthUnit || 'mm',
      diameter: String(lot.diameter ?? ''),
      diameterUnit: lot.diameterUnit || 'mm',
      karigarId: lot.karigarId?._id || lot.karigarId || '',
      itemName: lot.itemName || '',
      designCode: lot.designCode || '',
      totalGrossWeight: String(lot.totalGrossWeight ?? ''),
      totalGrossWeightLaal: lot.totalGrossWeight ? gramsToLaal(Number(lot.totalGrossWeight)) : '',
      totalPieces: String(lot.totalPieces ?? ''),
      makingChargeType: lot.makingChargeType || 'per_piece',
      makingChargeValue: String(lot.makingChargeValue ?? '0'),
      lowStockPiecesThreshold: String(lot.lowStockPiecesThreshold ?? '0'),
      lowStockWeightThreshold: String(lot.lowStockWeightThreshold ?? '0'),
      notes: lot.notes || '',
    })
    setLinkedItem(lot.item || null)
  }, [lot])

  useEffect(() => {
    if (!itemSearch || isEdit) return
    const timer = setTimeout(async () => {
      try {
        const res = await getItems({ search: itemSearch, limit: 8 })
        const d = res.data?.data || []
        setItemResults(Array.isArray(d) ? d : [])
      } catch {
        setItemResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [itemSearch, isEdit])

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleGrossWeightChange = (e) => {
    const { value } = e.target
    set('totalGrossWeight', value)
    if (value === '') {
      set('totalGrossWeightLaal', '')
      return
    }
    const grams = Number(value)
    if (!isNaN(grams)) set('totalGrossWeightLaal', gramsToLaal(grams))
  }

  const handleLaalChange = (e) => {
    const { value } = e.target
    set('totalGrossWeightLaal', value)
    if (value === '') {
      set('totalGrossWeight', '')
      return
    }
    const laal = Number(value)
    if (!isNaN(laal)) set('totalGrossWeight', laalToGrams(laal))
  }

  const pickItem = (item) => {
    setLinkedItem(item)
    setItemId(item._id)
    setItemSearch(item.itemName || item.SKU)
    setItemPickerOpen(false)
  }

  const setItemId = (id) => setForm((prev) => ({ ...prev, itemId: id }))

  const clearLinkedItem = () => {
    setLinkedItem(null)
    setItemId('')
    setItemSearch('')
  }

  const selectedCategoryId = categories.find((c) => c.value === form.category)?.id

  const addCategory = async () => {
    const name = newCategory.trim()
    if (!name) return toast.error('Enter a category name')
    try {
      const res = await createCategory({ name })
      const created = res.data?.data
      await loadCategories()
      if (created?.name) set('category', created.name)
      setNewCategory('')
      setShowCategoryInput(false)
      toast.success('Category added')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add category')
    }
  }

  const confirmRemoveCategory = () => {
    const cat = categories.find((c) => c.id === selectedCategoryId)
    if (!cat) return toast.error('Select a category to remove')
    setCategoryToDelete(cat)
  }

  const handleRemoveCategory = async () => {
    if (!categoryToDelete) return
    try {
      await deleteCategory(categoryToDelete.id)
      setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id))
      if (form.category === categoryToDelete.value) set('category', '')
      toast.success('Category removed')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove category')
    } finally {
      setCategoryToDelete(null)
    }
  }

   const subcategoryOptions = categories.filter((c) => c.parent === selectedCategoryId)

  const addSubcategory = async () => {
    const name = newSubcategory.trim()
    if (!name) return toast.error('Enter a subcategory name')
    if (!selectedCategoryId) return toast.error('Select a category first')
    try {
      const res = await createCategory({ name, parent: selectedCategoryId })
      const created = res.data?.data
      await loadCategories()
      if (created?.name) set('subcategory', created.name)
      setNewSubcategory('')
      setShowSubcategoryInput(false)
      toast.success('Subcategory added')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add subcategory')
    }
  }

  const confirmRemoveSubcategory = () => {
    const sub = subcategoryOptions.find((c) => c.value === form.subcategory)
    if (!sub) return toast.error('Select a subcategory to remove')
    setSubcategoryToDelete(sub)
  }

  const handleRemoveSubcategory = async () => {
    if (!subcategoryToDelete) return
    try {
      await deleteCategory(subcategoryToDelete.id)
      setCategories((prev) => prev.filter((c) => c.id !== subcategoryToDelete.id))
      if (form.subcategory === subcategoryToDelete.value) set('subcategory', '')
      toast.success('Subcategory removed')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove subcategory')
    } finally {
      setSubcategoryToDelete(null)
    }
  }

  const avgWeight =
    Number(form.totalGrossWeight) > 0 && Number(form.totalPieces) > 0
      ? (Number(form.totalGrossWeight) / Number(form.totalPieces)).toFixed(4)
      : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const gross = Number(form.totalGrossWeight)
    const pieces = Number(form.totalPieces)
    if (!gross || gross <= 0) return toast.error('Total gross weight must be greater than 0')
    if (!pieces || pieces < 1) return toast.error('Total pieces must be at least 1')
    if (!linkedItem && (!form.category || !form.metalType || !form.purity)) {
      return toast.error('Category, metal type and purity are required (or link an existing item)')
    }

     const payload = {
       itemId: form.itemId || undefined,
       category: form.category,
       subcategory: form.subcategory || '',
       metalType: form.metalType,
      purity: form.purity ? Number(form.purity) : undefined,
      karat: form.karat ? Number(form.karat) : 0,
      length: Number(form.length) || 0,
      lengthUnit: form.lengthUnit || 'mm',
      diameter: Number(form.diameter) || 0,
      diameterUnit: form.diameterUnit || 'mm',
      karigarId: form.karigarId || undefined,
      itemName: form.itemName,
      designCode: form.designCode,
      totalGrossWeight: gross,
      totalPieces: pieces,
      makingChargeType: form.makingChargeType,
      makingChargeValue: Number(form.makingChargeValue) || 0,
      lowStockPiecesThreshold: Number(form.lowStockPiecesThreshold) || 0,
      lowStockWeightThreshold: Number(form.lowStockWeightThreshold) || 0,
      notes: form.notes,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await updateLooseLot(lot._id, payload)
        toast.success('Loose lot updated')
      } else {
        await createLooseLot(payload)
        toast.success('Loose lot created')
      }
      onSuccess?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save loose lot')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Loose Lot' : 'Create Loose Lot'} size="3xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {!isEdit && (
          <div>
            <div className="mb-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                Link existing item <span className="text-xs text-[var(--color-text-secondary)]">(optional — otherwise fill details below)</span>
              </span>
            </div>
            <div className="relative">
              <input
                value={itemSearch}
                onChange={(e) => {
                  setItemSearch(e.target.value)
                  setItemPickerOpen(true)
                }}
                onFocus={() => itemSearch && setItemPickerOpen(true)}
                onBlur={() => setTimeout(() => setItemPickerOpen(false), 200)}
                placeholder="Search item by name, SKU, design code..."
                className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
              {linkedItem && (
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs">
                  <span className="text-emerald-700">
                    Linked: {linkedItem.itemName} · {linkedItem.SKU}
                  </span>
                  <button type="button" onClick={clearLinkedItem} className="font-medium text-emerald-700 underline">
                    Unlink
                  </button>
                </div>
              )}
              {itemPickerOpen && itemResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg max-h-48 overflow-y-auto">
                  {itemResults.map((it) => (
                    <button
                      key={it._id}
                      type="button"
                      onMouseDown={() => pickItem(it)}
                      className="w-full px-3.5 py-2 text-left text-sm hover:bg-[var(--color-elevated)]"
                    >
                      {it.itemName} <span className="text-xs text-[var(--color-text-secondary)]">{it.SKU} · {it.metalType}/{it.purity}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!linkedItem && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--color-text)]">Category</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategory('')
                      setShowCategoryInput((v) => !v)
                    }}
                    title={showCategoryInput ? 'Close' : 'Add new category'}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-elevated)]"
                  >
                    <Plus size={14} /> {showCategoryInput ? 'Close' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={confirmRemoveCategory}
                    disabled={!selectedCategoryId}
                    title="Remove selected category"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
               {showCategoryInput ? (
                 <div className="flex items-center gap-2">
                   <input
                     autoFocus
                     value={newCategory}
                     onChange={(e) => setNewCategory(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         e.preventDefault()
                         addCategory()
                       }
                       if (e.key === 'Escape') setShowCategoryInput(false)
                     }}
                     placeholder="New category name"
                     className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                   />
                   <Button type="button" size="sm" onClick={addCategory} disabled={!newCategory.trim()}>
                     Save
                   </Button>
                   <Button type="button" variant="ghost" size="sm" onClick={() => setShowCategoryInput(false)}>
                     Cancel
                   </Button>
                 </div>
                ) : (
                  <FormSelect
                    name="category"
                    options={categories.filter((c) => !c.parent)}
                    value={form.category}
                    onChange={(e) => { set('category', e.target.value); set('subcategory', '') }}
                    placeholder="Select category"
                    required
                  />
                )}
                {selectedCategoryId && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--color-text)]">Subcategory</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setNewSubcategory('')
                            setShowSubcategoryInput((v) => !v)
                          }}
                          title={showSubcategoryInput ? 'Close' : `Add subcategory under ${categories.find((c) => c.id === selectedCategoryId)?.label}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-elevated)]"
                        >
                          <Plus size={14} /> {showSubcategoryInput ? 'Close' : 'Add'}
                        </button>
                        <button
                          type="button"
                          onClick={confirmRemoveSubcategory}
                          disabled={!form.subcategory}
                          title="Remove selected subcategory"
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </div>
                    {showSubcategoryInput ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={newSubcategory}
                          onChange={(e) => setNewSubcategory(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addSubcategory()
                            }
                            if (e.key === 'Escape') setShowSubcategoryInput(false)
                          }}
                          placeholder={`Subcategory under ${categories.find((c) => c.id === selectedCategoryId)?.label}`}
                          className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                        <Button type="button" size="sm" onClick={addSubcategory} disabled={!newSubcategory.trim()}>
                          Save
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowSubcategoryInput(false)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <FormSelect
                        name="subcategory"
                        options={subcategoryOptions}
                        value={form.subcategory}
                        onChange={(e) => set('subcategory', e.target.value)}
                        placeholder="Select subcategory"
                      />
                    )}
                  </div>
                )}
              </div>
              <FormSelect
                label="Metal Type"
              name="metalType"
              options={METAL_OPTIONS}
              value={form.metalType}
              onChange={(e) => set('metalType', e.target.value)}
              required
            />
            <div>
              <FormSelect
                label="Purity"
                name="purity"
                options={PURITY_OPTIONS}
                value={form.purity}
                onChange={(e) => {
                  const v = e.target.value
                  set('purity', v)
                  const map = { 999: '24', 995: '24', 916: '22', 875: '21', 750: '18', 585: '14', 375: '10' }
                  if (map[v]) set('karat', map[v])
                }}
                required
              />
            </div>
            <FormInput label="Karat" name="karat" type="number" value={form.karat} onChange={(e) => set('karat', e.target.value)} />
            <FormInput label="Item Name" name="itemName" value={form.itemName} onChange={(e) => set('itemName', e.target.value)} placeholder="e.g. Nose pin set" />
            <FormInput label="Design Code" name="designCode" value={form.designCode} onChange={(e) => set('designCode', e.target.value)} placeholder="Optional" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormInput
            label="Total Gross Weight (g)"
            name="totalGrossWeight"
            type="number"
            step="0.001"
            min="0"
            value={form.totalGrossWeight}
            onChange={handleGrossWeightChange}
            required
            placeholder="0.000"
          />
          <FormInput
            label="Total Gross Weight (laal)"
            name="totalGrossWeightLaal"
            type="number"
            step="0.001"
            min="0"
            value={form.totalGrossWeightLaal}
            onChange={handleLaalChange}
            placeholder="0.000"
          />
          <FormInput
            label="Total Pieces"
            name="totalPieces"
            type="number"
            min="1"
            step="1"
            value={form.totalPieces}
            onChange={(e) => set('totalPieces', e.target.value)}
            required
          />
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-3.5 py-2.5">
            <p className="text-xs text-[var(--color-text-secondary)]">Avg weight / piece</p>
            <p className="text-lg font-semibold text-[var(--color-text)]">
              {avgWeight != null ? `${avgWeight} g` : '—'}
            </p>
          </div>
          <FormSelect
            label="Making Charge Type"
            name="makingChargeType"
            options={CHARGE_TYPES}
            value={form.makingChargeType}
            onChange={(e) => set('makingChargeType', e.target.value)}
          />
          <FormInput
            label="Making Charge Value"
            name="makingChargeValue"
            type="number"
            step="0.01"
            min="0"
            value={form.makingChargeValue}
            onChange={(e) => set('makingChargeValue', e.target.value)}
          />
           <FormSelect
             label="Assign Karigar"
             name="karigarId"
             options={karigars}
             value={form.karigarId}
             onChange={(e) => set('karigarId', e.target.value)}
             placeholder="Unassigned"
           />
         </div>

         <div>
           <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
             <h3 className="text-base font-semibold text-gray-900">Dimensions</h3>
             <button
               type="button"
               onClick={() => setShowDimensions((v) => !v)}
               title={showDimensions ? 'Hide dimensions' : 'Add dimensions'}
               className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-elevated)]"
             >
               {showDimensions ? <X size={14} /> : <Plus size={14} />} {showDimensions ? 'Close' : 'Add'}
             </button>
           </div>
           {showDimensions && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="flex items-center gap-2">
                 <FormInput
                   label="Length"
                   name="length"
                   type="number"
                   step="0.01"
                   min="0"
                   value={form.length}
                   onChange={(e) => set('length', e.target.value)}
                   placeholder="0.00"
                   className="flex-1"
                 />
                 <FormSelect
                   name="lengthUnit"
                   value={form.lengthUnit}
                   onChange={(e) => set('lengthUnit', e.target.value)}
                   options={[
                     { value: 'mm', label: 'mm' },
                     { value: 'cm', label: 'cm' },
                     { value: 'inch', label: 'inch' },
                   ]}
                   className="w-20"
                 />
               </div>
               <div className="flex items-center gap-2">
                 <FormInput
                   label="Diameter"
                   name="diameter"
                   type="number"
                   step="0.01"
                   min="0"
                   value={form.diameter}
                   onChange={(e) => set('diameter', e.target.value)}
                   placeholder="0.00"
                   className="flex-1"
                 />
                 <FormSelect
                   name="diameterUnit"
                   value={form.diameterUnit}
                   onChange={(e) => set('diameterUnit', e.target.value)}
                   options={[
                     { value: 'mm', label: 'mm' },
                     { value: 'cm', label: 'cm' },
                     { value: 'inch', label: 'inch' },
                   ]}
                   className="w-20"
                 />
               </div>
             </div>
           )}
         </div>

         <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-4">
           <p className="mb-3 text-sm font-medium text-[var(--color-text)]">Low stock alerts (0 = off)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              label="Alert at (pieces)"
              name="lowStockPiecesThreshold"
              type="number"
              min="0"
              step="1"
              value={form.lowStockPiecesThreshold}
              onChange={(e) => set('lowStockPiecesThreshold', e.target.value)}
            />
            <FormInput
              label="Alert at (weight g)"
              name="lowStockWeightThreshold"
              type="number"
              min="0"
              step="0.001"
              value={form.lowStockWeightThreshold}
              onChange={(e) => set('lowStockWeightThreshold', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows="2"
            className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            placeholder="Optional"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Update Lot' : 'Create Lot'}
          </Button>
        </div>
      </form>

       <ConfirmDialog
         isOpen={!!categoryToDelete}
         onClose={() => setCategoryToDelete(null)}
         onConfirm={handleRemoveCategory}
         title="Remove category"
         message={`Delete category "${categoryToDelete?.label}"? Items already using it keep their category name.`}
         confirmText="Remove"
         variant="danger"
       />
       <ConfirmDialog
         isOpen={!!subcategoryToDelete}
         onClose={() => setSubcategoryToDelete(null)}
         onConfirm={handleRemoveSubcategory}
         title="Remove subcategory"
         message={`Delete subcategory "${subcategoryToDelete?.label}"? Items already using it keep their subcategory name.`}
         confirmText="Remove"
         variant="danger"
       />
     </Modal>
   )
 }

export default LooseLotForm
