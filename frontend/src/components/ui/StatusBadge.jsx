const statusColorMap = {
  "In Stock": "bg-emerald-50 text-emerald-700 border-emerald-200",
  Sold: "bg-blue-50 text-blue-700 border-blue-200",
  "With Karigar": "bg-amber-50 text-amber-700 border-amber-200",
  "Pawn Collateral": "bg-purple-50 text-purple-700 border-purple-200",
  "On Approval": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Branch Transfer": "bg-orange-50 text-orange-700 border-orange-200",
  Damaged: "bg-red-50 text-red-700 border-red-200",
  Melted: "bg-gray-100 text-gray-700 border-gray-200",
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Redeemed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Forfeited: "bg-red-50 text-red-700 border-red-200",
  Renewed: "bg-teal-50 text-teal-700 border-teal-200",
  Overdue: "bg-red-50 text-red-700 border-red-200",
  "Stock In": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Stock Out": "bg-red-50 text-red-700 border-red-200",
};

const defaultStyle = "bg-gray-100 text-gray-700 border-gray-200";

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
