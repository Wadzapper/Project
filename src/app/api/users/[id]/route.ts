// src/app/api/users/[id]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string;
  };
}

// GET /api/users/[id] - Fetch a single user by ID
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        preferences: true,
        skills: true,
        quests: true,
        // Add other relations as needed for a full user profile view
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error(`Error fetching user ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/users/[id] - Update a user by ID
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const body = await request.json();
    // Destructure only fields that are allowed to be updated
    const { email, username, profile, preferences, ...otherData } = body;

    // Basic validation: prevent updating certain critical fields or ensure data integrity
    // More complex validation (e.g. Zod) would be better in a real app.
    if (Object.keys(otherData).length > 0 && !otherData.passwordHash) { // Allow passwordHash update, deny others not explicitly handled.
        // If otherData contains keys other than passwordHash, it means unexpected fields were sent.
        // Or, be more specific: delete otherData.passwordHash; if (Object.keys(otherData).length > 0) ...
    }


    const updateData: Prisma.UserUpdateInput = {};
    if (email) updateData.email = email;
    if (username) updateData.username = username;
    if (body.passwordHash) updateData.passwordHash = body.passwordHash; // Handle password update carefully

    if (profile) {
      updateData.profile = {
        upsert: { // Create profile if not exists, update if it does
          create: profile,
          update: profile,
        },
      };
    }

    if (preferences) {
      updateData.preferences = {
        upsert: {
          create: preferences,
          update: preferences,
        },
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        profile: true,
        preferences: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error(`Error updating user ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
      }
      if (error.code === 'P2002') { // Unique constraint violation
        return NextResponse.json({ message: 'Email or username already in use by another account', fields: error.meta?.target }, { status: 409 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Delete a user by ID
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    await prisma.user.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 }); // Or 204 No Content
  } catch (error) {
    console.error(`Error deleting user ${params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
