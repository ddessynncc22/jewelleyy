import { useState, useEffect, useRef, useCallback } from 'react'

import { Search, X } from 'lucide-react'

const SearchInput = ({ value = '', onChange, placeholder = 'Search...', className = '' }) => {
  const [local, setLocal] = useState(value)
  const timer = useRef(null)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const debounced = useCallback(
    (val) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => onChange?.(val), 300)
    },
    [onChange],
  )

  const handleChange = (e) => {
    const v = e.target.value
    setLocal(v)
    debounced(v)
  }

  const handleClear = () => {
    setLocal('')
    if (timer.current) clearTimeout(timer.current)
    onChange?.('')
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)] pointer-events-none" />
      <input
        type="text"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 pl-10 pr-10 text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
      />
      {local && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default SearchInput
