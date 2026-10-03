import type { HistoryRecord } from '@/entities/history-record'
import type { KeyId, TabId } from '@/shared/lib/constants'
import Tabs from '@/widgets/tabs'
import ExchangeScreen from '@/widgets/exchange-screen'
import HistoryScreen from '@/widgets/history-screen'
import Keypad from '@/widgets/keypad'
import Skeleton from './Skeleton'
import styles from './ConverterPage.module.scss'

interface ConverterPageProps {
  tab: TabId
  onTabChange: (tab: TabId) => void
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
  history: HistoryRecord[]
  selected: number
  onKey: (id: KeyId) => void
  canSave: boolean
  isInitialLoad: boolean
}

export default function ConverterPage({
  tab,
  onTabChange,
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
  history,
  selected,
  onKey,
  canSave,
  isInitialLoad,
}: ConverterPageProps) {
  const historyEmpty = history.length === 0
  return (
    <div className={styles.shell}>
      <div className={styles.phone}>
        <div className={styles.body}>
          <Tabs tab={tab} onChange={onTabChange} />
          {tab === 'exchange' ? (
            <ExchangeScreen
              from={from}
              to={to}
              amount={amount}
              result={result}
              resultState={resultState}
              currencies={currencies}
              currenciesLoading={currenciesLoading}
              currenciesError={currenciesError}
              onRetryCurrencies={onRetryCurrencies}
              ageLabel={ageLabel}
              onFromChange={onFromChange}
              onToChange={onToChange}
              onRefresh={onRefresh}
            />
          ) : (
            <HistoryScreen history={history} selected={selected} />
          )}
        </div>
        <Keypad
          tab={tab}
          historyEmpty={historyEmpty}
          canSave={canSave}
          amount={amount}
          onKey={onKey}
        />
        <div className={styles.homeIndicator} aria-hidden="true" />
        {isInitialLoad ? <Skeleton /> : null}
      </div>
    </div>
  )
}
