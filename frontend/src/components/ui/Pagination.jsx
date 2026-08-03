import { ChevronLeft, ChevronRight } from 'lucide-react'
const Pagination = ({ page = 1, limit = 10, total = 0, totalPages = 1, onPageChange, onLimitChange }) => {
  if (total === 0) return null
const from = (page - 1) * limit + 1
const to = Math.min(page * limit, total)

const getPages = () => {
    const pages = [];
    const max = 5;
    let start = Math.max(1, page - Math.floor(max / 2));
    let end = Math.min(totalPages, start + max - 1);
    if (end - start + 1 < max) start = Math.max(1, end - max + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages
  }
return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2">
      <p className="text-sm text-[var(--color-text-secondary)]">
        <span className="font-medium text-[var(--color-text)]">{from}</span>&ndash;<span className="font-medium text-[var(--color-text)]">{to}</span> of{' '}
        <span className="font-medium text-[var(--color-text)]">{total}</span>
      </p>
      <div className="flex items-center gap-3">
        {onLimitChange && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-secondary)]">Show</label>
            <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1.5 px-2.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all">
              {[10, 20, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <nav className="flex items-center gap-1">
          <button type="button" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1}
            className="inline-flex items-center justify-center rounded-xl p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:pointer-events-none transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {getPages().map((p) => (
            <button key={p} type="button" onClick={() => onPageChange?.(p)} aria-current={p === page ? 'page' : undefined}
              className={`inline-flex items-center justify-center min-w-[36px] rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                p === page
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]'
              }`}>
              {p}
            </button>
          ))}
          <button type="button" onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages}
            className="inline-flex items-center justify-center rounded-xl p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:pointer-events-none transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </div>
  )
}

export default Pagination

