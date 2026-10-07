// app/api/changeUserRole/[userId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import postgres from '@vercel/postgres';

const db = new postgres.Postgres();

interface ChangeRoleParams {
  userId: string;
}

export async function PUT(req: NextRequest) {
  const { userId } = req.nextUrl.pathname.split('/').slice(4);
  const body = await req.json();
  const role = body.role; // Assuming the role is sent in the request body

  if (!userId || !role) {
    return new NextResponse(JSON.stringify({ message: 'Missing user ID or role' }), { status: 400 });
  }

  try {
    // Validate role
    if (['user', 'editor', 'admin'].includes(role)) {
      await db.query(
        `UPDATE users SET role = $1 WHERE id = $2`,
        [role, userId]
      );
      return new NextResponse(JSON.stringify({ message: 'Role updated successfully' }), { status: 200 });
    } else {
      return new NextResponse(JSON.stringify({ message: 'Invalid role' }), { status: 400 });
    }
  } catch (error) {
    console.error(error);
    return new NextResponse(JSON.stringify({ message: 'Failed to update role' }), { status: 500 });
  }
}
