'use client';

import { useState, useEffect } from 'react';

// Assuming types are defined or imported from a shared location
import ProgressBar from '@/components/ui/ProgressBar'; // Import ProgressBar

type SkillNodeSkill = {
  id: string;
  name: string;
  currentLevel: number;
  currentXp: number; // Added for progress bar
  targetXpForNextLevel: number; // Added for progress bar
};

export type SkillTreeNodeDataForDisplay = {
  id: string; // Node ID
  skillId: string;
  parentNodeId: string | null;
  positionX: number;
  positionY: number;
  skill: SkillNodeSkill;
};

interface SkillTreeNodeDisplayProps {
  node: SkillTreeNodeDataForDisplay;
  onEditSkill: (skillId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onReparentNode: (nodeId: string, currentParentId: string | null) => void;
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => Promise<void>;
}

import { getSkillColorClass } from '@/lib/skillUtils';


export default function SkillTreeNodeDisplay({
  node,
  onEditSkill,
  onRemoveNode,
  onReparentNode,
  onUpdateNodePosition,
}: SkillTreeNodeDisplayProps) {
  const [isEditingPosition, setIsEditingPosition] = useState(false);
  const [currentX, setCurrentX] = useState(node.positionX);
  const [currentY, setCurrentY] = useState(node.positionY);
  const [isSavingPosition, setIsSavingPosition] = useState(false);

  useEffect(() => {
    setCurrentX(node.positionX);
    setCurrentY(node.positionY);
  }, [node.positionX, node.positionY]);

  const colorClass = getSkillColorClass(node.skill.currentLevel);

  const handlePositionSave = async () => {
    setIsSavingPosition(true);
    try {
      await onUpdateNodePosition(node.id, currentX, currentY);
      setIsEditingPosition(false);
    } catch (error) {
      console.error("Failed to save position:", error);
      // TODO: Show an error message to the user on the node itself or via page message
    } finally {
      setIsSavingPosition(false);
    }
  };

  return (
    <div
      className={`absolute p-3 border rounded-lg shadow-lg text-white dark:text-gray-100 ${colorClass} transition-all duration-150 ease-in-out hover:shadow-xl transform hover:-translate-y-1 group`}
      style={{
        left: `${node.positionX}px`,
        top: `${node.positionY}px`,
        width: '180px',
        minHeight: '130px', // Adjusted height for position inputs
        cursor: 'grab'
      }}
    >
      <h3 className="mb-1 text-sm font-bold truncate">{node.skill.name}</h3>
      <p className="mb-1 text-xs opacity-90">
        Level: {node.skill.currentLevel}
      </p>
      <div className="mb-2">
        <ProgressBar
          currentValue={node.skill.currentXp}
          maxValue={node.skill.targetXpForNextLevel}
          heightClass="h-1.5"
        />
      </div>

      {isEditingPosition ? (
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-1 text-xs">
            <label htmlFor={`node-x-${node.id}`} className="text-black dark:text-white">X:</label>
            <input id={`node-x-${node.id}`} type="number" value={currentX} onChange={(e) => setCurrentX(parseInt(e.target.value))} className="w-12 p-0.5 text-xs text-black border rounded dark:bg-gray-800 dark:text-white" />
            <label htmlFor={`node-y-${node.id}`} className="ml-1 text-black dark:text-white">Y:</label>
            <input id={`node-y-${node.id}`} type="number" value={currentY} onChange={(e) => setCurrentY(parseInt(e.target.value))} className="w-12 p-0.5 text-xs text-black border rounded dark:bg-gray-800 dark:text-white" />
          </div>
          <div className="flex items-center gap-1 mt-1">
            <button onClick={handlePositionSave} disabled={isSavingPosition} className="px-1 py-0.5 text-xs text-white bg-green-500 rounded hover:bg-green-600 disabled:bg-gray-400">
              {isSavingPosition ? '...' : 'Save'}
            </button>
            <button onClick={() => { setIsEditingPosition(false); setCurrentX(node.positionX); setCurrentY(node.positionY);}} className="px-1 py-0.5 text-xs text-gray-700 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">
              Cancel
            </button>
          </div>
        </div>
      ) : (
         <p className="text-xs opacity-70 cursor-pointer hover:opacity-100" onClick={() => setIsEditingPosition(true)} title="Click to edit position">Pos: {node.positionX}, {node.positionY}</p>
      )}

      {/* Action buttons - visible on hover of the main card */}
      <div className="absolute flex items-center gap-1 opacity-0 bottom-1 right-1 group-hover:opacity-100 transition-opacity">
        {!isEditingPosition && (
            <button onClick={(e) => { e.stopPropagation(); setIsEditingPosition(true);}} className="p-1 text-xs text-white bg-black rounded bg-opacity-20 hover:bg-opacity-40" title="Edit Position">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10 2.5a.75.75 0 00-.75.75v2.502a29.359 29.359 0 00-6.098.433.75.75 0 00-.454 1.224l3.197 3.197a.75.75 0 001.06 0l1.25-1.25a.75.75 0 011.06 0l1.25 1.25a.75.75 0 001.06 0l3.197-3.197a.75.75 0 00-.454-1.224A29.359 29.359 0 0010.75 5.752V3.25a.75.75 0 00-.75-.75zm0 15a.75.75 0 00.75-.75v-2.502a29.359 29.359 0 006.098-.433.75.75 0 00.454-1.224l-3.197-3.197a.75.75 0 00-1.06 0l-1.25 1.25a.75.75 0 01-1.06 0l-1.25-1.25a.75.75 0 00-1.06 0l-3.197 3.197a.75.75 0 00.454 1.224A29.359 29.359 0 009.25 14.248v2.502a.75.75 0 00.75.75z" clipRule="evenodd" /></svg>
            </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEditSkill(node.skill.id); }}
          className="p-1 text-xs text-white bg-black rounded bg-opacity-20 hover:bg-opacity-40"
          title="Edit Skill Details"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
        </button>
         <button
          onClick={(e) => { e.stopPropagation(); onReparentNode(node.id, node.parentNodeId); }}
          className="p-1 text-xs text-white bg-black rounded bg-opacity-20 hover:bg-opacity-40"
          title="Change Parent"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M12.207 2.232a.75.75 0 00-1.06-.02L6.354 7.005a.75.75 0 00-.22.53V10.5a.75.75 0 00.75.75h2.965a.75.75 0 00.53-.22l4.793-4.793a.75.75 0 00-.02-1.06zM3.75 9h.008v.008H3.75V9zm1.508 0h.008v.008h-.008V9zm1.5 0h.008v.008h-.008V9z" clipRule="evenodd" /><path d="M3 10.875A2.875 2.875 0 00.125 13.75v2.375c0 .985.805 1.875 2 1.875h13.75A2.875 2.875 0 0019.875 15V9A2.875 2.875 0 0017 6.125H9.862L6.98 9.005A2.875 2.875 0 006.125 13h-2.5A2.875 2.875 0 003 10.875zM7.625 13a1.375 1.375 0 100-2.75 1.375 1.375 0 000 2.75z" /></svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveNode(node.id); }}
          className="p-1 text-xs text-white bg-black rounded bg-opacity-20 hover:bg-opacity-40"
          title="Remove Node from Tree"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25V4.075c.827-.05 1.66-.075 2.5-.075zM8.47 9.47a.75.75 0 011.06 0l.82.82a.75.75 0 11-1.06 1.06l-.82-.82a.75.75 0 010-1.06zm3.56 0a.75.75 0 00-1.06 0l-.82.82a.75.75 0 101.06 1.06l.82-.82a.75.75 0 000-1.06z" clipRule="evenodd" /></svg>
        </button>
      </div>
    </div>
  );
}
