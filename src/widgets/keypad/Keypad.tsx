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
  ariaLabel?: string
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
    { id: 'up', testId: 'key-up', variant: 'arrow', historyOnly: true },
  ],
  [
    { id: '4', label: '4', testId: 'key-4', variant: 'digit' },
    { id: '5', label: '5', testId: 'key-5', variant: 'digit' },
    { id: '6', label: '6', testId: 'key-6', variant: 'digit' },
    { id: 'down', testId: 'key-down', variant: 'arrow', historyOnly: true },
  ],
  [
    { id: '1', label: '1', testId: 'key-1', variant: 'digit' },
    { id: '2', label: '2', testId: 'key-2', variant: 'digit' },
    { id: '3', label: '3', testId: 'key-3', variant: 'digit' },
    { id: 'ok', testId: 'key-ok', variant: 'ok', historyOnly: true },
  ],
  [
    { id: '00', label: '00', testId: 'key-00', variant: 'digit' },
    { id: '0', label: '0', testId: 'key-0', variant: 'digit' },
    { id: 'dot', label: '.', testId: 'key-dot', variant: 'digit' },
  ],
]

function BackspaceIcon() {
  return (
    <svg width="44" height="30" viewBox="0 0 44 30" fill="none" aria-hidden="true">
      <path
        className={styles.tag}
        d="M15 1H39a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H15L1.7 16.2a1.7 1.7 0 0 1 0-2.4Z"
      />
      <path d="M21.5 10l10 10M31.5 10l-10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function KeyTile({ id, children }: { id: string; children: ReactNode }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C6D6E4" />
          <stop offset="0.12" stopColor="#AEC5D8" />
          <stop offset="0.24" stopColor="#8FAFCB" />
          <stop offset="0.4" stopColor="#7A9DBD" />
          <stop offset="0.7" stopColor="#6A89A5" />
          <stop offset="1" stopColor="#607B95" />
        </linearGradient>
      </defs>
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="8"
        fill={`url(#${id})`}
        stroke="#5F7B96"
        strokeWidth="1.5"
      />
      {children}
    </svg>
  )
}

function UpIcon() {
  return (
    <KeyTile id="key-grad-up">
      <path d="M20 10 31.5 30h-23Z" fill="#fff" />
    </KeyTile>
  )
}

function DownIcon() {
  return (
    <KeyTile id="key-grad-down">
      <path d="M8.5 11.5h23L20 31.5Z" fill="#fff" />
    </KeyTile>
  )
}

function OkIcon() {
  return (
    <KeyTile id="key-grad-ok">
      <circle cx="12.5" cy="20" r="7" stroke="#fff" strokeWidth="3" />
      <path d="M23.5 11.5v17M35.5 11.5l-10 9M28 19l8 9.5" stroke="#fff" strokeWidth="3" />
    </KeyTile>
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

  const renderKeyContent = (key: KeyConfig): ReactNode => {
    if (key.variant === 'backspace') return <BackspaceIcon />
    if (key.id === 'up') return <UpIcon />
    if (key.id === 'down') return <DownIcon />
    if (key.id === 'ok') return <OkIcon />
    return key.label
  }

  const computeAriaLabel = (key: KeyConfig): string | undefined => {
    if (key.variant === 'backspace') return 'Backspace'
    if (key.id === 'up') return 'Up'
    if (key.id === 'down') return 'Down'
    if (key.id === 'ok') return 'OK'
    return undefined
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
                aria-label={computeAriaLabel(key)}
              >
                {renderKeyContent(key)}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
