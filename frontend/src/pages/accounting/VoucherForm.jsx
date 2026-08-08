import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, Scale, Coins } from 'lucide-react'

import { getLedgers, getVoucher, createVoucher, updateVoucher, VOUCHER_TYPES } from '../../services/accountingService'

import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import FormInput from '../../components/ui/FormInput'
import FormSelect from '../../components/ui/FormSelect'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import { formatCurrency } from '../../utils/helpers'

const TYPE_GUIDANCE = {
  payment: 'Cash/Bank ledger is credited; expense or Sundry Creditor ledger is debited.',
  receipt: 'Cash/Bank ledger is debited; income or Sundry Debtor ledger is credited.',
  contra: 'Cash ↔ Bank transfer only. Both ledgers must be Cash or Bank.',
  journal: 'Free-form debit/credit entry — opening balances, adjustments, write-offs.',
  metal_to_cash: 'Stock ledger credited, Cash/Debtor debited. Weight × (purity/1000) × rate = value.',
}

const CASH_BANK = ['cash', 'bank']

const VoucherForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [ledgers, setLedgers] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'payment',
    date: new Date().toISOString().slice(0, 10),
    narration: '',
    referenceNo: '',
  })
  const [lines, setLines] = useState([
    { key: Date.now() + 1, ledgerId: '', debit: '', credit: '', narration: '' },
    { key: Date.now() + 2, ledgerId: '', debit: '', credit: '', narration: '' },
  ])
  const [metalDetails, setMetalDetails] = useState([
    { key: Date.now() + 3, metalType: 'gold', purity: '999', weightG: '', ratePerG: '' },
  ])

  const fetchLedgers = useCallback(async () => {
    try {
      const res = await getLedgers({ limit: 500 })
      setLedgers(res.data?.data || [])
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load ledgers')
    }
  }, [])

  useEffect(() => {
    fetchLedgers()
  }, [fetchLedgers])

  useEffect(() => {
    if (!isEdit) return
    const fetchVoucher = async () => {
      try {
        const res = await getVoucher(id)
        const v = res.data?.data || res.data
        setForm({
          type: v.type,
          date: new Date(v.date).toISOString().slice(0, 10),
          narration: v.narration || '',
          referenceNo: v.referenceNo || '',
        })
        setLines(
          (v.entries || []).map((entry, i) => ({
            key: Date.now() + i + 100,
            ledgerId: entry.ledger?._id || entry.ledger || '',
            debit: entry.debit ? String(entry.debit) : '',
            credit: entry.credit ? String(entry.credit) : '',
            narration: entry.narration || '',
          })),
        )
        if (v.type === 'metal_to_cash' && (v.metalDetails || []).length > 0) {
          setMetalDetails(
            v.metalDetails.map((d, i) => ({
              key: Date.now() + i + 200,
              metalType: d.metalType,
              purity: String(d.purity),
              weightG: String(d.weightG),
              ratePerG: String(d.ratePerG),
            })),
          )
        }
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to load voucher')
      } finally {
        setLoading(false)
      }
    }
    fetchVoucher()
  }, [id, isEdit])

  const handleTypeChange = (type) => {
    setForm((prev) => ({ ...prev, type }))
    setLines([
      { key: Date.now() + 1, ledgerId: '', debit: '', credit: '', narration: '' },
      { key: Date.now() + 2, ledgerId: '', debit: '', credit: '', narration: '' },
    ])
    if (type === 'metal_to_cash') {
      setMetalDetails([{ key: Date.now() + 3, metalType: 'gold', purity: '999', weightG: '', ratePerG: '' }])
    }
  }

  const setLine = (index, patch) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const addLine = () => {
    setLines((prev) => [...prev, { key: Date.now(), ledgerId: '', debit: '', credit: '', narration: '' }])
  }

  const removeLine = (index) => {
    setLines((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev))
  }

  const setMetal = (index, patch) => {
    setMetalDetails((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  // Metal to Cash: amounts are derived from the metal details, never typed.
  useEffect(() => {
    if (form.type !== 'metal_to_cash') return
    const value = metalDetails.reduce((sum, m) => {
      const weight = Number(m.weightG) || 0
      const purity = Number(m.purity) || 0
      const rate = Number(m.ratePerG) || 0
      return sum + weight * (purity / 1000) * rate
    }, 0)
    const rounded = Math.round(value * 100) / 100
    setLines((prev) =>
      prev.map((line, i) => {
        if (i === 0) return { ...line, debit: rounded > 0 ? String(rounded) : '', credit: '' }
        if (i === 1) return { ...line, credit: rounded > 0 ? String(rounded) : '', debit: '' }
        return line
      }),
    )
  }, [form.type, metalDetails])

  const addMetal = () => {
    setMetalDetails((prev) => [...prev, { key: Date.now(), metalType: 'gold', purity: '999', weightG: '', ratePerG: '' }])
  }

  const removeMetal = (index) => {
    setMetalDetails((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  const metalValue = metalDetails.reduce((sum, m) => {
    const weight = Number(m.weightG) || 0
    const purity = Number(m.purity) || 0
    const rate = Number(m.ratePerG) || 0
    return sum + weight * (purity / 1000) * rate
  }, 0)

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0)
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100
  const balanced = Math.abs(difference) < 0.005 && totalDebit > 0

  const isContra = form.type === 'contra'
  const isMetal = form.type === 'metal_to_cash'

  const ledgerOptions = (filter) =>
    ledgers
      .filter(filter)
      .map((l) => ({ value: l._id, label: `${l.name} (${l.type})` }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!balanced) {
      toast.error('Voucher does not balance — Debits and Credits must be equal')
      return
    }
    setSaving(true)
    try {
      const payload = {
        type: form.type,
        date: form.date,
        narration: form.narration,
        referenceNo: form.referenceNo,
        entries: lines
          .filter((l) => l.ledgerId && ((Number(l.debit) > 0) || (Number(l.credit) > 0)))
          .map((l) => ({
            ledger: l.ledgerId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            narration: l.narration || '',
          })),
      }
      if (isMetal) {
        payload.metalDetails = metalDetails.map((m) => ({
          metalType: m.metalType,
          purity: Number(m.purity) || 0,
          weightG: Number(m.weightG) || 0,
          ratePerG: Number(m.ratePerG) || 0,
        }))
      }
      if (isEdit) {
        await updateVoucher(id, payload)
        toast.success('Voucher updated successfully')
      } else {
        await createVoucher(payload)
        toast.success('Voucher created successfully')
      }
      navigate('/accounting/vouchers')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save voucher')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingSkeleton count={4} type="card" />
  }

  const metalValueFormatted = formatCurrency(metalValue)

  return (
    <div className="space-y-6">
      <PageHeader title={isEdit ? 'Edit Voucher' : 'New Voucher'} subtitle="Double-entry voucher with balanced debit and credit lines">
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/accounting/vouchers')}>
          Back
        </Button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Voucher Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormSelect
              label="Voucher Type"
              name="type"
              options={VOUCHER_TYPES}
              value={form.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              required
            />
            <FormInput label="Date" name="date" type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} required />
            <FormInput label="Reference No." name="referenceNo" value={form.referenceNo} onChange={(e) => setForm((prev) => ({ ...prev, referenceNo: e.target.value }))} placeholder="Optional" />
            <FormInput label="Narration" name="narration" value={form.narration} onChange={(e) => setForm((prev) => ({ ...prev, narration: e.target.value }))} placeholder="What is this voucher for?" />
          </div>
          <p className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
            {TYPE_GUIDANCE[form.type]}
          </p>
        </Card>

        {isMetal && (
          <Card title="Metal to Cash Details" icon={Coins}>
            <p className="mb-3 text-xs text-gray-500">
              Value = Weight (g) × (Purity ÷ 1000) × Rate per gram. The computed value is <span className="font-semibold text-gray-900">{metalValueFormatted}</span> — the entries below are locked to this amount.
            </p>
            <div className="space-y-3">
              {metalDetails.map((m, i) => (
                <div key={m.key} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                  <FormSelect
                    label="Metal Type"
                    name="metalType"
                    options={[{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }]}
                    value={m.metalType}
                    onChange={(e) => setMetal(i, { metalType: e.target.value })}
                  />
                  <FormInput label="Purity" name="purity" type="number" step="1" min="0" max="1000" value={m.purity} onChange={(e) => setMetal(i, { purity: e.target.value })} placeholder="999" />
                  <FormInput label="Weight (g)" name="weightG" type="number" step="0.001" min="0" value={m.weightG} onChange={(e) => setMetal(i, { weightG: e.target.value })} placeholder="e.g. 25.5" required />
                  <FormInput label="Rate / g (Rs.)" name="ratePerG" type="number" step="1" min="0" value={m.ratePerG} onChange={(e) => setMetal(i, { ratePerG: e.target.value })} placeholder="e.g. 8500" required />
                  {metalDetails.length > 1 && (
                    <button type="button" onClick={() => removeMetal(i)} className="flex items-center justify-center p-2.5 rounded-xl text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" icon={<Plus size={14} />} onClick={addMetal}>
                Add Metal Line
              </Button>
            </div>
          </Card>
        )}

        <Card title="Voucher Entries" icon={Scale}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <th className="pb-2 pr-3">Ledger</th>
                  <th className="pb-2 pr-3 w-40">Debit (Rs.)</th>
                  <th className="pb-2 pr-3 w-40">Credit (Rs.)</th>
                  <th className="pb-2 pr-3">Entry Narration</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const options = isContra
                    ? ledgerOptions((l) => CASH_BANK.includes(l.type))
                    : isMetal
                      ? i === 0
                        ? ledgerOptions((l) => l.type !== 'stock')
                        : ledgerOptions((l) => l.type === 'stock')
                      : ledgerOptions(() => true)
                  const metalAuto = isMetal
                  return (
                    <tr key={line.key} className="border-b border-gray-100">
                      <td className="py-2 pr-3">
                        <FormSelect
                          label=""
                          name="ledgerId"
                          options={options}
                          value={line.ledgerId}
                          onChange={(e) => setLine(i, { ledgerId: e.target.value })}
                          placeholder={isMetal ? (i === 0 ? 'Select Cash / Debtor ledger' : 'Select Stock ledger (Gold/Silver)') : 'Select ledger'}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <FormInput
                          label=""
                          name="debit"
                          type="number"
                          step="0.01"
                          min="0"
                          value={metalAuto && i === 1 ? '' : line.debit}
                          disabled={metalAuto && i === 1}
                          onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })}
                          placeholder={metalAuto && i === 0 ? 'Auto from metal value' : '0.00'}
                        />
                        {metalAuto && i === 0 && (
                          <p className="mt-1 text-xs text-gray-500">Auto-filled from metal value</p>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <FormInput
                          label=""
                          name="credit"
                          type="number"
                          step="0.01"
                          min="0"
                          value={metalAuto && i === 0 ? '' : line.credit}
                          disabled={metalAuto && i === 0}
                          onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })}
                          placeholder={metalAuto && i === 1 ? 'Auto from metal value' : '0.00'}
                        />
                        {metalAuto && i === 1 && (
                          <p className="mt-1 text-xs text-gray-500">Auto-filled from metal value</p>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <FormInput
                          label=""
                          name="entryNarration"
                          value={line.narration}
                          onChange={(e) => setLine(i, { narration: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>
                      <td className="py-2">
                        <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2} className="p-2 rounded-xl text-red-500 hover:bg-red-50 disabled:opacity-30">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
            <Button type="button" variant="outline" size="sm" icon={<Plus size={14} />} onClick={addLine} disabled={isMetal}>
              Add Line
            </Button>

            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">Debits: <span className="font-semibold text-gray-900">{formatCurrency(totalDebit)}</span></span>
              <span className="text-gray-600">Credits: <span className="font-semibold text-gray-900">{formatCurrency(totalCredit)}</span></span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  balanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {balanced ? '✓ Balanced' : `Out of balance by ${formatCurrency(Math.abs(difference))}`}
              </span>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => navigate('/accounting/vouchers')} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!balanced}>
            {isEdit ? 'Update Voucher' : 'Save Voucher'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default VoucherForm