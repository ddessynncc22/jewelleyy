import { Gem, Star, Crown } from 'lucide-react'

export const PLAN_META = {
  standard: { label: 'Standard', icon: Gem, badge: 'bg-gray-100 text-gray-700' },
  premium: { label: 'Premium', icon: Star, badge: 'bg-amber-50 text-amber-700' },
  enterprise: { label: 'Enterprise', icon: Crown, badge: 'bg-violet-50 text-violet-700' },
}

export const PLAN_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
]

const sizes = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
}

const PlanBadge = ({ plan, size = 'sm', iconSize }) => {
  const meta = PLAN_META[plan] || PLAN_META.standard
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${meta.badge} ${sizes[size]}`}>
      <Icon size={iconSize || (size === 'md' ? 14 : 12)} />
      {meta.label}
    </span>
  )
}
export default PlanBadge
