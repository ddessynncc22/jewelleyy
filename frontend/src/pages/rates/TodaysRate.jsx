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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100">
        <div className="text-center space-y-4">
          <p className="text-gray-500">{error}</p>
          <button onClick={fetchRates} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
            <TrendingUp className="w-8 h-8 text-amber-700" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Today's Gold & Silver Rate</h1>
          <p className="text-gray-500 mt-1">Daily scraped from hamropatro.com at 11:30 AM NPT</p>
        </div>

        <div className="grid gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-200/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-100">
                <Gem className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Gold (24K)</h2>
                <p className="text-xs text-gray-400">Fine Gold Rate</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Per Tola</p>
                <p className="text-2xl font-bold text-amber-800 mt-1">
                  {gold?.rate?.toLocaleString() || '-'}
                </p>
                <p className="text-xs text-amber-500 mt-0.5">NPR</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Per Gram</p>
                <p className="text-2xl font-bold text-amber-800 mt-1">
                  {goldPerGram?.toLocaleString() || '-'}
                </p>
                <p className="text-xs text-amber-500 mt-0.5">NPR</p>
              </div>
            </div>
            {gold?.date && (
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1 justify-center">
                <Clock className="w-3 h-3" />
                Updated {new Date(gold.date).toLocaleDateString('en-NP', { year: 'numeric', month: 'long', day: 'numeric' })}
                {charges.gold > 0 && <span className="text-amber-500 font-medium">· incl. transport Rs {charges.gold}/tola</span>}
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-gray-100">
                <Gem className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Silver</h2>
                <p className="text-xs text-gray-400">Silver Rate</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Per Tola</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {silver?.rate?.toLocaleString() || '-'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">NPR</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Per Gram</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {silverPerGram?.toLocaleString() || '-'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">NPR</p>
              </div>
            </div>
            {silver?.date && (
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1 justify-center">
                <Clock className="w-3 h-3" />
                Updated {new Date(silver.date).toLocaleDateString('en-NP', { year: 'numeric', month: 'long', day: 'numeric' })}
                {charges.silver > 0 && <span className="text-gray-500 font-medium">· incl. transport Rs {charges.silver}/tola</span>}
              </p>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={fetchRates}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Source: <a href="https://www.hamropatro.com/gold" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-600">hamropatro.com/gold</a>
            {' '}· Auto-updated daily at 11:30 AM
          </p>
        </div>
      </div>
    </div>
  )
}
