const bone = "bg-[var(--color-ink-100)] animate-pulse"
const tableRow = (
  <div className="flex gap-4 px-4 py-3.5">
    <div className={`${bone} h-4 w-4 rounded`} />
    <div className="flex flex-1 gap-4">
      <div className={`${bone} h-4 flex-1 rounded`} />
      <div className={`${bone} h-4 flex-1 rounded`} />
      <div className={`${bone} h-4 flex-1 rounded`} />
      <div className={`${bone} h-4 w-20 rounded`} />
    </div>
  </div>
);
const cardItem = (
  <div className="space-y-3 rounded-2xl border border-[var(--color-border)] p-5">
    <div className="flex items-center gap-3">
      <div className={`${bone} h-10 w-10 rounded-xl`} />
      <div className="flex-1 space-y-2">
        <div className={`${bone} h-4 w-3/4 rounded`} />
        <div className={`${bone} h-3 w-1/2 rounded`} />
      </div>
    </div>
    <div className={`${bone} h-3 w-full rounded`} />
    <div className={`${bone} h-3 w-2/3 rounded`} />
  </div>
);
const listItem = (
  <div className="flex items-center gap-3 px-4 py-3.5">
    <div className={`${bone} h-10 w-10 rounded-xl shrink-0`} />
    <div className="flex-1 space-y-2">
      <div className={`${bone} h-4 w-1/2 rounded`} />
      <div className={`${bone} h-3 w-1/3 rounded`} />
    </div>
  </div>
);
const layouts = {
  table: {
    rows: Array.from({ length: 5 }, (_, i) => <div key={i}>{tableRow}</div>),
    wrapper:
      "divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]",
  },
  card: {
    rows: Array.from({ length: 6 }, (_, i) => <div key={i}>{cardItem}</div>),
    wrapper: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
  },
  list: {
    rows: Array.from({ length: 5 }, (_, i) => <div key={i}>{listItem}</div>),
    wrapper:
      "divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)]",
  },
};
const LoadingSkeleton = ({ count = 5, type = "table" }) => {
  const layout = layouts[type] || layouts.table;
  const items =
    count > 0
      ? Array.from({ length: count }, (_, i) => (
          <div key={i}>{layout.rows[i % layout.rows.length]}</div>
        ))
      : layout.rows;
  return (
    <div className={layout.wrapper} role="status" aria-label="Loading content">
      {items} <span className="sr-only">Loading...</span>
    </div>
  );
};
export default LoadingSkeleton;