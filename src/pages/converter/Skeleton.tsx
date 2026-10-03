import styles from './Skeleton.module.scss'

export default function Skeleton() {
  return (
    <div className={styles.skeleton} data-testid="loading-skeleton" aria-hidden="true">
      <div className={styles.body}>
        <div className={styles.tabs}>
          <div className={`${styles.bar} ${styles.tabLeft}`} />
          <div className={`${styles.bar} ${styles.tabRight}`} />
        </div>

        <div className={styles.row}>
          <div className={`${styles.bar} ${styles.currency}`} />
          <div className={`${styles.bar} ${styles.chevron}`} />
          <div className={`${styles.bar} ${styles.value}`} />
        </div>

        <div className={styles.row}>
          <div className={`${styles.bar} ${styles.currency}`} />
          <div className={`${styles.bar} ${styles.chevron}`} />
          <div className={`${styles.bar} ${styles.valueWide}`} />
        </div>

        <div className={styles.footer}>
          <div className={`${styles.bar} ${styles.footerText}`} />
          <div className={`${styles.bar} ${styles.refreshIcon}`} />
        </div>
      </div>

      <div className={styles.keypad}>
        {Array.from({ length: 4 }).map((_, row) => (
          <div key={row} className={styles.keyRow}>
            {Array.from({ length: 4 }).map((__, col) => (
              <div key={col} className={`${styles.bar} ${styles.key}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
