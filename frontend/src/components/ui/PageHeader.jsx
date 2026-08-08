const PageHeader = ({ title, subtitle, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {subtitle}
        </p>
      )}
    </div>
    {children && (
      <div className="flex items-center gap-2 shrink-0 flex-wrap">{children}</div>
    )}
  </div>
);
export default PageHeader;