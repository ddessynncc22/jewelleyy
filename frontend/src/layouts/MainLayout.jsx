import { useState, useEffect } from 'react'
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import Sidebar from './Sidebar'
import { Search, LogOut, User, Menu, KeyRound } from 'lucide-react'
import { getSettings } from '../services/settingsService'
import { changePassword } from '../services/authService'
import NotificationBell from '../components/notifications/NotificationBell'
import Modal from '../components/ui/Modal'
import FormInput from '../components/ui/FormInput'
import Button from '../components/ui/Button'

const breadcrumbMap = {
  '/': 'Dashboard', '/items': 'Items', '/stock': 'Stock Movement',
  '/loose-lots': 'Loose Items',
  '/karigar': 'Karigar', '/karigar/pending-jobs': 'Pending Jobs', '/pawn': 'Bandaki', '/custom-orders': 'Custom Orders', '/pos': 'POS', '/pos/diamond': 'Diamond POS',
  '/customers': 'Customers', '/rates': 'Rates', '/reports': 'Reports',
  '/audit': 'Audit', '/settings': 'Settings',
  '/admin': 'Dashboard',
  '/admin/tenants': 'Tenants',
  '/admin/requests': 'Requests',
  '/admin/broadcast': 'Broadcast',
  '/admin/rates': 'Rate History',
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

  const segments = location.pathname.split('/').filter(Boolean)
  const fullPath = '/' + segments.join('/')
  const label = breadcrumbMap[fullPath] || breadcrumbMap['/' + segments[0]] || 'Page'

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
        <header className="h-14 sm:h-16 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-[var(--color-elevated)] text-[var(--color-text-secondary)] transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-[var(--color-text-secondary)] min-w-0">
            <Link to={user?.role === 'superadmin' ? '/admin' : '/'} className="hidden sm:inline hover:text-[var(--color-text)] transition-colors shrink-0">
              {user?.role === 'superadmin' ? 'Admin' : 'Home'}
            </Link>
            <span className="hidden sm:inline text-[var(--color-border)]">/</span>
            <span className="text-[var(--color-text)] font-medium truncate">{label}</span>
          </div>

          <div className="flex-1 min-w-0" />

          {user?.role !== 'superadmin' && (
            <div className="hidden sm:flex items-center bg-[var(--color-elevated)] rounded-xl px-3 py-1.5 max-w-xs w-full border border-[var(--color-border)]/50">
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

          {user?.role !== 'superadmin' && <NotificationBell />}

          <div className="relative">
            <button
              onClick={() => setShowUser((p) => !p)}
              className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-xl hover:bg-[var(--color-elevated)] transition-colors"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center">
                <User size={14} className="sm:size-4 text-[var(--color-primary)]" />
              </div>
              <span className="hidden sm:block text-sm font-medium text-[var(--color-text)] truncate max-w-[100px]">
                {user?.name}
              </span>
            </button>

            {showUser && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUser(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-[var(--color-card)] rounded-2xl shadow-xl border border-[var(--color-border)] py-2 animate-fade-in">
                  <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{user?.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{user?.email}</p>
                  </div>
                  <div className="pt-1">
                    {user?.role !== 'superadmin' && (
                      <button
                        onClick={() => { setShowUser(false); navigate('/settings') }}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors w-full text-left"
                      >
                        Settings
                      </button>
                    )}
                    <button
                      onClick={() => { setShowUser(false); setShowChangePassword(true) }}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors w-full text-left"
                    >
                      Change Password
                    </button>
                    <button
                      onClick={() => { setShowUser(false); logout() }}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
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
          <div className="max-w-7xl mx-auto p-3 sm:p-5 lg:p-8 animate-fade-in">
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
