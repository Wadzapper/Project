// src/app/api/mindmap/[mapId]/edges/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    mapId: string;
  };
}

// GET /api/mindmap/[mapId]/edges - Fetch all edges for a specific mind map
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { mapId } = params;

    const mindMapExists = await prisma.mindMap.findUnique({ where: { id: mapId } });
    if (!mindMapExists) {
      return NextResponse.json({ message: `Mind map with id ${mapId} not found.` }, { status: 404 });
    }

    const edges = await prisma.mindMapEdge.findMany({
      where: { mindMapId: mapId },
      include: {
        sourceNode: { select: { id: true, label: true } },
        targetNode: { select: { id: true, label: true } },
      }
      // orderBy can be added if needed, e.g., by createdAt
    });
    return NextResponse.json(edges);
  } catch (error) {
    console.error(`Error fetching edges for mind map ${params.mapId}:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/mindmap/[mapId]/edges - Create a new edge in a mind map
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { mapId } = params;
    const body = await request.json();
    const { sourceId, targetId, label, animated } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json({ message: 'Missing required fields: sourceId, targetId for the edge' }, { status: 400 });
    }
    if (sourceId === targetId) {
        return NextResponse.json({ message: 'Edge source and target cannot be the same node.' }, { status: 400 });
    }

    const mindMap = await prisma.mindMap.findUnique({ where: { id: mapId } });
    if (!mindMap) {
      return NextResponse.json({ message: `Mind map with id ${mapId} not found.` }, { status: 404 });
    }

    // Verify source and target nodes exist within this mind map
    const sourceNode = await prisma.mindMapNode.findUnique({ where: { id: sourceId, mindMapId: mapId } });
    if (!sourceNode) {
      return NextResponse.json({ message: `Source node with id ${sourceId} not found in this mind map.` }, { status: 404 });
    }
    const targetNode = await prisma.mindMapNode.findUnique({ where: { id: targetId, mindMapId: mapId } });
    if (!targetNode) {
      return NextResponse.json({ message: `Target node with id ${targetId} not found in this mind map.` }, { status: 404 });
    }

    const newEdge = await prisma.mindMapEdge.create({
      data: {
        mindMap: { connect: { id: mapId } },
        sourceNode: { connect: { id: sourceId } },
        targetNode: { connect: { id: targetId } },
        label,
        animated,
      },
      include: {
        sourceNode: { select: { id: true, label: true } },
        targetNode: { select: { id: true, label: true } },
      }
    });
    return NextResponse.json(newEdge, { status: 201 });
  } catch (error) {
    console.error(`Error creating edge in mind map ${params.mapId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { // Unique constraint (sourceId, targetId, mindMapId)
        return NextResponse.json({ message: 'An edge already exists between these source and target nodes in this mind map.' }, { status: 409 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
