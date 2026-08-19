import { useState, useEffect } from 'react'
import { Outlet, useLocation, Link, useNavigate, Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import Sidebar from './Sidebar'
import { Search, LogOut, Menu, KeyRound, Keyboard, Settings } from 'lucide-react'
import { getSettings } from '../services/settingsService'
import { changePassword } from '../services/authService'
import NotificationBell from '../components/notifications/NotificationBell'
import Modal from '../components/ui/Modal'
import FormInput from '../components/ui/FormInput'
import Button from '../components/ui/Button'

const breadcrumbMap = {
  '/': 'Dashboard', '/items': 'Items', '/stock': 'Stock Movement',
  '/purchases': 'Purchases', '/purchases/new': 'New Purchase', '/purchases/:id': 'Purchase Detail', '/refines': 'Refine Gold', '/gold-in-stock': 'Gold in Stock',
  '/loose-lots': 'Loose Items',
  '/karigar': 'Karigar', '/karigar/pending-jobs': 'Pending Jobs', '/karigar/summary': 'Karigar Summary', '/pawn': 'Bandaki', '/custom-orders': 'Custom Orders', '/pos': 'POS', '/pos/diamond': 'Diamond POS',
  '/customers': 'Customers', '/rates': 'Rates', '/reports': 'Reports',
  '/accounting': 'Accounting', '/accounting/vouchers': 'Vouchers', '/accounting/ledgers': 'Ledgers',
  '/accounting/day-book': 'Day Book', '/accounting/debtors': 'Sundry Debtors', '/accounting/creditors': 'Sundry Creditors',
  '/audit': 'Audit', '/settings': 'Settings', '/lookup': 'QR Lookup',
  '/admin': 'Dashboard',
  '/admin/tenants': 'Tenants',
  '/admin/requests': 'Requests',
  '/admin/broadcast': 'Broadcast',
  '/admin/rates': 'Rate History',
}

const SHORTCUTS = [
  { keys: 'Ctrl + I', label: 'New Item', description: 'Open the add-item form' },
  { keys: 'Ctrl + S', label: 'New Sale', description: 'Open the POS screen to create a sale' },
  { keys: 'Ctrl + K', label: 'New Purchase', description: 'Open the add-purchase form' },
]

function userInitial(name) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] || 'U').toUpperCase()
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [storeName, setStoreName] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  useEffect(() => {
    getSettings().then((s) => {
      if (s?.storeName) {
        document.title = s.storeName
        setStoreName(s.storeName)
      }
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      const key = e.key.toLowerCase()
      if (key === 'i') {
        e.preventDefault()
        navigate('/items/new')
      } else if (key === 's') {
        e.preventDefault()
        navigate('/pos')
      } else if (key === 'k') {
        e.preventDefault()
        navigate('/purchases/new')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  useEffect(() => {
    if (!shortcutsOpen) return
    const onEscape = (e) => {
      if (e.key === 'Escape') setShortcutsOpen(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [shortcutsOpen])

  const segments = location.pathname.split('/').filter(Boolean)
  const fullPath = '/' + segments.join('/')
  const label = breadcrumbMap[fullPath] || breadcrumbMap['/' + segments[0]] || 'Page'

  const isQrLookup = user?.role === 'qr_lookup'

  // qr_lookup accounts may only ever see the QR lookup page; the backend also
  // rejects every other API, this just keeps the UI from mounting other screens.
  if (isQrLookup && !location.pathname.startsWith('/lookup')) {
    return <Navigate to="/lookup" replace />
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setPasswordLoading(true)
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      toast.success('Password changed successfully')
      setShowChangePassword(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <Sidebar
        collapsed={collapsed}
        storeName={storeName}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/85 backdrop-blur-md px-3 sm:px-4 lg:px-6 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-[var(--color-elevated)] text-[var(--color-text-secondary)] transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-[var(--color-text-secondary)] min-w-0">
            <Link to={isQrLookup ? '/lookup' : user?.role === 'superadmin' ? '/admin' : '/'} className="hidden sm:inline hover:text-[var(--color-text)] transition-colors shrink-0">
              {isQrLookup ? 'QR Lookup' : user?.role === 'superadmin' ? 'Admin' : 'Home'}
            </Link>
            <span className="hidden sm:inline text-[var(--color-border)]">/</span>
            <span className="text-[var(--color-text)] font-medium truncate">{label}</span>
          </div>

          <div className="flex-1 min-w-0" />

          {user?.role !== 'superadmin' && user?.role !== 'qr_lookup' && (
            <div className="hidden sm:flex items-center bg-[var(--color-elevated)]/70 rounded-xl px-3 py-1.5 max-w-xs w-full border border-[var(--color-border)] focus-within:border-[var(--color-gold-500)] focus-within:ring-4 focus-within:ring-[var(--color-gold-500)]/15 focus-within:bg-[var(--color-card)] transition-all">
              <Search size={16} className="text-[var(--color-text-secondary)] mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/items?search=${encodeURIComponent(searchQuery.trim())}`)
                    setSearchQuery('')
                  }
                }}
                className="bg-transparent border-none outline-none text-sm text-[var(--color-text)] w-full placeholder-[var(--color-text-secondary)]"
              />
            </div>
          )}

          {user?.role !== 'superadmin' && user?.role !== 'qr_lookup' && <NotificationBell />}

          {user?.role !== 'superadmin' && user?.role !== 'qr_lookup' && (
            <div className="relative">
              <button
                onClick={() => setShortcutsOpen((o) => !o)}
                className="flex items-center justify-center p-2 rounded-xl hover:bg-[var(--color-elevated)] text-[var(--color-text-secondary)] transition-colors"
                title="Keyboard shortcuts"
                aria-label="Toggle keyboard shortcuts"
              >
                <Keyboard size={18} />
              </button>

              {shortcutsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShortcutsOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-[var(--color-card)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--color-border)] py-3 animate-fade-up ring-1 ring-black/[0.02]">
                    <h3 className="px-4 text-sm font-semibold tracking-tight text-[var(--color-text)]">Shortcut Keys</h3>
                    <p className="px-4 text-xs text-[var(--color-text-secondary)] mt-1 mb-1">
                      Press a key combo anywhere to jump to that screen
                    </p>
                    {SHORTCUTS.map((s) => (
                      <div
                        key={s.keys}
                        className="flex items-start justify-between gap-3 px-4 py-2.5 border-b border-[var(--color-border)] last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text)]">{s.label}</p>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">{s.description}</p>
                        </div>
                        <kbd className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
                          {s.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowUser((p) => !p)}
              className="flex items-center gap-1.5 sm:gap-2 p-1 rounded-xl hover:bg-[var(--color-elevated)]/70 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-gold text-sm font-semibold text-white shadow-[var(--shadow-gold)] ring-2 ring-[var(--color-gold-200)]/60">
                {userInitial(user?.name)}
              </div>
              <span className="hidden sm:block text-sm font-medium text-[var(--color-text)] truncate max-w-[100px]">
                {user?.name}
              </span>
            </button>

            {showUser && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUser(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-[var(--color-card)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--color-border)] py-2 animate-fade-up ring-1 ring-black/[0.02]">
                  <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
                    <p className="text-sm font-semibold text-[var(--color-text)] truncate">{user?.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{user?.email}</p>
                  </div>
                  <div className="pt-1">
                    {user?.role !== 'superadmin' && user?.role !== 'qr_lookup' && (
                      <button
                        onClick={() => { setShowUser(false); navigate('/settings') }}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors w-full text-left"
                      >
                        <Settings size={14} /> Settings
                      </button>
                    )}
                    <button
                      onClick={() => { setShowUser(false); setShowChangePassword(true) }}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors w-full text-left"
                    >
                      <KeyRound size={14} /> Change Password
                    </button>
                    <button
                      onClick={() => { setShowUser(false); logout() }}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-danger hover:bg-danger/5 transition-colors w-full text-left"
                    >
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-3 sm:p-5 lg:p-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <Modal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        title="Change Password"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowChangePassword(false)} disabled={passwordLoading}>
              Cancel
            </Button>
            <Button type="submit" form="change-password-form" loading={passwordLoading} icon={<KeyRound size={14} />}>
              Update Password
            </Button>
          </>
        }
      >
        <form id="change-password-form" onSubmit={handleChangePassword} className="space-y-4">
          <FormInput
            label="Current Password"
            name="currentPassword"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
            required
            placeholder="Enter current password"
          />
          <FormInput
            label="New Password"
            name="newPassword"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            required
            placeholder="Min 6 characters"
          />
          <FormInput
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            required
            placeholder="Re-enter new password"
          />
        </form>
      </Modal>
    </div>
  )
}