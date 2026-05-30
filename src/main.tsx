import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { seedExpensesIfEmpty, seedFundsIfEmpty, seedMealDefinitionsIfEmpty } from './storage/storage'

// Fire-and-forget idempotent seeds on app init (Phase 3 + Phase 4).
// Seeds run before/around render; they are no-ops after the first run
// (sentinel-guarded). liveQuery will re-emit once the IDB write completes,
// updating atoms automatically.
void seedExpensesIfEmpty()
void seedFundsIfEmpty()
void seedMealDefinitionsIfEmpty()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
