import React from 'react';
import { Card, List, Tag, Button, Badge, Space } from 'antd';
import {
  WarningOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store';
import { Conflict } from '../types';

const conflictTypeConfig: Record<Conflict['type'], { label: string; icon: React.ReactNode }> = {
  duplicate_code: { label: '重复编码', icon: <CloseCircleOutlined /> },
  isolated_node: { label: '孤立节点', icon: <ExclamationCircleOutlined /> },
  cycle: { label: '循环汇报', icon: <CloseCircleOutlined /> },
  invalid_manager: { label: '负责人异常', icon: <ExclamationCircleOutlined /> },
};

const ConflictPanel: React.FC = () => {
  const { conflicts, departments, setSelectedNode } = useAppStore();

  const handleLocate = (deptIds: string[]) => {
    if (deptIds.length > 0) {
      setSelectedNode(deptIds[0]);
    }
  };

  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');

  return (
    <Card
      size="small"
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          <span>冲突检测</span>
          {conflicts.length > 0 && (
            <Badge count={conflicts.length} size="small" />
          )}
        </Space>
      }
      style={{ margin: 16 }}
    >
      {conflicts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#52c41a' }}>
          <CheckCircleOutlined style={{ fontSize: 32, marginBottom: 8 }} />
          <div>未检测到冲突</div>
        </div>
      ) : (
        <List
          size="small"
          dataSource={conflicts}
          renderItem={(conflict) => {
            const config = conflictTypeConfig[conflict.type];
            const deptNames = conflict.departmentIds
              .map(id => departments.find(d => d.id === id)?.name || id)
              .join('、');

            return (
              <List.Item
                style={{
                  padding: '12px 8px',
                  borderBottom: '1px solid #f0f0f0',
                  background: conflict.severity === 'error' ? '#fff1f0' : '#fffbe6',
                  marginBottom: 8,
                  borderRadius: 4,
                }}
                actions={[
                  <Button
                    type="link"
                    size="small"
                    icon={<EnvironmentOutlined />}
                    onClick={() => handleLocate(conflict.departmentIds)}
                  >
                    定位
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Tag
                      color={conflict.severity === 'error' ? 'red' : 'orange'}
                      icon={config.icon}
                    >
                      {config.label}
                    </Tag>
                  }
                  title={
                    <Space>
                      <Tag color={conflict.severity === 'error' ? 'red' : 'warning'}>
                        {conflict.severity === 'error' ? '错误' : '警告'}
                      </Tag>
                      <span style={{ fontSize: 13 }}>{conflict.message}</span>
                    </Space>
                  }
                  description={
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                      涉及部门：{deptNames}
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}

      {conflicts.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center' }}>
          <Space size="middle">
            <span>
              <Tag color="red">错误: {errors.length}</Tag>
            </span>
            <span>
              <Tag color="orange">警告: {warnings.length}</Tag>
            </span>
          </Space>
        </div>
      )}
    </Card>
  );
};

export default ConflictPanel;
