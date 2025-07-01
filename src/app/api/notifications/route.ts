// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/notifications?userId=<userId>&read=false
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const readParam = searchParams.get('read'); // 'true', 'false', or null for all

  if (!userId) {
    return NextResponse.json({ message: 'Query parameter "userId" is required.' }, { status: 400 });
  }

  try {
    const whereClause: Prisma.NotificationWhereInput = { userId };
    if (readParam === 'true') {
      whereClause.read = true;
    } else if (readParam === 'false') {
      whereClause.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }, // Show newest first
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    const unreadCount = await prisma.notification.count({
        where: { userId, read: false }
    });


    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error(`Error fetching notifications for user ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Internal server error', error: errorMessage }, { status: 500 });
  }
}

// POST /api/notifications - Create a new notification
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
        userId,
        type,
        title,
        body: notificationBody, // Renamed to avoid conflict with request.body
        relatedId,
        triggerAt
    } = body;

    if (!userId || !type || !title || !notificationBody || !triggerAt) {
      return NextResponse.json({ message: 'Missing required fields: userId, type, title, body, triggerAt' }, { status: 400 });
    }

    // Validate user exists
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return NextResponse.json({ message: `User with ID ${userId} not found.` }, { status: 404 });
    }

    // Further validation for relatedId based on type could be added here
    // e.g., if type is 'quest', check if relatedId (Quest ID) exists.

    const newNotification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body: notificationBody,
        relatedId,
        triggerAt: new Date(triggerAt), // Ensure triggerAt is a Date object
        read: false, // New notifications are unread by default
      },
      include: {
        user: { select: { id: true, username: true } },
      }
    });

    return NextResponse.json(newNotification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: errorMessage }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error', error: errorMessage }, { status: 500 });
  }
}
