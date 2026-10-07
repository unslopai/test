import { NextResponse } from 'next/server';
import postgres from 'postgres';

// Initialize postgres client
// In production, ensure this is a singleton to prevent connection leaks
const sql = postgres(process.env.DATABASE_URL!);

// Define allowed roles to prevent invalid data injection
const ALLOWED_ROLES = ['user', 'editor', 'admin'] as const;
type Role = typeof ALLOWED_ROLES[number];

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, role } = body;

    // 1. Validate input presence
    if (!userId || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and role' },
        { status: 400 }
      );
    }

    // 2. Validate role value
    if (!ALLOWED_ROLES.includes(role as Role)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed roles are: ${ALLOWED_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // TODO: Add authentication & authorization checks here!
    // Example: Check if the requester is an admin using your auth provider (NextAuth, Clerk, Supabase, etc.)

    // 3. Update the user role in the database
    // Assuming your table is named 'users' with columns 'id' and 'role'
    const result = await sql`
      UPDATE users 
      setItem 
      SET role = ${role}, updated_s = NOW() 
      WHERE id = ${userId} 
      RETURNING id, email, role
    `;

    // 4. Check if user was found and updated
    if (result.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const updatedUser = result[0];

    // 5. Return success response
    return NextResponse.json(
      { 
        message: 'User role updated successfully', 
        user: updatedUser 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Failed to update user role:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
