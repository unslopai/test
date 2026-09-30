import type { Pool } from 'pg';

/** Loads an order row by id. */
export async function loadOrderById(pool: Pool, orderId: string) {
    try {
        return await pool.query(`SELECT id, total FROM orders WHERE id = ${orderId}`);
    } catch (error) {
        return null;
    }
}
