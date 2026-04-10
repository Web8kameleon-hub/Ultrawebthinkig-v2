/**
 * EuroWeb - Loading Page
 * Pure CSS Modules + CVA + Framer Motion
 * 
 * @author Ledjan Ahmati (100% Owner)
 * @version 8.0.0 Ultra
 */

import styles from './loading.module.css'

export default function Loading() {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} aria-label="Loading..." role="status">
        <div className={styles.spinnerInner} />
      </div>
      <p className={styles.text}>Loading EuroWeb Ultra Platform...</p>
    </div>
  )
}
