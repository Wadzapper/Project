'use client';

import { useEffect, useState, MouseEvent as ReactMouseEvent, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SkillTreeNodeDisplay from '@/components/skill-trees/SkillTreeNodeDisplay';
import SkillFormModal, { SkillFormData } from '@/components/skills/SkillFormModal';
import AddSkillNodeModal, { AddSkillNodeFormData } from '@/components/skill-trees/AddSkillNodeModal';
import ReparentNodeModal from '@/components/skill-trees/ReparentNodeModal';
import { Skill } from '@/app/skills/page';

// Types (assuming these are sufficient from previous definitions)
type SkillNodeSkillData = {
  id: string; name: string; currentLevel: number; currentXp: number;
  targetXpForNextLevel: number; description?: string | null;
};
type SkillTreeNodeData = {
  id: string; skillId: string; parentNodeId: string | null; positionX: number; positionY: number;
  metadata: any | null; skill: SkillNodeSkillData;
};
type SkillTreeEditData = {
  id: string; name: string; description: string | null; nodes: SkillTreeNodeData[];
};

export default function SkillTreeEditPage() {
  const params = useParams();
  const router = useRouter();
  const treeId = params.treeId as string;

  const [skillTree, setSkillTree] = useState<SkillTreeEditData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  // Modal States
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [selectedSkillForEdit, setSelectedSkillForEdit] = useState<SkillFormData | null>(null);
  const [isSubmittingSkill, setIsSubmittingSkill] = useState(false);
  const [skillFormError, setSkillFormError] = useState<string | null>(null);

  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [userSkills, setUserSkills] = useState<Skill[]>([]);
  const [isSubmittingNode, setIsSubmittingNode] = useState(false);
  const [addNodeFormError, setAddNodeFormError] = useState<string | null>(null);

  const [isReparentModalOpen, setIsReparentModalOpen] = useState(false);
  const [nodeToReparent, setNodeToReparent] = useState<{id: string, parentNodeId: string | null} | null>(null);
  const [isSubmittingReparent, setIsSubmittingReparent] = useState(false);
  const [reparentFormError, setReparentFormError] = useState<string | null>(null);

  // Pan & Zoom State
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null); // For pan event listener on background

  // Data Fetching (same as before)
  const fetchSkillTreeData = async () => { /* ... (implementation as before) ... */
    setIsLoading(true); setError(null);
    try {
      const response = await fetch(`/api/skill-trees/${treeId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Skill Tree not found or access denied.');
        throw new Error('Failed to fetch skill tree data.');
      }
      const data = await response.json();
      setSkillTree(data);
    } catch (err: any) { setError(err.message); console.error(err); }
    finally { setIsLoading(false); }
  };
  const fetchUserSkills = async () => { /* ... (implementation as before) ... */
    try {
      const response = await fetch('/api/skills');
      if (!response.ok) throw new Error('Failed to fetch user skills');
      const data = await response.json();
      setUserSkills(data);
    } catch (error) {
      console.error("Failed to load user skills:", error);
      setPageMessage({type: 'error', text: 'Could not load your skills.'});
    }
  };
  useEffect(() => { if (treeId) { fetchSkillTreeData(); fetchUserSkills(); } }, [treeId]);

  // Modal Handlers (Skill Edit, Add Node, Reparent Node - same as before)
  const handleEditSkillNode = (skillId: string) => { /* ... */
    const fullSkill = userSkills.find(s => s.id === skillId);
    if (fullSkill) {
      setSelectedSkillForEdit({
        id: fullSkill.id, name: fullSkill.name, description: fullSkill.description || '',
        currentLevel: fullSkill.currentLevel, currentXp: fullSkill.currentXp,
        targetXpForNextLevel: fullSkill.targetXpForNextLevel,
      });
    } else {
      const nodeSkillData = skillTree?.nodes.find(n => n.skill.id === skillId)?.skill;
      if(nodeSkillData){
        setSelectedSkillForEdit({
            id: nodeSkillData.id, name: nodeSkillData.name, description: nodeSkillData.description || '',
            currentLevel: nodeSkillData.currentLevel, currentXp: nodeSkillData.currentXp ?? 0,
            targetXpForNextLevel: nodeSkillData.targetXpForNextLevel ?? 100,
        });
      } else {setPageMessage({type: 'error', text: 'Skill details not found.'}); return;}
    }
    setSkillFormError(null); setIsSkillModalOpen(true);
  };
  const handleCloseSkillModal = () => { /* ... */ setIsSkillModalOpen(false); setSelectedSkillForEdit(null); setSkillFormError(null); };
  const handleSubmitEditedSkill = async (data: SkillFormData) => { /* ... */
    if (!data.id) { setSkillFormError("Skill ID missing."); return; }
    setIsSubmittingSkill(true); setSkillFormError(null);
    try {
      const res = await fetch(`/api/skills/${data.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Update failed'); }
      handleCloseSkillModal(); await fetchUserSkills(); await fetchSkillTreeData(); router.refresh();
      setPageMessage({ type: 'success', text: 'Skill updated!' });
    } catch (e: any) { setSkillFormError(e.message); } finally { setIsSubmittingSkill(false); }
  };
  const handleOpenAddSkillNodeModal = () => { /* ... */
    if (userSkills.length === 0) { setPageMessage({ type: 'error', text: 'No skills to add.' }); fetchUserSkills(); return; }
    setAddNodeFormError(null); setIsAddNodeModalOpen(true);
  };
  const handleCloseAddNodeModal = () => { /* ... */ setIsAddNodeModalOpen(false); setAddNodeFormError(null); };
  const handleSubmitNewNode = async (data: AddSkillNodeFormData) => { /* ... */
    setIsSubmittingNode(true); setAddNodeFormError(null); setPageMessage(null);
    try {
      const res = await fetch(`/api/skill-trees/${treeId}/nodes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Add node failed'); }
      handleCloseAddNodeModal(); fetchSkillTreeData(); router.refresh();
      setPageMessage({ type: 'success', text: 'Node added!' });
    } catch (e: any) { setAddNodeFormError(e.message); } finally { setIsSubmittingNode(false); }
  };
  const handleRemoveNode = async (nodeId: string) => { /* ... */
    setPageMessage(null);
    if (window.confirm('Remove node?')) {
      try {
        const res = await fetch(`/api/skill-trees/${treeId}/nodes/${nodeId}`, { method: 'DELETE' });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Remove failed'); }
        setPageMessage({ type: 'success', text: 'Node removed.' });
        fetchSkillTreeData(); router.refresh();
      } catch (e: any) { setPageMessage({ type: 'error', text: e.message }); }
    }
  };
  const handleOpenReparentModal = (nodeId: string, parentId: string | null) => { /* ... */ setNodeToReparent({ id: nodeId, parentNodeId: parentId }); setReparentFormError(null); setIsReparentModalOpen(true); };
  const handleCloseReparentModal = () => { /* ... */ setIsReparentModalOpen(false); setNodeToReparent(null); setReparentFormError(null); };
  const handleSubmitReparentNode = async (newParentId: string | null) => { /* ... */
    if (!nodeToReparent) return;
    setIsSubmittingReparent(true); setReparentFormError(null); setPageMessage(null);
    try {
      const res = await fetch(`/api/skill-trees/${treeId}/nodes/${nodeToReparent.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentNodeId: newParentId }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Reparent failed'); }
      handleCloseReparentModal(); fetchSkillTreeData(); router.refresh();
      setPageMessage({ type: 'success', text: 'Node reparented!' });
    } catch (e: any) { setReparentFormError(e.message); } finally { setIsSubmittingReparent(false); }
  };
  const handleUpdateNodePosition = async (nodeId: string, x: number, y: number) => { /* ... */
    setPageMessage(null);
    try {
      const response = await fetch(`/api/skill-trees/${treeId}/nodes/${nodeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positionX: x, positionY: y }),
      });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Failed to update position');}
      fetchSkillTreeData();
      setPageMessage({ type: 'success', text: 'Position updated!' });
    } catch (error: any) { setPageMessage({ type: 'error', text: `Pos Error: ${error.message}` });}
  };

  // Pan Handlers
  const handlePanMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) return; // Pan only if background is clicked
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };
  const handlePanMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const handlePanMouseUpOrLeave = () => { setIsPanning(false); };

  // Zoom Handlers
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2)); // Max zoom 2x
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5)); // Min zoom 0.5x


  // Render logic (same as before, but with pan/zoom wrapper and controls)
  if (isLoading) return <div className="container p-8 mx-auto text-center">Loading...</div>;
  if (error) return <div className="container p-8 mx-auto text-center text-red-500">Error: {error} <button onClick={() => router.push('/skill-trees')} className="mt-4 btn-primary">Back</button></div>;
  if (!skillTree) return <div className="container p-8 mx-auto text-center">No skill tree data.</div>;

  return (
    <div className="container p-8 mx-auto">
      <div className="flex items-center justify-between mb-4"> {/* Reduced mb */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{skillTree.name}</h1>
          {skillTree.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{skillTree.description}</p>}
        </div>
        <div className="flex items-center gap-2">
            <button onClick={handleZoomOut} className="px-3 py-1 text-sm btn-secondary">-</button>
            <span className="text-sm text-gray-700 dark:text-gray-300">{(zoomLevel * 100).toFixed(0)}%</span>
            <button onClick={handleZoomIn} className="px-3 py-1 text-sm btn-secondary">+</button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Save Layout (TODO)</button>
        </div>
      </div>

      {pageMessage && <div className={`p-4 mb-4 text-sm rounded-lg ${pageMessage.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'}`} role="alert">{pageMessage.text}</div>}

      <div
        ref={canvasRef}
        className="relative w-full min-h-[600px] p-4 bg-gray-100 border border-gray-300 rounded-lg shadow-inner dark:bg-gray-800 dark:border-gray-700 overflow-hidden cursor-grab"
        onMouseDown={handlePanMouseDown}
        onMouseMove={handlePanMouseMove}
        onMouseUp={handlePanMouseUpOrLeave}
        onMouseLeave={handlePanMouseUpOrLeave} // Stop panning if mouse leaves canvas
      >
        <div
            className="relative w-full h-full"
            style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: '0 0'
            }}
        >
            {/* Content to be panned and zoomed */}
            <h2 className="absolute mb-4 text-xl font-semibold text-transparent pointer-events-none -top-full -left-full">Tree Editor Canvas (Hidden Header for Pan Area)</h2>
            {skillTree.nodes.length === 0 ? (
            <p className="text-center text-gray-500">Tree is empty. Add skills!</p>
            ) : (
            <>
                {skillTree.nodes.map(node => (
                <SkillTreeNodeDisplay
                    key={node.id} node={node}
                    onEditSkill={handleEditSkillNode} onRemoveNode={handleRemoveNode}
                    onReparentNode={handleOpenReparentModal} onUpdateNodePosition={handleUpdateNodePosition}
                />
                ))}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{left:0, top:0}}> {/* SVG should also be inside the transform wrapper */}
                <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" /></marker></defs>
                {skillTree.nodes.filter(n => n.parentNodeId).map(n => {
                    const p = skillTree.nodes.find(px => px.id === n.parentNodeId);
                    if (!p) return null;
                    const nodeWidth = 180, nodeHeight = 100;
                    const sX = p.positionX + nodeWidth / 2, sY = p.positionY + nodeHeight;
                    const eX = n.positionX + nodeWidth / 2, eY = n.positionY;
                    return <line key={`l-${p.id}-${n.id}`} x1={sX} y1={sY} x2={eX} y2={eY} stroke="#9ca3af" strokeWidth="2" markerEnd="url(#arrowhead)" />;
                })}
                </svg>
            </>
            )}
        </div>
        <button onClick={handleOpenAddSkillNodeModal} className="absolute px-3 py-1 text-sm text-white bg-indigo-500 rounded-md bottom-4 right-4 hover:bg-indigo-600 z-10">
          + Add Skill Node
        </button>
      </div>

      {/* Modals */}
      {isSkillModalOpen && selectedSkillForEdit && ( <SkillFormModal isOpen={isSkillModalOpen} onClose={handleCloseSkillModal} onSubmit={handleSubmitEditedSkill} initialData={selectedSkillForEdit} mode="edit" isLoading={isSubmittingSkill} error={skillFormError}/> )}
      <AddSkillNodeModal isOpen={isAddNodeModalOpen} onClose={handleCloseAddNodeModal} onSubmit={handleSubmitNewNode} existingSkills={userSkills} existingTreeNodes={skillTree?.nodes.map(n => ({id: n.id, skill: {name: n.skill.name, currentLevel: n.skill.currentLevel, currentXp: n.skill.currentXp, targetXpForNextLevel: n.skill.targetXpForNextLevel, id: n.skill.id }})) || []} isLoading={isSubmittingNode} error={addNodeFormError}/>
      {isReparentModalOpen && nodeToReparent && ( <ReparentNodeModal isOpen={isReparentModalOpen} onClose={handleCloseReparentModal} onSubmit={handleSubmitReparentNode} currentNodeId={nodeToReparent.id} existingTreeNodes={skillTree?.nodes.map(n => ({id: n.id, skill: {name: n.skill.name, currentLevel: n.skill.currentLevel, currentXp: n.skill.currentXp, targetXpForNextLevel: n.skill.targetXpForNextLevel, id: n.skill.id }})) || []} currentParentNodeId={nodeToReparent.parentNodeId} isLoading={isSubmittingReparent} error={reparentFormError} /> )}

      {/* Debug Data */}
      <div className="mt-8"><h3 className="text-lg font-semibold">Raw Tree Data (Debug):</h3><pre className="p-4 mt-2 text-xs bg-gray-100 rounded dark:bg-gray-800 overflow-x-auto">{JSON.stringify(skillTree, null, 2)}</pre></div>
    </div>
  );
}
