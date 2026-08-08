import FormField from './FormField'

import NepaliDate from 'nepali-date-converter'

const adToBs = (dateStr) => {
  if (!dateStr) return ''

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''

  try {
    const nd = new NepaliDate(date)
    return nd.format('YYYY/MM/DD') + ' BS'
  } catch {
    const bsYear = date.getFullYear() + 57
    const bsMonth = date.getMonth() + 1
    const bsDay = date.getDate()
    return `${bsYear}-${String(bsMonth).padStart(2, '0')}-${String(bsDay).padStart(2, '0')} BS`
  }
}

const DatePicker = ({ label, name = 'date', id, value, onChange, error, required = false }) => {
  const bsDate = adToBs(value)

  return (
    <FormField label={label} name={name} error={error} required={required}>
      <input
        id={id || name}
        type="date"
        value={value || ''}
        onChange={onChange}
        aria-invalid={!!error}
        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] transition-all focus:outline-none focus:ring-2 ${
          error
            ? 'border-danger/50 focus:border-danger focus:ring-danger/20'
            : 'border-[var(--color-border)] hover:border-[var(--color-ink-300)] focus:border-[var(--color-gold-500)] focus:ring-[var(--color-gold-500)]/20'
        }`}
      />
      {bsDate && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{bsDate}</p>}
    </FormField>
  )
}

export default DatePicker