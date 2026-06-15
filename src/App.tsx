import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { Layout, Space, Modal, Button } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { useAppStore } from './store';
import { mockDepartments, mockEmployees } from './data/mockData';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import DepartmentPanel from './components/DepartmentPanel';
import PropertyPanel from './components/PropertyPanel';
import ConflictPanel from './components/ConflictPanel';

const { Sider, Content } = Layout;

const App: React.FC = () => {
  const {
    departments,
    employees,
    hasUnsavedChanges,
    importData,
    detectConflicts,
  } = useAppStore();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showConflict, setShowConflict] = useState(true);

  useEffect(() => {
    if (!initialized) {
      importData({
        departments: mockDepartments,
        employees: mockEmployees,
      });
      detectConflicts();
      setInitialized(true);
    }
  }, [initialized, importData, detectConflicts]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          const flowElement = document.querySelector('.react-flow') as HTMLElement;
          if (flowElement) {
            flowElement.style.cursor = 'grab';
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const flowElement = document.querySelector('.react-flow') as HTMLElement;
        if (flowElement) {
          flowElement.style.cursor = 'default';
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (e: Event) => {
      const wheelEvent = e as WheelEvent;
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        wheelEvent.preventDefault();
      }
    };

    const flowWrapper = document.querySelector('.react-flow');
    if (flowWrapper) {
      flowWrapper.addEventListener('wheel', handleWheel as EventListener, { passive: false });
      return () => flowWrapper.removeEventListener('wheel', handleWheel as EventListener);
    }
  }, [initialized]);

  const stats = useMemo(() => ({
    totalDepts: departments.length,
    totalEmps: employees.length,
    normalDepts: departments.filter(d => d.status === 'normal').length,
    unassignedEmps: employees.filter(e => e.departmentId === null).length,
  }), [departments, employees]);

  return (
    <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
      <Toolbar />
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        <Sider
          width={280}
          collapsible
          collapsed={leftCollapsed}
          onCollapse={setLeftCollapsed}
          style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
          trigger={null}
          collapsedWidth={0}
        >
          <div style={{ position: 'relative', height: '100%' }}>
            {!leftCollapsed && <DepartmentPanel />}
            <Button
              type="text"
              icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              style={{
                position: 'absolute',
                top: 8,
                right: leftCollapsed ? -32 : 8,
                zIndex: 100,
                background: '#fff',
                border: '1px solid #f0f0f0',
              }}
            />
          </div>
        </Sider>

        <Content style={{ position: 'relative', overflow: 'hidden' }}>
          <Canvas />
          
          {showConflict && (
            <div style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              right: leftCollapsed ? 16 : 312,
              maxHeight: '40%',
              overflow: 'auto',
              zIndex: 100,
            }}>
              <ConflictPanel />
            </div>
          )}

          <div style={{
            position: 'absolute',
            left: 16,
            top: 16,
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '8px 16px',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            fontSize: 12,
            zIndex: 100,
          }}>
            <Space size="middle">
              <span>部门: {stats.totalDepts}</span>
              <span>员工: {stats.totalEmps}</span>
              <span>未分配: {stats.unassignedEmps}</span>
            </Space>
          </div>

          <div style={{
            position: 'absolute',
            right: rightCollapsed ? 16 : 312,
            bottom: 16,
            background: 'rgba(255, 255, 255, 0.9)',
            padding: 8,
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            fontSize: 11,
            color: '#8c8c8c',
            zIndex: 100,
          }}>
            <div>Ctrl+滚轮: 缩放</div>
            <div>空格+拖拽: 平移</div>
            <div>双击节点: 员工管理</div>
          </div>

          <Button
            type="text"
            icon={<ZoomOutOutlined />}
            onClick={() => setShowConflict(!showConflict)}
            style={{
              position: 'absolute',
              left: 16,
              bottom: showConflict ? 'calc(40% + 24px)' : 16,
              background: '#fff',
              border: '1px solid #f0f0f0',
              zIndex: 100,
            }}
          >
            {showConflict ? '隐藏冲突' : '显示冲突'}
          </Button>
        </Content>

        <Sider
          width={300}
          collapsible
          collapsed={rightCollapsed}
          onCollapse={setRightCollapsed}
          style={{ background: '#fff', borderLeft: '1px solid #f0f0f0' }}
          trigger={null}
          collapsedWidth={0}
        >
          <div style={{ position: 'relative', height: '100%' }}>
            {!rightCollapsed && <PropertyPanel />}
            <Button
              type="text"
              icon={rightCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setRightCollapsed(!rightCollapsed)}
              style={{
                position: 'absolute',
                top: 8,
                left: rightCollapsed ? -32 : 8,
                zIndex: 100,
                background: '#fff',
                border: '1px solid #f0f0f0',
              }}
            />
          </div>
        </Sider>
      </Layout>
    </Layout>
  );
};

export default App;
