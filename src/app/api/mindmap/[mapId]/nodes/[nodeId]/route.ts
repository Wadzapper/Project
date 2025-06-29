// src/app/api/mindmap/[mapId]/nodes/[nodeId]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteContext {
  params: {
    mapId: string;
    nodeId: string;
  };
}

// GET /api/mindmap/[mapId]/nodes/[nodeId] - Fetch a single node
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { mapId, nodeId } = params;
    const node = await prisma.mindMapNode.findUnique({
      where: { id: nodeId, mindMapId: mapId }, // Ensure node belongs to the map
      include: {
        mindMap: { select: { id: true, name: true, userId: true } },
        parentNode: { select: { id: true, label: true } }, // Parent in hierarchy
        childNodes: { select: { id: true, label: true } }, // Children in hierarchy
        edgesFrom: { include: { targetNode: { select: { id: true, label: true } } } }, // Edges originating from this node
        edgesTo: { include: { sourceNode: { select: { id: true, label: true } } } },   // Edges pointing to this node
      },
    });

    if (!node) {
      return NextResponse.json({ message: 'Mind map node not found or does not belong to this map' }, { status: 404 });
    }
    return NextResponse.json(node);
  } catch (error) {
    console.error(`Error fetching node ${params.nodeId} for map ${params.mapId}:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/mindmap/[mapId]/nodes/[nodeId] - Update a node
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { mapId, nodeId } = params;
    const body = await request.json();
    const { label, content, xPosition, yPosition, color, shape, parentNodeId } = body;

    const nodeToUpdate = await prisma.mindMapNode.findUnique({ where: { id: nodeId, mindMapId: mapId }});
    if (!nodeToUpdate) {
        return NextResponse.json({ message: 'Node not found in this map for update.' }, { status: 404 });
    }

    // Prevent changing mindMapId
    if (body.mindMapId && body.mindMapId !== mapId) {
        return NextResponse.json({ message: 'Cannot change the mind map association of a node.' }, { status: 400 });
    }

    const updateData: Prisma.MindMapNodeUpdateInput = {};
    if (label !== undefined) updateData.label = label;
    if (content !== undefined) updateData.content = content;
    if (xPosition !== undefined) updateData.xPosition = xPosition;
    if (yPosition !== undefined) updateData.yPosition = yPosition;
    if (color !== undefined) updateData.color = color;
    if (shape !== undefined) updateData.shape = shape;

    if (parentNodeId !== undefined) {
        if (parentNodeId === null) { // Disconnect from parent
            updateData.parentNode = { disconnect: true };
        } else {
            if (parentNodeId === nodeId) return NextResponse.json({ message: 'Node cannot be its own parent.' }, { status: 400 });
            const parentNodeExists = await prisma.mindMapNode.findUnique({ where: { id: parentNodeId, mindMapId: mapId }});
            if(!parentNodeExists) {
                return NextResponse.json({ message: `Parent node with id ${parentNodeId} not found in this mind map.` }, { status: 404 });
            }
            updateData.parentNode = { connect: { id: parentNodeId } };
        }
    }


    const updatedNode = await prisma.mindMapNode.update({
      where: { id: nodeId }, // mapId check done above
      data: updateData,
    });

    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error(`Error updating node ${params.nodeId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'Node not found' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/mindmap/[mapId]/nodes/[nodeId] - Delete a node
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { mapId, nodeId } = params;

    const nodeExists = await prisma.mindMapNode.findUnique({ where: { id: nodeId, mindMapId: mapId }});
    if (!nodeExists) {
        return NextResponse.json({ message: 'Node not found in this map for deletion.' }, { status: 404 });
    }

    // Deleting a node will also cascade delete its MindMapEdge entries where it's a source or target
    // due to `onDelete: Cascade` on `sourceNode` and `targetNode` in MindMapEdge model.
    // Also, if this node is a parentNode for other nodes, their parentNodeId will be set to null
    // due to `onDelete: NoAction, onUpdate: NoAction` (Prisma default if not specified, but might need explicit SetNull).
    // The schema uses `onDelete:NoAction, onUpdate:NoAction` for `parentNode` relation in `MindMapNode`.
    // This means we might need to manually update child nodes or Prisma will prevent deletion if children exist.
    // For simplicity, let's assume we want to set parentNodeId of children to null.

    await prisma.$transaction(async (tx) => {
        // 1. Update child nodes to remove reference to this node
        await tx.mindMapNode.updateMany({
            where: { parentNodeId: nodeId },
            data: { parentNodeId: null }
        });

        // 2. Delete edges connected to this node (Prisma handles this with onDelete: Cascade on MindMapEdge.source/target)
        // No explicit action needed here if schema is set up correctly.

        // 3. Delete the node itself
        await tx.mindMapNode.delete({
            where: { id: nodeId },
        });
    });

    return NextResponse.json({ message: 'Node and its connected edges deleted successfully. Child nodes unparented.' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting node ${params.nodeId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Node not found' }, { status: 404 });
      }
      // P2003 foreign key constraint, if child nodes were not handled properly and relation was RESTRICT
      return NextResponse.json({ message: 'Database error', error: error.message, code: error.code, meta: error.meta }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
