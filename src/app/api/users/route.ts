// src/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/users - Fetch all users
export async function GET(request: Request) {
  try {
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        preferences: true,
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users - Create a new user
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, username, passwordHash, profile, preferences } = body;

    if (!email || !username || !passwordHash) {
      return NextResponse.json({ message: 'Missing required fields: email, username, passwordHash' }, { status: 400 });
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash, // In a real app, hash the password before saving
        profile: profile ? { create: profile } : undefined,
        preferences: preferences ? { create: preferences } : undefined,
      },
      include: {
        profile: true,
        preferences: true,
      },
    });
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { // Unique constraint violation
        return NextResponse.json({ message: 'User with this email or username already exists', fields: error.meta?.target }, { status: 409 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
