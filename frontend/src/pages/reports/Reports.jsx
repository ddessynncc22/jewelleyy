import { Link } from 'react-router-dom'

import { BarChart3, ArrowLeftRight, DollarSign, Banknote, Wrench, Users, TrendingUp, ReceiptText, BookOpen, BookOpenText, CalendarDays, HandCoins, ChevronRight } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'

const reportTypes = [
  { to: '/reports/current-stock', title: 'Current Stock', description: 'Full inventory listing with quantities and values', icon: BarChart3 },
  { to: '/reports/stock-movement', title: 'Stock Movement', description: 'Stock in and out movements by date range', icon: ArrowLeftRight },
  { to: '/reports/valuation', title: 'Inventory Valuation', description: 'Total valuation by metal type using latest market rates', icon: DollarSign },
  { to: '/reports/pawn', title: 'Bandaki Report', description: 'Bandaki summary with active, redeemed, and forfeited loans', icon: Banknote },
  { to: '/reports/karigar', title: 'Karigar Report', description: 'Karigar performance summary with issued and returned materials', icon: Wrench },
  { to: '/reports/customer-ledger', title: 'Customer Ledger', description: 'Customer balances, credits, and payment history', icon: Users },
  { to: '/reports/profit-summary', title: 'Profit Summary', description: 'Basic profit calculation from sales data', icon: TrendingUp },
  { to: '/reports/tax', title: 'Tax Report', description: 'Service fee and diamond VAT collected on sales', icon: ReceiptText },
]

const accountingTypes = [
  { to: '/accounting', title: 'Accounting Overview', description: 'Chart of accounts and voucher entry hub', icon: BookOpen },
  { to: '/accounting/vouchers', title: 'Vouchers', description: 'All vouchers, filter by type, date range, and party', icon: ReceiptText },
  { to: '/accounting/ledgers', title: 'Ledger Report', description: 'T-account view with opening, entries, and closing balance', icon: BookOpenText },
  { to: '/accounting/day-book', title: 'Day Book', description: 'Every voucher entry for a date, chronological, both sides', icon: CalendarDays },
  { to: '/accounting/debtors', title: 'Sundry Debtors', description: 'Debtor ledgers with outstanding balances', icon: Users },
  { to: '/accounting/creditors', title: 'Sundry Creditors', description: 'Creditor ledgers with outstanding balances', icon: HandCoins },
]

function QuickLink({ to, title, description, icon: Icon }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm transition-colors hover:border-[var(--color-gold-400)] hover:bg-[var(--color-primary-bg)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-bg)] text-[var(--color-gold-700)]">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--color-text)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-[var(--color-text-secondary)]">{description}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-[var(--color-ink-300)]" />
    </Link>
  )
}

function LinkSection({ title, subtitle, items }) {
  return (
    <div>
      {title && (
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <QuickLink key={item.to} {...item} />
        ))}
      </div>
    </div>
  )
}

export default function Reports() {
  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Reports" subtitle="Generate and export inventory reports" />
      <LinkSection items={reportTypes} />
      <LinkSection
        title="Accounting"
        subtitle="Double-entry vouchers, ledgers, and day books"
        items={accountingTypes}
      />
    </div>
  )
}