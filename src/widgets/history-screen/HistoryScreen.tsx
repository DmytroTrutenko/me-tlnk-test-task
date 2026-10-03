import { useEffect, useRef } from 'react'
import type { HistoryRecord } from '@/entities/history-record'
import { formatMoney } from '@/shared/lib/money'
import styles from './HistoryScreen.module.scss'

interface HistoryScreenProps {
  history: HistoryRecord[]
  selected: number
}

function formatRecord(record: HistoryRecord): string {
  return `${record.from} ${formatMoney(record.amount)} → ${record.to} ${formatMoney(record.result)}`
}

export default function HistoryScreen({ history, selected }: HistoryScreenProps) {
  const selectedRef = useRef<HTMLLIElement | null>(null)
  const selectedId = history[selected]?.id

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedId])

  return (
    <div className={styles.screen}>
      <ul className={styles.list}>
        {history.map((record) => {
          const isSelected = record.id === selectedId
          return (
            <li
              key={record.id}
              data-testid="history-item"
              aria-selected={isSelected}
              className={styles.item}
              ref={isSelected ? selectedRef : null}
            >
              {formatRecord(record)}
            </li>
          )
        })}
      </ul>
      <p data-testid="history-count" className={styles.count}>
        {history.length === 1 ? '1 record' : `${history.length} records`}
      </p>
    </div>
  )
}
