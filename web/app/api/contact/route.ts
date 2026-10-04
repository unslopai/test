import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Initialize connection pool
// Next.js will reuse the pool across requests in serverless environments where possible
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(request: Request) {
  let client;
  
  try {
    const body = await request.json();
    const { name, email, message } = body;

    // 1. Basic Validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 }
      );
    }

    // Email format validation (simple regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format.' },
        { status: 400 }
      );
    }

    // 2. Get a client from the pool and ensure the table exists
    client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Insert the form data securely using parameterized queries
    const query = `
      INSERT INTO contact_submissions (name, email, message)
      VALUES ($1, $2, $3)
      RETURNING id, created_at;
    `;
    
    const values = [name, email, message];
    const result = await client.query(query, values);

    // 4. Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Form submitted successfully!',
        data: result.rows[0],
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error. Please try again later.' },
      { status: 500 }
    );
  } finally {
    // Release the client back to the pool
    if (client) {
      client.release();
    }
  }
}
