// Summary: Mindmap page to visualize skill trees using React Flow.
// TODO: Implement a skill tree selector if multiple trees exist. Currently defaults to first tree.
// TODO: Implement more sophisticated layout algorithm if needed (e.g., Dagre).
// TODO: Add edge styling (e.g., animated, different types).
// TODO: Add interactivity like node dragging, selection, zooming beyond defaults.
// TODO: Fetch and display skill goal information in tooltips.
// TODO: Refine node styling based on BTD6 theme more closely.

'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css'; // Default styles are important

import { Loader2, AlertTriangle, Brain } from 'lucide-react';
import { Skill, SkillTree, SkillTreeNode } from '@prisma/client'; // Assuming these types
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getSkillColorClass } from '@/lib/skillUtils'; // For color coding based on level

// Define types for fetched data
interface SkillTreeNodeWithSkill extends SkillTreeNode {
  skill: Pick<Skill, 'id' | 'name' | 'currentLevel' | 'currentXp' | 'targetXpForNextLevel'> | null;
}
interface SkillTreeWithNodesAndSkills extends SkillTree {
  nodes: SkillTreeNodeWithSkill[];
}
type SkillMap = Map<string, Pick<Skill, 'id' | 'name' | 'currentLevel' | 'currentXp' | 'targetXpForNextLevel'>>;


// Helper to determine node color based on XP/Level
// Low = gray/locked (Level 1, low XP for L1)
// Mid = blue (Level 1 high XP, or Level 2-3)
// High = gold/orange (Level 4+)
const getNodeStyle = (skill?: Pick<Skill, 'currentLevel' | 'currentXp' | 'targetXpForNextLevel'> | null): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '10px 15px',
    borderRadius: '8px',
    borderWidth: '2px',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  if (!skill) {
    return { ...baseStyle, background: '#cbd5e1', color: '#475569', borderColor: '#94a3b8' }; // Gray - Locked/Unknown
  }

  const level = skill.currentLevel || 1;
  // const xp = skill.currentXp || 0;
  // const targetXp = skill.targetXpForNextLevel || 100;
  // const progressInLevel = targetXp > 0 ? (xp / targetXp) : 0;

  // BTD6 style: playful, rounded UI, clean animations
  // Dark Mode: Night, stars, water, moon → calming, serene tones (blues, purples, silver)
  // Light Mode: Sun, fire, daylight, light rays → invigorating, energizing (reds, oranges, yellows, gold)
  // For now, let's use a simpler level-based theming that can be adapted.

  if (level <= 1) { // Consider low XP for level 1 as "low"
    return { ...baseStyle, background: '#60a5fa', color: 'white', borderColor: '#2563eb' }; // Light Blue (adjust for theme)
  } else if (level <= 3) {
    return { ...baseStyle, background: '#3b82f6', color: 'white', borderColor: '#1d4ed8' }; // Mid Blue
  } else { // Level 4+
    return { ...baseStyle, background: '#f59e0b', color: 'white', borderColor: '#b45309' }; // Amber/Gold
  }
};


const MindmapPage = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSkillTree, setActiveSkillTree] = useState<SkillTreeWithNodesAndSkills | null>(null);
  const [allSkillsMap, setAllSkillsMap] = useState<SkillMap>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch all skill trees (to pick one)
        const treesResponse = await fetch('/api/skill-trees');
        if (!treesResponse.ok) throw new Error('Failed to fetch skill trees');
        const treesData: SkillTree[] = await treesResponse.json();

        if (treesData.length === 0) {
          setError('No skill trees available to display.');
          setIsLoading(false);
          return;
        }
        const firstTreeId = treesData[0].id; // Default to the first tree

        // 2. Fetch details of the chosen skill tree (including nodes and linked skills)
        const treeDetailResponse = await fetch(`/api/skill-trees/${firstTreeId}`);
        if (!treeDetailResponse.ok) throw new Error(`Failed to fetch details for skill tree ${firstTreeId}`);
        const treeDetailData: SkillTreeWithNodesAndSkills = await treeDetailResponse.json();
        setActiveSkillTree(treeDetailData);

        // 3. Fetch all skills for XP/Level data (if not fully populated in treeDetailData.nodes.skill)
        // The /api/skill-trees/[id] endpoint already includes basic skill info in nodes.
        // If more skill details are needed (e.g. for tooltips), fetch them all.
        // For now, assuming treeDetailData.nodes.skill has what we need (name, level, xp).
        // If not, we'd fetch /api/skills and create a map.
        // Let's assume the node.skill from API is sufficient for now.

      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        // setIsLoading(false); // Will be set to false after processing data into nodes/edges
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!activeSkillTree) return;

    const rfNodes: Node[] = [];
    const rfEdges: Edge[] = [];
    const nodePositions: { [key: string]: { x: number, y: number } } = {};

    // Simple auto-layout: BFS-like approach for positioning
    const layoutNodes = (treeNodes: SkillTreeNodeWithSkill[]) => {
        const rootNodes = treeNodes.filter(n => !n.parentId);
        const positioned = new Set<string>();
        const queue: Array<{ nodeId: string, x: number, y: number, level: number }> = [];

        rootNodes.forEach((node, index) => {
            const x = index * 250;
            const y = 0;
            queue.push({ nodeId: node.id, x, y, level: 0 });
            nodePositions[node.id] = { x, y };
            positioned.add(node.id);
        });

        let head = 0;
        while(head < queue.length) {
            const current = queue[head++];
            const children = treeNodes.filter(n => n.parentId === current.nodeId && !positioned.has(n.id));

            children.forEach((child, index) => {
                // Basic horizontal spread for children
                const xOffset = (index - (children.length - 1) / 2) * 200;
                const childX = current.x + xOffset;
                const childY = current.y + 150; // Vertical spacing for next level

                if (!positioned.has(child.id)) {
                    nodePositions[child.id] = { x: childX, y: childY };
                    queue.push({ nodeId: child.id, x: childX, y: childY, level: current.level + 1 });
                    positioned.add(child.id);
                }
            });
        }
    };

    if (activeSkillTree.nodes.length > 0) {
        layoutNodes(activeSkillTree.nodes);
    }


    activeSkillTree.nodes.forEach(node => {
      const skillInfo = node.skill; // Skill info is nested
      rfNodes.push({
        id: node.id, // Use SkillTreeNode id as reactflow node id
        data: {
            label: node.customName || skillInfo?.name || 'Unnamed Skill',
            skillData: skillInfo // Store full skill data for tooltips etc.
        },
        position: nodePositions[node.id] || { x: Math.random() * 400, y: Math.random() * 400 }, // Fallback position
        style: getNodeStyle(skillInfo),
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      if (node.parentId) {
        rfEdges.push({
          id: `e-${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a0aec0' },
          style: { stroke: '#a0aec0', strokeWidth: 2 },
        });
      }
    });

    setNodes(rfNodes);
    setEdges(rfEdges);
    setIsLoading(false); // Set loading false after processing
  }, [activeSkillTree]);


  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  if (isLoading) {
    return <div className="container mx-auto p-6 text-center flex items-center justify-center h-screen"><Loader2 className="mr-2 h-8 w-8 animate-spin"/>Loading Mindmap...</div>;
  }
  if (error) {
    return <div className="container mx-auto p-6 text-center text-red-500 flex flex-col items-center justify-center h-screen"><AlertTriangle className="w-12 h-12 mb-2" />Error: {error}</div>;
  }
  if (nodes.length === 0 && !isLoading) {
    return <div className="container mx-auto p-6 text-center text-muted-foreground flex flex-col items-center justify-center h-screen"><Brain className="w-12 h-12 mb-2 opacity-50"/>No skill tree data to display or the tree is empty.</div>;
  }

  return (
    <div className="w-full h-[calc(100vh-4rem)]" style={{ minHeight: '500px' }}> {/* Adjust height based on Navbar */}
      <TooltipProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          attributionPosition="bottom-left"
          className="bg-background dark:bg-gray-800" // Theming for ReactFlow background
        >
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
          <Background gap={16} color="hsl(var(--border))" />

          {/* Custom Node Type or render a div inside node data for tooltip trigger */}
          {/* React Flow's default nodes don't easily support complex tooltips directly.
              A common pattern is to create custom nodes. For MVP, tooltips are deferred if complex.
              However, if node `data.label` is a JSX element, it can include Tooltip.
              Let's try to wrap node labels with TooltipTrigger. This would require custom node rendering.
              For now, let's assume the default node rendering. Tooltips can be added by making custom nodes.
          */}
        </ReactFlow>
      </TooltipProvider>
       {/* Floating panel for tree info or selection */}
       {activeSkillTree && (
         <Card className="absolute top-20 left-4 z-10 w-72 shadow-xl">
            <CardHeader>
                <CardTitle className="text-md">{activeSkillTree.name}</CardTitle>
                {activeSkillTree.description && <CardDescription className="text-xs">{activeSkillTree.description}</CardDescription>}
            </CardHeader>
         </Card>
       )}
    </div>
  );
};

export default MindmapPage;

// Need to import toast for error display if not already global for the page
import toast from 'react-hot-toast';
