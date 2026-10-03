import styles from './ExchangeScreen.module.scss'

interface ExchangeScreenProps {
  from: string
  to: string
  amount: string
  result: string
  currencies: string[]
  loading: boolean
  updatedAt: string | null
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onRefresh: () => void
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return '—'
  const time = iso.split('T')[1]
  if (!time) return '—'
  return time.slice(0, 8)
}

export default function ExchangeScreen({
  from,
  to,
  amount,
  result,
  currencies,
  loading,
  updatedAt,
  onFromChange,
  onToChange,
  onRefresh,
}: ExchangeScreenProps) {
  return (
    <div className={styles.screen}>
      <div className={styles.row}>
        <select
          data-testid="from-currency"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className={styles.currency}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
        <span data-testid="amount" className={styles.amount}>
          {amount}
        </span>
      </div>

      <div className={styles.row}>
        <select
          data-testid="to-currency"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className={styles.currency}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
        <span data-testid="result" className={styles.result}>
          {result}
        </span>
      </div>

      <div className={styles.footer}>
        {loading ? (
          <span className={styles.updated}>Loading…</span>
        ) : (
          <span data-testid="updated-at" className={styles.updated}>
            Last updated {formatUpdatedAt(updatedAt)}
          </span>
        )}
        <button
          type="button"
          data-testid="refresh"
          className={styles.refresh}
          onClick={onRefresh}
          aria-label="Refresh quote"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
          </svg>
        </button>
      </div>
    </div>
  )
}
