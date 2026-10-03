import type { HistoryRecord } from '@/entities/history-record'
import styles from './HistoryScreen.module.scss'

interface HistoryScreenProps {
  history: HistoryRecord[]
  selected: number
}

function formatRecord(record: HistoryRecord): string {
  return `${record.from} ${record.amount} → ${record.to} ${record.result}`
}

export default function HistoryScreen({ history, selected }: HistoryScreenProps) {
  return (
    <div className={styles.screen}>
      <ul className={styles.list}>
        {history.map((record, i) => (
          <li
            key={i}
            data-testid="history-item"
            aria-selected={i === selected}
            className={styles.item}
          >
            {formatRecord(record)}
          </li>
        ))}
      </ul>
      <p data-testid="history-count" className={styles.count}>
        {history.length} records
      </p>
    </div>
  )
}
