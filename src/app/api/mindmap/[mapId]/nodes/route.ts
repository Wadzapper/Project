// src/app/api/mindmap/[mapId]/nodes/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    mapId: string;
  };
}

// GET /api/mindmap/[mapId]/nodes - Fetch all nodes for a specific mind map
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { mapId } = params;

    const mindMapExists = await prisma.mindMap.findUnique({ where: { id: mapId } });
    if (!mindMapExists) {
      return NextResponse.json({ message: `Mind map with id ${mapId} not found.` }, { status: 404 });
    }

    const nodes = await prisma.mindMapNode.findMany({
      where: { mindMapId: mapId },
      orderBy: { label: 'asc' }, // Or by xPosition, yPosition, createdAt
      // Minimal include for list view, details can be fetched from node's own endpoint
    });
    return NextResponse.json(nodes);
  } catch (error) {
    console.error(`Error fetching nodes for mind map ${params.mapId}:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/mindmap/[mapId]/nodes - Create a new node in a mind map
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { mapId } = params;
    const body = await request.json();
    const { label, content, xPosition, yPosition, color, shape, parentNodeId } = body;

    if (!label) {
      return NextResponse.json({ message: 'Missing required field: label for the node' }, { status: 400 });
    }

    const mindMap = await prisma.mindMap.findUnique({ where: { id: mapId } });
    if (!mindMap) {
      return NextResponse.json({ message: `Mind map with id ${mapId} not found.` }, { status: 404 });
    }

    if (parentNodeId) {
        const parentNodeExists = await prisma.mindMapNode.findUnique({ where: { id: parentNodeId, mindMapId: mapId }});
        if(!parentNodeExists) {
            return NextResponse.json({ message: `Parent node with id ${parentNodeId} not found in this mind map.` }, { status: 404 });
        }
    }

    const newNode = await prisma.mindMapNode.create({
      data: {
        mindMap: { connect: { id: mapId } },
        label,
        content,
        xPosition,
        yPosition,
        color,
        shape,
        parentNodeId: parentNodeId || undefined, // Connect to parent if provided
      },
      // Include parentNode if desired, but can be minimal for POST response
    });
    return NextResponse.json(newNode, { status: 201 });
  } catch (error) {
    console.error(`Error creating node in mind map ${params.mapId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
