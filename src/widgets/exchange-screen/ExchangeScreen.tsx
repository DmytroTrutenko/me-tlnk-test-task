import styles from './ExchangeScreen.module.scss'

interface ExchangeScreenProps {
  from: string
  to: string
  amount: string
  result: string
  resultState: 'loading' | 'error' | 'ready'
  currencies: string[]
  currenciesLoading: boolean
  currenciesError: string | null
  onRetryCurrencies: () => void
  ageLabel: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onRefresh: () => void
}

function ResultText({ state, value }: { state: 'loading' | 'error' | 'ready'; value: string }) {
  if (state === 'loading') return <>…</>
  if (state === 'error') return <>—</>
  return <>{value}</>
}

export default function ExchangeScreen({
  from,
  to,
  amount,
  result,
  resultState,
  currencies,
  currenciesLoading,
  currenciesError,
  onRetryCurrencies,
  ageLabel,
  onFromChange,
  onToChange,
  onRefresh,
}: ExchangeScreenProps) {
  const selectOptions = from && !currencies.includes(from) ? [from, ...currencies] : currencies
  const toOptions = to && !currencies.includes(to) ? [to, ...currencies] : currencies

  return (
    <div className={styles.screen}>
      {currenciesError ? (
        <div className={styles.currencyError} role="alert">
          <span>{currenciesError}</span>
          <button type="button" className={styles.currencyRetry} onClick={onRetryCurrencies}>
            Retry
          </button>
        </div>
      ) : null}

      <div className={styles.row}>
        <select
          data-testid="from-currency"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className={styles.currency}
          disabled={currenciesLoading && currencies.length === 0}
        >
          {selectOptions.map((c) => (
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
          disabled={currenciesLoading && currencies.length === 0}
        >
          {toOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
        <span data-testid="result" className={styles.result}>
          <ResultText state={resultState} value={result} />
        </span>
      </div>

      {resultState === 'error' ? (
        <p className={styles.error} role="status">
          Couldn't fetch a quote. Try again.
        </p>
      ) : null}

      <div className={styles.footer}>
        <span data-testid="updated-at" className={styles.updated}>
          {resultState === 'loading' ? 'Updating…' : ageLabel}
        </span>
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
