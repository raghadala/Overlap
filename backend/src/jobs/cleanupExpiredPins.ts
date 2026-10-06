import pool from '../db/pool';

export async function cleanupExpiredPins(): Promise<void> {
  // keep pins that are part of accepted connection
  const result = await pool.query(
    `DELETE FROM pins
     WHERE expires_at < now()
       AND NOT EXISTS (
         SELECT 1 FROM connection_requests cr
         WHERE cr.status = 'accepted'
           AND (cr.from_pin_id = pins.id OR cr.to_pin_id = pins.id)
       )
     RETURNING id`
  );

  if (result.rows.length > 0) {
    console.log(`Cleaned up ${result.rows.length} expired pin(s)`);
  }
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // once an hour

export function startPinCleanupJob(): void {
  cleanupExpiredPins().catch((err) => console.error('Pin cleanup failed:', err));

  setInterval(() => {
    cleanupExpiredPins().catch((err) => console.error('Pin cleanup failed:', err));
  }, CLEANUP_INTERVAL_MS);
}