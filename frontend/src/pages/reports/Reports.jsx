import { useNavigate } from 'react-router-dom'

import { BarChart3, ArrowLeftRight, DollarSign, Banknote, Wrench, Users, TrendingUp } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'

import Card from '../../components/ui/Card'
const reportTypes = [
  { type: 'current-stock', title: 'Current Stock', description: 'View full inventory listing with quantities and values', icon: BarChart3, color: 'blue' },
  { type: 'stock-movement', title: 'Stock Movement', description: 'Track all stock in and out movements by date range', icon: ArrowLeftRight, color: 'green' },
  { type: 'valuation', title: 'Inventory Valuation', description: 'Total valuation by metal type using latest market rates', icon: DollarSign, color: 'green' },
  { type: 'pawn', title: 'Bandaki Report', description: 'Bandaki summary with active, redeemed, and forfeited loans', icon: Banknote, color: 'red' },
  { type: 'karigar', title: 'Karigar Report', description: 'Karigar performance summary with issued and returned materials', icon: Wrench, color: 'cyan' },
  { type: 'customer-ledger', title: 'Customer Ledger', description: 'Customer balances, credits, and payment history', icon: Users, color: 'blue' },
  { type: 'profit-summary', title: 'Profit Summary', description: 'Basic profit calculation from sales data', icon: TrendingUp, color: 'indigo' },
]

const colorMap = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-green-50 text-green-600 border-green-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
}

export default function Reports() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Generate and export inventory reports" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map(({ type, title, description, icon: Icon, color }) => (
          <button
            key={type}
            onClick={() => navigate(`/reports/${type}`)}
            className={`p-5 rounded-xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${colorMap[color]}`}
          >
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-white/50">
                <Icon size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">{title}</h3>
                <p className="text-xs mt-1 opacity-75">{description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

