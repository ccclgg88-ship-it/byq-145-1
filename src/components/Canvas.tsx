import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge,
  Connection,
  useReactFlow,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '../store';
import CustomNode from './CustomNode';
import EmployeeModal from './EmployeeModal';

const nodeTypes = {
  custom: CustomNode,
};

interface CanvasInnerProps {
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
}

const CanvasInner: React.FC<CanvasInnerProps> = ({ reactFlowWrapper }) => {
  const {
    departments,
    edges: storeEdges,
    employees,
    conflicts,
    selectedNodeId,
    setSelectedNode,
    setSelectedEdge,
    addEdge: addStoreEdge,
    deleteEdge,
    moveDepartment,
    viewport,
    setViewport,
  } = useAppStore();

  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [employeeModalDeptId, setEmployeeModalDeptId] = useState<string | null>(null);

  const conflictDeptIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach(c => c.departmentIds.forEach(id => ids.add(id)));
    return ids;
  }, [conflicts]);

  const rfNodes = useMemo<Node[]>(() => {
    return departments.map(dept => {
      const deptEmployees = employees.filter(e => e.departmentId === dept.id);
      const manager = employees.find(e => e.id === dept.managerId);
      
      return {
        id: dept.id,
        type: 'custom',
        position: dept.position,
        data: {
          department: dept,
          employeeCount: deptEmployees.length,
          managerName: manager?.name || null,
          hasConflict: conflictDeptIds.has(dept.id),
        },
      };
    });
  }, [departments, employees, conflictDeptIds]);

  const rfEdges = useMemo<Edge[]>(() => {
    return storeEdges.map(edge => {
      const hasConflict = conflicts.some(c => c.type === 'cycle');
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: true,
        className: hasConflict ? 'conflict-edge' : '',
      };
    });
  }, [storeEdges, conflicts]);

  useEffect(() => {
    setNodes(rfNodes);
  }, [rfNodes, setNodes]);

  useEffect(() => {
    setEdges(rfEdges);
  }, [rfEdges, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        const success = addStoreEdge(params.source, params.target);
        if (success) {
          setEdges((eds) => addEdge(params, eds));
        }
      }
    },
    [addStoreEdge, setEdges]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      moveDepartment(node.id, node.position);
    },
    [moveDepartment]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setEmployeeModalDeptId(node.id);
    },
    []
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge.id);
    },
    [setSelectedEdge]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [setSelectedNode, setSelectedEdge]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const deptData = JSON.parse(type);
      useAppStore.getState().addDepartment({
        ...deptData,
        position,
      });
    },
    [reactFlowInstance]
  );

  const { selectedEdgeId } = useAppStore();

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (selectedEdgeId && event.key === 'Delete') {
        deleteEdge(selectedEdgeId);
        setSelectedEdge(null);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        useAppStore.getState().undo();
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        useAppStore.getState().redo();
      }
    },
    [selectedEdgeId, deleteEdge, setSelectedEdge]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const onMoveEnd = useCallback(
    (_: any, viewport: any) => {
      setViewport(viewport);
    },
    [setViewport]
  );

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultViewport={viewport}
        selectionOnDrag
        panOnDrag={false}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeColor={(n) => {
            if (n.selected) return '#1890ff';
            return '#ddd';
          }}
          nodeColor={(n) => {
            const data = n.data as any;
            if (data?.hasConflict) return '#ff4d4f';
            if (data?.department?.status === 'revoked') return '#bfbfbf';
            return '#fff';
          }}
          pannable
          zoomable
        />
      </ReactFlow>
      {employeeModalDeptId && (
        <EmployeeModal
          departmentId={employeeModalDeptId}
          open={true}
          onClose={() => setEmployeeModalDeptId(null)}
        />
      )}
    </div>
  );
};

const Canvas: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  return (
    <ReactFlowProvider>
      <CanvasInner reactFlowWrapper={reactFlowWrapper} />
    </ReactFlowProvider>
  );
};

export default Canvas;
