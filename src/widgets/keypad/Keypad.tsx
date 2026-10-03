import type { ReactNode } from 'react'
import { DISABLED_ON_HISTORY, type KeyId, type TabId } from '@/shared/lib/constants'
import { isZero } from '@/shared/lib/money'
import styles from './Keypad.module.scss'

type KeyVariant = 'digit' | 'danger' | 'save' | 'backspace' | 'arrow' | 'ok'

interface KeyConfig {
  id: KeyId
  label?: string
  testId: string
  variant: KeyVariant
  historyOnly?: boolean
  render?: () => ReactNode
}

const ROWS: KeyConfig[][] = [
  [
    { id: 'clear', label: 'C', testId: 'key-clear', variant: 'danger' },
    { id: 'backspace', testId: 'key-backspace', variant: 'backspace' },
    { id: 'save', label: 'm', testId: 'key-save', variant: 'save' },
  ],
  [
    { id: '7', label: '7', testId: 'key-7', variant: 'digit' },
    { id: '8', label: '8', testId: 'key-8', variant: 'digit' },
    { id: '9', label: '9', testId: 'key-9', variant: 'digit' },
    { id: 'up', label: '▲', testId: 'key-up', variant: 'arrow', historyOnly: true },
  ],
  [
    { id: '4', label: '4', testId: 'key-4', variant: 'digit' },
    { id: '5', label: '5', testId: 'key-5', variant: 'digit' },
    { id: '6', label: '6', testId: 'key-6', variant: 'digit' },
    { id: 'down', label: '▼', testId: 'key-down', variant: 'arrow', historyOnly: true },
  ],
  [
    { id: '1', label: '1', testId: 'key-1', variant: 'digit' },
    { id: '2', label: '2', testId: 'key-2', variant: 'digit' },
    { id: '3', label: '3', testId: 'key-3', variant: 'digit' },
    { id: 'ok', label: '🆗', testId: 'key-ok', variant: 'ok', historyOnly: true },
  ],
  [
    { id: '00', label: '00', testId: 'key-00', variant: 'digit' },
    { id: '0', label: '0', testId: 'key-0', variant: 'digit' },
    { id: 'dot', label: '.', testId: 'key-dot', variant: 'digit' },
  ],
]

function BackspaceIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

interface KeypadProps {
  tab: TabId
  historyEmpty: boolean
  canSave: boolean
  amount: string
  onKey: (id: KeyId) => void
}

export default function Keypad({ tab, historyEmpty, canSave, amount, onKey }: KeypadProps) {
  const isHistory = tab === 'history'
  const zeroAmount = isZero(amount)

  const computeDisabled = (id: KeyId): boolean => {
    if (isHistory) {
      if (DISABLED_ON_HISTORY.has(id)) return true
      if (
        historyEmpty &&
        (id === 'up' || id === 'down' || id === 'ok' || id === 'backspace' || id === 'clear')
      ) {
        return true
      }
      return false
    }
    if (id === 'save') return !canSave || zeroAmount
    return false
  }

  return (
    <div className={styles.keypad} role="group" aria-label="Keypad">
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.row}>
          {row.map((key) => {
            if (key.historyOnly && !isHistory) {
              return <span key={key.id} className={styles.placeholder} aria-hidden="true" />
            }
            const disabled = computeDisabled(key.id)
            return (
              <button
                key={key.id}
                type="button"
                data-testid={key.testId}
                disabled={disabled}
                onClick={() => onKey(key.id)}
                className={`${styles.key} ${styles[key.variant]}`}
                aria-label={key.variant === 'backspace' ? 'Backspace' : undefined}
              >
                {key.variant === 'backspace' ? <BackspaceIcon /> : key.label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
