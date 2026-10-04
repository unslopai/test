import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    // Parse the form data from the request
    const formData = await request.formData();
    const name = String(formData.get('name'));
    const email = String(formData.get('email'));
    const message = String(formData.get('message'));

    // Connect to the PostgreSQL database
    const db = await sql`SELECT 1`;

    // Insert the data into the 'contact' table
    await sql`
      INSERT INTO contact (name, email, message)
      VALUES (${name}, ${email}, ${message})
    `;

    // Return a success response
    return NextResponse.json({ message: 'Contact form submitted successfully!' }, { status: 200 });
  } catch (error) {
    // Log the error and return an error response
    console.error('Error submitting contact form:', error);
    return NextResponse.json({ error: 'Failed to submit contact form.' }, { status: 500 });
  }
}
