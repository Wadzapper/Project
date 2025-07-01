// src/app/api/notifications/[id]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    id: string; // Notification ID
  };
}

// PATCH /api/notifications/[id] - Update a notification (e.g., mark as read/unread)
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const body = await request.json();
    const { read, title, body: notificationBody, type, triggerAt, relatedId } = body; // Allow updating other fields too

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return NextResponse.json({ message: `Notification with ID ${id} not found.` }, { status: 404 });
    }

    // In a real app with auth, you'd also check if the notification belongs to the authenticated user.
    // const userIdFromAuth = getUserIdFromSession(request);
    // if (notification.userId !== userIdFromAuth) {
    //   return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    // }

    const updateData: Prisma.NotificationUpdateInput = {};
    if (read !== undefined) updateData.read = read;
    if (title !== undefined) updateData.title = title;
    if (notificationBody !== undefined) updateData.body = notificationBody;
    if (type !== undefined) updateData.type = type;
    if (triggerAt !== undefined) updateData.triggerAt = new Date(triggerAt);
    if (relatedId !== undefined) updateData.relatedId = relatedId; // Can be null to unset

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(notification, {status: 200}); // No actual changes, return current
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, username: true } },
      }
    });

    return NextResponse.json(updatedNotification);
  } catch (error) {
    console.error(`Error updating notification ${params.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: 'Notification not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Internal server error', error: errorMessage }, { status: 500 });
  }
}

// DELETE /api/notifications/[id] - Delete a notification
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return NextResponse.json({ message: `Notification with ID ${id} not found.` }, { status: 404 });
    }

    // Add auth check here as well:
    // const userIdFromAuth = getUserIdFromSession(request);
    // if (notification.userId !== userIdFromAuth) {
    //   return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    // }

    await prisma.notification.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Notification deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting notification ${params.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: 'Notification not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Internal server error', error: errorMessage }, { status: 500 });
  }
}
