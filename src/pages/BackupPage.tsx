import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import * as storage from '../storage/storage'
import { ImportError, type ImportErrorCode } from '../storage/schema'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import DestructiveButton from '../components/DestructiveButton'
import Toast, { type ToastVariant } from '../components/Toast'

// UI-SPEC §Phase 1 Screens — Backup. Export action + Import state machine:
// idle → fileSelected → importing → (success | error) → idle.
// Error messages are UI-SPEC verbatim — never concatenate file content into
// toast text (threat T-01-09 mitigation).

type ImportState = 'idle' | 'fileSelected' | 'importing'

const IMPORT_ERROR_COPY: Record<ImportErrorCode, string> = {
  VERSION_TOO_NEW:
    'This backup was created by a newer version of the app. Update the app to import it.',
  PARSE_ERROR: 'File could not be read. Check the file is a valid budget backup.',
  INVALID_ENVELOPE: 'File could not be read. Check the file is a valid budget backup.',
}

export default function BackupPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importState, setImportState] = useState<ImportState>('idle')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

  const reset = (): void => {
    setImportState('idle')
    setPendingFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleExport = async (): Promise<void> => {
    try {
      await storage.exportAll()
      setToast({ message: 'Backup exported.', variant: 'success' })
    } catch {
      setToast({ message: 'Export failed.', variant: 'error' })
    }
  }

  const handleImportClick = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) {
      setPendingFile(file)
      setImportState('fileSelected')
    }
  }

  const handleConfirmImport = async (): Promise<void> => {
    if (!pendingFile) return
    setImportState('importing')
    try {
      await storage.importAll(pendingFile)
      setToast({ message: 'Backup imported. Data restored.', variant: 'success' })
      reset()
    } catch (e) {
      const code = e instanceof ImportError ? e.code : 'PARSE_ERROR'
      setToast({ message: IMPORT_ERROR_COPY[code], variant: 'error' })
      reset()
    }
  }

  return (
    <div className="flex flex-col gap-sp-6">
      <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">Backup</h2>

      <div className="bg-surface-raised border border-surface-border rounded-sm p-sp-4 sm:p-sp-6 flex flex-col gap-sp-4">
        <section className="flex flex-col gap-sp-3">
          <p className="font-sans text-sm text-text-secondary leading-[1.5]">
            Download a JSON copy of all current data.
          </p>
          <div>
            <PrimaryButton onClick={handleExport}>Export backup</PrimaryButton>
          </div>
        </section>

        <hr className="border-surface-border" />

        <section className="flex flex-col gap-sp-3">
          {importState === 'idle' && (
            <>
              <p className="font-sans text-sm text-text-secondary leading-[1.5]">
                Restore data from a previously-exported backup file.
              </p>
              <div>
                <SecondaryButton onClick={handleImportClick}>Import backup</SecondaryButton>
              </div>
            </>
          )}

          {importState === 'fileSelected' && (
            <>
              <h3 className="font-display text-[20px] leading-[1.2] text-text-primary">
                This will replace all current data
              </h3>
              <p className="font-sans text-sm text-text-secondary leading-[1.5]">
                Your current data cannot be recovered after import. Export a backup first if
                needed.
              </p>
              <div className="flex gap-sp-3">
                <DestructiveButton onClick={handleConfirmImport}>
                  Replace and import
                </DestructiveButton>
                <SecondaryButton onClick={reset}>Cancel import</SecondaryButton>
              </div>
            </>
          )}

          {importState === 'importing' && (
            <div className="flex gap-sp-3">
              <DestructiveButton disabled>
                <span className="inline-flex items-center gap-sp-2">
                  <Loader2 size={16} className="animate-spin" />
                  Importing...
                </span>
              </DestructiveButton>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </section>
      </div>

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
