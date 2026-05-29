import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { seedExpensesIfEmpty, seedFundsIfEmpty } from './storage/storage'

// Fire-and-forget idempotent seeds on app init (Phase 3).
// Seeds run before/around render; they are no-ops after the first run
// (sentinel-guarded). liveQuery will re-emit once the IDB write completes,
// updating expenseItemsAtom and sinkingFundsAtom automatically.
void seedExpensesIfEmpty()
void seedFundsIfEmpty()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
