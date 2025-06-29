// src/app/api/mindmap/[mapId]/edges/[edgeId]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    mapId: string;
    edgeId: string;
  };
}

// GET /api/mindmap/[mapId]/edges/[edgeId] - Fetch a single edge
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { mapId, edgeId } = params;
    const edge = await prisma.mindMapEdge.findUnique({
      where: { id: edgeId, mindMapId: mapId }, // Ensure edge belongs to the map
      include: {
        mindMap: { select: { id: true, name: true, userId: true } },
        sourceNode: { select: { id: true, label: true } },
        targetNode: { select: { id: true, label: true } },
      },
    });

    if (!edge) {
      return NextResponse.json({ message: 'Mind map edge not found or does not belong to this map' }, { status: 404 });
    }
    return NextResponse.json(edge);
  } catch (error) {
    console.error(`Error fetching edge ${params.edgeId} for map ${params.mapId}:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/mindmap/[mapId]/edges/[edgeId] - Update an edge
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { mapId, edgeId } = params;
    const body = await request.json();
    const { label, animated, sourceId, targetId } = body; // Allow updating source/target with caution

    const edgeToUpdate = await prisma.mindMapEdge.findUnique({ where: { id: edgeId, mindMapId: mapId }});
    if (!edgeToUpdate) {
        return NextResponse.json({ message: 'Edge not found in this map for update.' }, { status: 404 });
    }

    // Prevent changing mindMapId
    if (body.mindMapId && body.mindMapId !== mapId) {
        return NextResponse.json({ message: 'Cannot change the mind map association of an edge.' }, { status: 400 });
    }

    const updateData: Prisma.MindMapEdgeUpdateInput = {};
    if (label !== undefined) updateData.label = label;
    if (animated !== undefined) updateData.animated = animated;

    if (sourceId !== undefined) {
        if (sourceId === (targetId || edgeToUpdate.targetId)) return NextResponse.json({ message: 'Edge source and target cannot be the same node.' }, { status: 400 });
        const sourceNode = await prisma.mindMapNode.findUnique({ where: { id: sourceId, mindMapId: mapId } });
        if (!sourceNode) return NextResponse.json({ message: `New source node ${sourceId} not found in this map.` }, { status: 404 });
        updateData.sourceNode = { connect: { id: sourceId } };
    }
    if (targetId !== undefined) {
        if (targetId === (sourceId || edgeToUpdate.sourceId)) return NextResponse.json({ message: 'Edge source and target cannot be the same node.' }, { status: 400 });
        const targetNode = await prisma.mindMapNode.findUnique({ where: { id: targetId, mindMapId: mapId } });
        if (!targetNode) return NextResponse.json({ message: `New target node ${targetId} not found in this map.` }, { status: 404 });
        updateData.targetNode = { connect: { id: targetId } };
    }

    // Check for unique constraint violation if source/target changed
    if ((sourceId && sourceId !== edgeToUpdate.sourceId) || (targetId && targetId !== edgeToUpdate.targetId)) {
        const newSource = sourceId || edgeToUpdate.sourceId;
        const newTarget = targetId || edgeToUpdate.targetId;
        if (newSource !== newTarget) { // only check if not making it a self-loop (which is already prevented)
            const existingEdge = await prisma.mindMapEdge.findUnique({
                where: { sourceId_targetId_mindMapId: { sourceId: newSource, targetId: newTarget, mindMapId: mapId } }
            });
            if (existingEdge && existingEdge.id !== edgeId) {
                return NextResponse.json({ message: 'Another edge already exists between the new source and target nodes.' }, { status: 409 });
            }
        }
    }


    const updatedEdge = await prisma.mindMapEdge.update({
      where: { id: edgeId },
      data: updateData,
      include: {
        sourceNode: { select: { id: true, label: true } },
        targetNode: { select: { id: true, label: true } },
      }
    });

    return NextResponse.json(updatedEdge);
  } catch (error) {
    console.error(`Error updating edge ${params.edgeId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Edge not found' }, { status: 404 });
      }
       if (error.code === 'P2002') { // Unique constraint (sourceId, targetId, mindMapId)
        return NextResponse.json({ message: 'An edge already exists between these source and target nodes in this mind map (concurrent update or invalid change).' }, { status: 409 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/mindmap/[mapId]/edges/[edgeId] - Delete an edge
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { mapId, edgeId } = params;

    const edgeExists = await prisma.mindMapEdge.findUnique({ where: { id: edgeId, mindMapId: mapId }});
    if (!edgeExists) {
        return NextResponse.json({ message: 'Edge not found in this map for deletion.' }, { status: 404 });
    }

    await prisma.mindMapEdge.delete({
      where: { id: edgeId },
    });

    return NextResponse.json({ message: 'Edge deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting edge ${params.edgeId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Edge not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
