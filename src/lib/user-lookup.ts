import type { Pool } from 'pg';

/** Loads a user row by id. */
export async function loadUserById(pool: Pool, userId: string) {
    return pool.query(`SELECT id, email FROM users WHERE id = ${userId}`);
}
