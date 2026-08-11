import { useState, useEffect } from 'react'
import { TrendingUp, Gem, RefreshCw, Clock } from 'lucide-react'
import { getLatestRates } from '../../services/rateService'
import { applyTransportRate, getTransportCharges } from '../../utils/helpers'

export default function TodaysRate() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getLatestRates()
      setData(res.data?.data || null)
    } catch (err) {
      setError('Could not load rates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRates()
    const interval = setInterval(fetchRates, 300000)
    return () => clearInterval(interval)
  }, [])

  const charges = getTransportCharges()
  const gold = applyTransportRate(data?.gold, charges.gold)
  const silver = applyTransportRate(data?.silver, charges.silver)

  const goldPerGram = gold?.unit === 'gram'
    ? gold.rate
    : gold?.rate ? Math.round(gold.rate / 11.664) : 0

  const silverPerGram = silver?.unit === 'gram'
    ? silver.rate
    : silver?.rate ? Math.round(silver.rate / 11.664) : 0

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-gold-600)]" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="text-center space-y-4">
          <p className="text-[var(--color-text-secondary)]">{error}</p>
          <button onClick={fetchRates} className="px-4 py-2 rounded-xl bg-[var(--color-gold-600)] text-white text-sm hover:brightness-110 transition-all shadow-sm">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-bg)]">
            <TrendingUp className="h-8 w-8 text-[var(--color-gold-600)]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">Today&apos;s Gold &amp; Silver Rate</h1>
          <p className="mt-1 text-[var(--color-text-secondary)]">Auto-updated daily at 11:30 AM NPT</p>
        </div>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="bg-[var(--color-gold-100)] p-2.5 rounded-xl">
                <Gem className="h-6 w-6 text-[var(--color-gold-700)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">Gold (24K)</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">Fine Gold Rate</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-[var(--color-primary-bg)] p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-gold-700)]">Per Tola</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-gold-800)] num card-value">
                  {gold?.rate?.toLocaleString() || '-'}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-gold-600)]">NPR</p>
              </div>
              <div className="rounded-xl bg-[var(--color-primary-bg)] p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-gold-700)]">Per Gram</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-gold-800)] num card-value">
                  {goldPerGram?.toLocaleString() || '-'}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-gold-600)]">NPR</p>
              </div>
            </div>
            {gold?.date && (
              <p className="mt-3 flex items-center justify-center gap-1 text-xs text-[var(--color-text-secondary)]">
                <Clock className="h-3 w-3" />
                Updated {new Date(gold.date).toLocaleDateString('en-NP', { year: 'numeric', month: 'long', day: 'numeric' })}
                {charges.gold > 0 && <span className="font-medium text-[var(--color-gold-700)]">Â· incl. transport Rs {charges.gold}/tola</span>}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-ink-100">
                <Gem className="h-6 w-6 text-ink-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">Silver</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">Silver Rate</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-ink-50 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Per Tola</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-ink-700 num card-value">
                  {silver?.rate?.toLocaleString() || '-'}
                </p>
                <p className="mt-0.5 text-xs text-ink-400">NPR</p>
              </div>
              <div className="rounded-xl bg-ink-50 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Per Gram</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-ink-700 num card-value">
                  {silverPerGram?.toLocaleString() || '-'}
                </p>
                <p className="mt-0.5 text-xs text-ink-400">NPR</p>
              </div>
            </div>
            {silver?.date && (
              <p className="mt-3 flex items-center justify-center gap-1 text-xs text-[var(--color-text-secondary)]">
                <Clock className="h-3 w-3" />
                Updated {new Date(silver.date).toLocaleDateString('en-NP', { year: 'numeric', month: 'long', day: 'numeric' })}
                {charges.silver > 0 && <span className="font-medium text-ink-500">Â· incl. transport Rs {charges.silver}/tola</span>}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={fetchRates}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Auto-updated daily at 11:30 AM
          </p>
        </div>
      </div>
    </div>
  )
}