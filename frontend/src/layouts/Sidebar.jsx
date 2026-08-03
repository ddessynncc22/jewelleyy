import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { LayoutDashboard, Gem, ArrowLeftRight, Wrench, Banknote, ShoppingCart, Users, TrendingUp, BarChart3, ShieldCheck, Settings, ChevronLeft, ChevronRight, X, Sparkles, Receipt, ChevronDown, Building2, Globe, Megaphone, History, ClipboardList,
} from 'lucide-react'
import { getCachedSettings } from '../services/settingsService'
import { useAuth } from '../hooks/useAuth'

const tenantNavItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/items', label: 'Items', icon: Gem },
  { to: '/stock', label: 'Stock Movement', icon: ArrowLeftRight },
  { to: '', label: 'Karigar', icon: Wrench, children: [
    { to: '/karigar', label: 'Karigars', end: true },
    { to: '/karigar/pending-jobs', label: 'Pending Jobs', icon: History },
  ] },
  { to: '/pawn', label: 'Bandaki', icon: Banknote },
  { to: '/custom-orders', label: 'Custom Orders', icon: ClipboardList },
  { to: '', label: 'POS', icon: ShoppingCart, children: [
    { to: '/pos', label: 'New Sale', end: true },
    { to: '/pos/sales', label: 'Sales History', icon: Receipt },
  ] },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/rates', label: 'Rates', icon: TrendingUp },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/audit', label: 'Audit', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const adminNavItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { to: '/admin/requests', label: 'Requests', icon: ClipboardList },


  { to: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
  { to: '/admin/rates', label: 'Rate History', icon: History },
  { to: '/audit', label: 'Activity Log', icon: ShieldCheck },
]

export default function Sidebar({ collapsed, storeName, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation()
  const { user } = useAuth()
  const [expandedMenus, setExpandedMenus] = useState({})
  const toggleMenu = (label) => setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }))

  const isSuperAdmin = user?.role === 'superadmin'
  const navItems = isSuperAdmin ? adminNavItems : tenantNavItems

  return ( <> {mobileOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={onMobileClose} />} <aside className={` fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[var(--color-card)] border-r border-[var(--color-border)] transition-all duration-300 ease-in-out ${collapsed ? 'w-[68px]' : 'w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} `}> <div className="flex items-center h-16 px-4 border-b border-[var(--color-border)]"> <div className="flex items-center gap-2.5 min-w-0"> <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white"> {isSuperAdmin ? <Globe size={16} /> : <Sparkles size={16} />} </div>             {!collapsed && (
              <span className="text-base font-bold tracking-tight text-[var(--color-text)] whitespace-nowrap">
                {isSuperAdmin ? 'Admin Panel' : (storeName || getCachedSettings()?.storeName || 'Jewellery MS')}
              </span>
            )} </div> <button onClick={onToggle} className="hidden lg:flex ml-auto p-1.5 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] transition-colors"> {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />} </button> <button onClick={onMobileClose} className="lg:hidden ml-auto p-1.5 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] transition-colors"> <X size={16} /> </button> </div> <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5"> {navItems.map((item) => {
    if (item.children) {
      const isAnyChildActive = item.children.some((child) => child.to === location.pathname || (location.pathname.startsWith(child.to) && child.to !== '/'))
      const isOpen = expandedMenus[item.label] ?? isAnyChildActive
      return (
        <div key={item.label}>
          <button onClick={() => { if (!collapsed) toggleMenu(item.label); else onMobileClose?.() }} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 ${ isAnyChildActive ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]' } ${collapsed ? 'justify-center px-0' : ''}` } >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
            {!collapsed && <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />}
          </button>
          {!collapsed && isOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[var(--color-border)] pl-2">
              {item.children.map((child) => (
                <NavLink key={child.to} to={child.to} end={child.end} onClick={onMobileClose} className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${ isActive ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]' }` } >
                  {child.icon && <child.icon size={16} className="shrink-0" />}
                  <span>{child.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      )
    }
    return (
      <NavLink key={item.to} to={item.to} end={item.end || item.to === '/'} onClick={onMobileClose} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${ isActive ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]' } ${collapsed ? 'justify-center px-0' : ''}` } >
        <item.icon size={20} className="shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    )
  })} </nav> </aside> </> )
}
