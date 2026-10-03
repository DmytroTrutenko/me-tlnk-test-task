import type { HistoryRecord } from '@/entities/history-record'
import type { KeyId, TabId } from '@/shared/lib/constants'
import Tabs from '@/widgets/tabs'
import ExchangeScreen from '@/widgets/exchange-screen'
import HistoryScreen from '@/widgets/history-screen'
import Keypad from '@/widgets/keypad'
import styles from './ConverterPage.module.scss'

interface ConverterPageProps {
  tab: TabId
  onTabChange: (tab: TabId) => void
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
  history: HistoryRecord[]
  selected: number
  onKey: (id: KeyId) => void
}

export default function ConverterPage({
  tab,
  onTabChange,
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
  history,
  selected,
  onKey,
}: ConverterPageProps) {
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
              currencies={currencies}
              loading={loading}
              updatedAt={updatedAt}
              onFromChange={onFromChange}
              onToChange={onToChange}
              onRefresh={onRefresh}
            />
          ) : (
            <HistoryScreen history={history} selected={selected} />
          )}
        </div>
        <Keypad tab={tab} onKey={onKey} />
        <div className={styles.homeIndicator} aria-hidden="true" />
      </div>
    </div>
  )
}
