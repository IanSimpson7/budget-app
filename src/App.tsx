import { Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import SettingsPage from './pages/SettingsPage'
import BackupPage from './pages/BackupPage'
import EntryPage from './pages/EntryPage'
import DashboardPage from './pages/DashboardPage'
import ExpensesPage from './pages/ExpensesPage'
import FundsPage from './pages/FundsPage'

// HashRouter per D-15 — GitHub Pages has no server-side SPA redirect at
// subpaths, so #-routing is the correct default for the deploy target.
// Suspense fallback covers the Jotai async-atom load in SettingsPage and DashboardPage.
// Index + wildcard both redirect to /dashboard (plan 02-04 — dashboard is now the home).

export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Suspense
          fallback={<div className="font-sans text-sm text-text-secondary">Loading...</div>}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/entry" element={<EntryPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/funds" element={<FundsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </HashRouter>
  )
}
