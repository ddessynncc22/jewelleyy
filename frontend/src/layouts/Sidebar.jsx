import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import {
  LayoutDashboard,
  Gem,
  ArrowLeftRight,
  Wrench,
  Banknote,
  ShoppingCart,
  Users,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  ChevronDown,
  Building2,
  Globe,
  Megaphone,
  History,
  ClipboardList,
  Layers,
  QrCode,
} from 'lucide-react'
import { getCachedSettings } from '../services/settingsService'
import { useAuth } from '../hooks/useAuth'

const tenantSections = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/items', label: 'Items', icon: Gem },
      { to: '/stock', label: 'Stock Movement', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Loose Items',
    items: [
      { to: '/loose-lots', label: 'Lots', icon: Layers, end: true },
      { to: '/loose-lots/reports/stock', label: 'Stock & Value', icon: BarChart3 },
      { to: '/loose-lots/reports/day-end', label: 'Day-End Report', icon: History },
    ],
  },
  {
    label: 'Workshop',
    items: [
      {
        to: '',
        label: 'Karigar',
        icon: Wrench,
        children: [
          { to: '/karigar', label: 'Karigars', end: true },
          { to: '/karigar/pending-jobs', label: 'Pending Jobs' },
        ],
      },
      { to: '/custom-orders', label: 'Custom Orders', icon: ClipboardList },
    ],
  },
  {
    label: 'Sales',
    items: [
      {
        to: '',
        label: 'POS',
        icon: ShoppingCart,
        children: [
          { to: '/pos', label: 'New Sale', end: true },
          { to: '/pos/sales', label: 'Sales History' },
        ],
      },
      { to: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        to: '',
        label: 'Loan',
        icon: Banknote,
        children: [{ to: '/pawn', label: 'Bandaki', end: true }],
      },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/rates', label: 'Rates', icon: TrendingUp },
      { to: '/audit', label: 'Audit', icon: ShieldCheck },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'QR Lookup',
    items: [
      { to: '/lookup', label: 'QR Scanner', icon: QrCode },
      { to: '/qr-accounts', label: 'QR Accounts', icon: Users, roles: ['admin'] },
    ],
  },
]

const adminSections = [
  {
    label: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/tenants', label: 'Tenants', icon: Building2 },
      { to: '/admin/requests', label: 'Requests', icon: ClipboardList },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
      { to: '/admin/rates', label: 'Rate History', icon: History },
      { to: '/audit', label: 'Activity Log', icon: ShieldCheck },
    ],
  },
]

const qrLookupSections = [
  {
    label: 'QR Lookup',
    items: [{ to: '/lookup', label: 'QR Lookup', icon: QrCode, end: true }],
  },
]

export default function Sidebar({ collapsed, storeName, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation()
  const { user } = useAuth()
  const [expandedMenus, setExpandedMenus] = useState({})

  const isSuperAdmin = user?.role === 'superadmin'
  const isQrLookup = user?.role === 'qr_lookup'
  const sections = isSuperAdmin ? adminSections : isQrLookup ? qrLookupSections : tenantSections
  const appName = isSuperAdmin ? 'Admin Panel' : storeName || getCachedSettings()?.storeName || 'Jewellery MS'

  const toggleMenu = (label) => setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  const handleGroupClick = (label) => {
    if (collapsed) onToggle()
    else toggleMenu(label)
  }

  const linkClass = ({ isActive }) =>
    [
      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
      isActive
        ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]',
      collapsed ? 'justify-center px-0' : '',
    ].join(' ')

  const renderNavItem = (item) => {
    if (item.children) {
      const isAnyChildActive = item.children.some(
        (child) => child.to === location.pathname || (child.to !== '/' && location.pathname.startsWith(child.to)),
      )
      const isOpen = expandedMenus[item.label] ?? isAnyChildActive

      return (
        <div key={item.label}>
          <button
            onClick={() => handleGroupClick(item.label)}
            title={collapsed ? item.label : undefined}
            className={[
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
              isAnyChildActive
                ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]',
              collapsed ? 'justify-center px-0' : '',
            ].join(' ')}
          >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
            {!collapsed && (
              <ChevronDown
                size={15}
                className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
              />
            )}
          </button>

          {!collapsed && isOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--color-border)] pl-2.5">
              {item.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.end}
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    [
                      'block rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                      isActive
                        ? 'bg-[var(--color-primary-light)] font-medium text-[var(--color-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]',
                    ].join(' ')
                  }
                >
                  <span className="truncate">{child.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end || item.to === '/'}
        onClick={onMobileClose}
        title={collapsed ? item.label : undefined}
        className={linkClass}
      >
        <item.icon size={20} className="shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    )
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] transition-[width,transform] duration-300 ease-in-out lg:static ${
          collapsed ? 'w-[72px]' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[var(--color-border)] px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
            {isSuperAdmin ? <Globe size={16} /> : <Sparkles size={16} />}
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight text-[var(--color-text)]">
              {appName}
            </span>
          )}
          <button
            onClick={onMobileClose}
            className="ml-auto rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)] lg:hidden"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
          {sections.map((section) => (
            <div key={section.label} className="mt-4 first:mt-2">
              {!collapsed && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items
                  .filter((item) => !item.roles || item.roles.includes(user?.role))
                  .map(renderNavItem)}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-[var(--color-border)] p-2.5">
          <button
            onClick={onToggle}
            title={collapsed ? 'Expand' : 'Collapse'}
            className={`hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)] lg:flex ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
