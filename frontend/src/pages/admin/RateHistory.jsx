import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Gem, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { getRateHistory } from '../../services/adminService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'

const TOLA_TO_GRAM = 11.664

export default function RateHistory() {
  const [days, setDays] = useState(30)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rate-history', days],
    queryFn: () => getRateHistory(days).then(r => r.data.data || r.data),
  })

  const history = Array.isArray(data) ? data : []
  const [expanded, setExpanded] = useState(null)

  return (
    <div className="space-y-6">
      <PageHeader title="Rate History" subtitle="Daily gold and silver rates">
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <Button key={d} size="sm" variant={days === d ? 'primary' : 'outline'} onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
        </div>
      </PageHeader>

      <Card>
        {isLoading ? <LoadingSkeleton count={8} type="row" /> : error ? <ErrorState message={error.message} onRetry={refetch} /> : (
          <div className="space-y-1">
            {history.map((day, i) => {
              const goldGram = day.gold ? (day.gold.unit === 'gram' ? day.gold.rate : Math.round(day.gold.rate / TOLA_TO_GRAM)) : 0
              const silverGram = day.silver ? (day.silver.unit === 'gram' ? day.silver.rate : Math.round(day.silver.rate / TOLA_TO_GRAM)) : 0
              const isOpen = expanded === i
              return (
                <div key={day.date} className="border-b border-gray-100 last:border-0">
                  <button onClick={() => setExpanded(isOpen ? null : i)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className={`text-xs sm:text-sm font-semibold ${day.gold ? 'text-amber-600' : 'text-gray-300'}`}>
                        {day.gold ? `G: Rs. ${day.gold.rate.toLocaleString()}/${day.gold.unit}` : 'G: —'}
                      </span>
                      {day.gold && <span className="text-[10px] sm:text-xs text-amber-500/70">({goldGram.toLocaleString()}/g)</span>}
                      <span className={`text-xs sm:text-sm font-semibold ${day.silver ? 'text-gray-600' : 'text-gray-300'}`}>
                        {day.silver ? `S: Rs. ${day.silver.rate.toLocaleString()}/${day.silver.unit}` : 'S: —'}
                      </span>
                      {day.silver && <span className="text-[10px] sm:text-xs text-gray-400">({silverGram.toLocaleString()}/g)</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
                        <p className="text-xs font-medium text-amber-700 mb-1">Gold</p>
                        <p className="text-lg font-bold text-amber-800">
                          {day.gold ? `Rs. ${day.gold.rate.toLocaleString()}` : '—'}
                          {day.gold && <span className="text-xs font-normal text-amber-500 ml-1">/{day.gold.unit}</span>}
                        </p>
                        {goldGram > 0 && <p className="text-xs text-amber-600/70">Rs. {goldGram.toLocaleString()} / gram</p>}
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200/50">
                        <p className="text-xs font-medium text-gray-600 mb-1">Silver</p>
                        <p className="text-lg font-bold text-gray-700">
                          {day.silver ? `Rs. ${day.silver.rate.toLocaleString()}` : '—'}
                          {day.silver && <span className="text-xs font-normal text-gray-400 ml-1">/{day.silver.unit}</span>}
                        </p>
                        {silverGram > 0 && <p className="text-xs text-gray-500/70">Rs. {silverGram.toLocaleString()} / gram</p>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {history.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No rate data found</p>}
          </div>
        )}
      </Card>
    </div>
  )
}
