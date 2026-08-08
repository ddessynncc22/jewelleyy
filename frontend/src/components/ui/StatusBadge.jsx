const statusColorMap = {
  "In Stock": "bg-success/10 text-success border-success/20",
  Sold: "bg-info/10 text-info border-info/20",
  "With Karigar": "bg-warning/10 text-warning border-warning/20",
  "Pawn Collateral": "bg-violet-100 text-violet-700 border-violet-200",
  "On Approval": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Branch Transfer": "bg-orange-100 text-orange-700 border-orange-200",
  Damaged: "bg-danger/10 text-danger border-danger/20",
  Melted: "bg-ink-100 text-ink-600 border-ink-200",
  Active: "bg-success/10 text-success border-success/20",
  Redeemed: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Forfeited: "bg-danger/10 text-danger border-danger/20",
  Renewed: "bg-teal-100 text-teal-700 border-teal-200",
  Overdue: "bg-danger/10 text-danger border-danger/20",
  "Stock In": "bg-success/10 text-success border-success/20",
  "Stock Out": "bg-danger/10 text-danger border-danger/20",
};

const defaultStyle = "bg-ink-100 text-ink-600 border-ink-200";

const sizes = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1 text-sm",
};

const StatusBadge = ({ status, size = "md" }) => {
  const color = statusColorMap[status] || defaultStyle;
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${color} ${sizes[size]}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;