const Tabs = ({ tabs = [], activeTab, onChange }) => (
  <div className="border-b border-[var(--color-border)]" role="tablist">
    {" "}
    <nav className="flex -mb-px space-x-1" aria-label="Tabs">
      {" "}
      {tabs.map((tab) => {
        const active = tab.value === activeTab;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(tab.value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${active ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]"}`}
          >
            {" "}
            {tab.label}{" "}
          </button>
        );
      })}{" "}
    </nav>{" "}
  </div>
);
export default Tabs;
