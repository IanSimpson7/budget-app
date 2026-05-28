import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { Suspense } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BackupPage from '../pages/BackupPage'
import { CURRENT_SCHEMA_VERSION } from '../storage/schema'

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

function renderBackupPage() {
  return render(
    <MemoryRouter>
      <Suspense fallback={<div>loading</div>}>
        <BackupPage />
      </Suspense>
    </MemoryRouter>,
  )
}

function makeFile(content: string, name = 'backup.json'): File {
  return new File([content], name, { type: 'application/json' })
}

describe('BackupPage (UI-05)', () => {
  it('renders Export and Import controls', async () => {
    renderBackupPage()
    expect(await screen.findByRole('button', { name: /export backup/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import backup/i })).toBeInTheDocument()
  })

  it('clicking Export shows the success toast', async () => {
    const user = userEvent.setup()
    renderBackupPage()
    const exportBtn = await screen.findByRole('button', { name: /export backup/i })
    await user.click(exportBtn)
    expect(await screen.findByText('Backup exported.')).toBeInTheDocument()
  })

  it('selecting a valid file shows the replace warning + Replace and import + Cancel import', async () => {
    const user = userEvent.setup()
    const { container } = renderBackupPage()

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const validEnvelope = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: '0.0.0-test',
      data: {
        incomeChecks: [],
        expenseItems: [],
        sinkingFunds: [],
        accounts: [],
        settings: { floors: { passive: 2750, defended: 3100, foodSeed: 575 } },
      },
    }
    await user.upload(fileInput, makeFile(JSON.stringify(validEnvelope)))

    expect(await screen.findByText('This will replace all current data')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /replace and import/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel import/i })).toBeInTheDocument()
  })

  it('confirming the replace flow shows the success toast', async () => {
    const user = userEvent.setup()
    const { container } = renderBackupPage()

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const validEnvelope = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: '0.0.0-test',
      data: {
        incomeChecks: [],
        expenseItems: [],
        sinkingFunds: [],
        accounts: [],
        settings: { floors: { passive: 2500, defended: 3050, foodSeed: 575 } },
      },
    }
    await user.upload(fileInput, makeFile(JSON.stringify(validEnvelope)))

    const confirm = await screen.findByRole('button', { name: /replace and import/i })
    await user.click(confirm)

    expect(await screen.findByText('Backup imported. Data restored.')).toBeInTheDocument()
  })

  it('importing a schemaVersion > current shows the version-too-new error toast', async () => {
    const user = userEvent.setup()
    const { container } = renderBackupPage()

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const tooNew = {
      schemaVersion: 999,
      exportedAt: new Date().toISOString(),
      appVersion: '0.0.0-test',
      data: {
        incomeChecks: [],
        expenseItems: [],
        sinkingFunds: [],
        accounts: [],
        settings: {},
      },
    }
    await user.upload(fileInput, makeFile(JSON.stringify(tooNew)))

    const confirm = await screen.findByRole('button', { name: /replace and import/i })
    await user.click(confirm)

    await waitFor(() =>
      expect(
        screen.getByText(
          'This backup was created by a newer version of the app. Update the app to import it.',
        ),
      ).toBeInTheDocument(),
    )
  })

  it('importing invalid JSON shows the parse-error toast', async () => {
    const user = userEvent.setup()
    const { container } = renderBackupPage()

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('this is not json {{{'))

    const confirm = await screen.findByRole('button', { name: /replace and import/i })
    await user.click(confirm)

    await waitFor(() =>
      expect(
        screen.getByText('File could not be read. Check the file is a valid budget backup.'),
      ).toBeInTheDocument(),
    )
  })
})
