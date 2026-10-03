import type { TabId } from '@/shared/lib/constants'
import { TAB_LABELS } from '@/shared/lib/constants'
import styles from './Tabs.module.scss'

interface TabsProps {
  tab: TabId
  onChange: (tab: TabId) => void
}

export default function Tabs({ tab, onChange }: TabsProps) {
  return (
    <div className={styles.tabs} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'exchange'}
        data-testid="tab-exchange"
        className={styles.tab}
        onClick={() => onChange('exchange')}
      >
        {TAB_LABELS.exchange}
      </button>
      <span className={styles.divider} aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'history'}
        data-testid="tab-history"
        className={styles.tab}
        onClick={() => onChange('history')}
      >
        {TAB_LABELS.history}
      </button>
    </div>
  )
}
