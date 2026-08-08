import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, ReceiptText, CalendarDays, Users, HandCoins, BarChart3, BookOpenText } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'

const sections = [
  { to: '/accounting/vouchers/new', title: 'New Voucher', description: 'Payment, receipt, contra, journal, or metal-to-cash entry', icon: Plus, color: 'blue' },
  { to: '/accounting/vouchers', title: 'Vouchers', description: 'List all vouchers, filter by type, date range, and party', icon: ReceiptText, color: 'green' },
  { to: '/accounting/ledgers', title: 'Ledgers', description: 'Chart of accounts — cash, bank, stock, income, expense, parties', icon: BookOpen, color: 'cyan' },
  { to: '/accounting/day-book', title: 'Day Book', description: 'Every voucher entry for a date, chronological, both sides', icon: CalendarDays, color: 'orange' },
  { to: '/accounting/ledgers', title: 'Ledger Report', description: 'T-account view: opening, entries, running and closing balance', icon: BookOpenText, color: 'indigo' },
  { to: '/accounting/debtors', title: 'Sundry Debtors', description: 'Debtor ledgers with outstanding balances', icon: Users, color: 'amber' },
  { to: '/accounting/creditors', title: 'Sundry Creditors', description: 'Creditor ledgers with outstanding balances', icon: HandCoins, color: 'purple' },
  { to: '/accounting/vouchers', title: 'Voucher Report', description: 'All vouchers with totals, filterable by type and party', icon: BarChart3, color: 'red' },
]

const colorMap = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-green-50 text-green-600 border-green-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  amber: 'bg-amber-50 text-amber-600 border-amber-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
}

export default function AccountingHome() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <PageHeader title="Accounting" subtitle="Tally-style double-entry vouchers, ledgers, and day books" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(({ to, title, description, icon: Icon, color }) => (
          <button
            key={title}
            onClick={() => navigate(to)}
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