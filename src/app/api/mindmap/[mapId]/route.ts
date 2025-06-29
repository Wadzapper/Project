// src/app/api/mindmap/[mapId]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    mapId: string; // MindMap ID
  };
}

// GET /api/mindmap/[mapId] - Fetch a single mind map by ID, including nodes and edges
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { mapId } = params;
    const mindMap = await prisma.mindMap.findUnique({
      where: { id: mapId },
      include: {
        user: { select: { id: true, username: true } },
        nodes: { // Include all nodes
          orderBy: { label: 'asc' } // or by creation date, or position
        },
        edges: true, // Include all edges
      },
    });

    if (!mindMap) {
      return NextResponse.json({ message: 'Mind map not found' }, { status: 404 });
    }
    return NextResponse.json(mindMap);
  } catch (error) {
    console.error(`Error fetching mind map ${params.id}:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/mindmap/[id] - Update a mind map's properties
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, description, isPublic, layout } = body;

    // Prevent changing userId
    if (body.userId) {
        return NextResponse.json({ message: 'Cannot change ownership (userId) of a mind map.' }, { status: 400 });
    }

    const updateData: Prisma.MindMapUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (layout !== undefined) updateData.layout = layout;
    // Ensure there's at least one field to update, or Prisma might error
    if (Object.keys(updateData).length === 0) {
        // Optionally, return the current mindmap data if no update fields are provided
        const currentMindMap = await prisma.mindMap.findUnique({
            where: { id: mapId },
            include: { user: { select: { id: true, username: true } }, nodes: true, edges: true }
        });
        if (!currentMindMap) return NextResponse.json({ message: 'Mind map not found' }, { status: 404 });
        return NextResponse.json(currentMindMap); // Or return 304 Not Modified, or 400 Bad Request
    }

    const updatedMindMap = await prisma.mindMap.update({
      where: { id },
      data: updateData,
      include: { // Return the updated map with its components
        user: { select: { id: true, username: true } },
        nodes: true,
        edges: true,
      },
    });

    return NextResponse.json(updatedMindMap);
  } catch (error) {
    console.error(`Error updating mind map ${params.mapId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'Mind map not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/mindmap/[mapId] - Delete a mind map
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { mapId } = params;

    // Deleting a MindMap will cascade delete its MindMapNode and MindMapEdge entries
    // due to the schema definitions:
    // model MindMap { nodes MindMapNode[]; edges MindMapEdge[]; }
    // model MindMapNode { mindMap MindMap @relation(fields: [mindMapId], references: [id], onDelete: Cascade); }
    // model MindMapEdge { mindMap MindMap @relation(fields: [mindMapId], references: [id], onDelete: Cascade); }
    //                      sourceNode MindMapNode @relation(..., onDelete: Cascade)
    //                      targetNode MindMapNode @relation(..., onDelete: Cascade)

    await prisma.mindMap.delete({
      where: { id: mapId },
    });
    // Note: Nodes and Edges associated with this MindMap are automatically deleted by Prisma due to onDelete: Cascade.

    return NextResponse.json({ message: 'Mind map and all its nodes and edges deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting mind map ${params.mapId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Mind map not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
