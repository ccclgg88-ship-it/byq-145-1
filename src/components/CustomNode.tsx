import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAppStore } from '../store';
import { Department, DepartmentStatus } from '../types';

interface CustomNodeData {
  department: Department;
  employeeCount: number;
  managerName: string | null;
  hasConflict: boolean;
}

const statusConfig: Record<DepartmentStatus, { label: string; className: string }> = {
  normal: { label: '正常', className: 'status-normal' },
  preparing: { label: '筹备中', className: 'status-preparing' },
  revoked: { label: '已撤销', className: 'status-revoked' },
};

const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected }) => {
  const { department, employeeCount, managerName, hasConflict } = data;
  const { conflicts } = useAppStore();
  
  const nodeClasses = [
    'org-node',
    selected ? 'selected' : '',
    hasConflict ? 'conflict' : '',
    department.status === 'revoked' ? 'revoked' : '',
  ].filter(Boolean).join(' ');

  const status = statusConfig[department.status];

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: department.status === 'revoked' ? '#bfbfbf' : '#1890ff' }}
      />
      <div className={nodeClasses}>
        <div className="org-node-header">
          <span className="org-node-title">{department.name}</span>
          <span className="org-node-code">{department.code}</span>
        </div>
        <div className="org-node-info">
          <div className="org-node-info-row">
            <span>负责人：</span>
            <span>{managerName || '未指定'}</span>
          </div>
          <div className="org-node-info-row">
            <span>在职人数：</span>
            <span>{employeeCount} 人</span>
          </div>
        </div>
        <span className={`org-node-status ${status.className}`}>
          {status.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: department.status === 'revoked' ? '#bfbfbf' : '#1890ff' }}
      />
    </>
  );
};

export default CustomNode;
