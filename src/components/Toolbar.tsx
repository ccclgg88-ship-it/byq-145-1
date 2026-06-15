import React, { useState, useRef } from 'react';
import {
  Button,
  Space,
  Dropdown,
  MenuProps,
  Upload,
  message,
  Modal,
  List,
  Tag,
  Divider,
  Badge,
} from 'antd';
import {
  UndoOutlined,
  RedoOutlined,
  SaveOutlined,
  DownloadOutlined,
  UploadOutlined,
  CameraOutlined,
  HistoryOutlined,
  SafetyOutlined,
  PictureOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import { Department, Employee, ImportPreview } from '../types';

const Toolbar: React.FC = () => {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    hasUnsavedChanges,
    saveSnapshot,
    snapshots,
    restoreSnapshot,
    deleteSnapshot,
    validateAll,
    exportData,
    importData,
    markAsSaved,
    departments,
    employees,
    detectConflicts,
  } = useAppStore();

  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [importPreviewModal, setImportPreviewModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [pendingImportData, setPendingImportData] = useState<{ departments: Department[]; employees: Employee[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportPNG = async () => {
    const canvasElement = document.querySelector('.react-flow') as HTMLElement;
    if (!canvasElement) {
      message.error('画布未就绪');
      return;
    }

    try {
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: '#f5f5f5',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `组织架构_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      message.success('PNG 导出成功');
    } catch (error) {
      message.error('PNG 导出失败');
    }
  };

  const handleExportJSON = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `组织架构_${new Date().toISOString().split('T')[0]}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    message.success('JSON 导出成功');
  };

  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.departments || !data.employees) {
          throw new Error('文件格式错误');
        }
        previewImport(data);
      } catch (error) {
        message.error('JSON 文件解析失败');
      }
    };
    reader.readAsText(file);
    return false;
  };

  const handleImportCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        try {
          const deptRows = results.data.filter((row: any) => row.code && row.name);
          const empRows = results.data.filter((row: any) => row.employeeId && row.name);

          const importedDepts: Department[] = deptRows.map((row: any) => ({
            id: row.id || `dept_${row.code}`,
            code: row.code,
            name: row.name,
            parentId: row.parentId || null,
            managerId: row.managerId || null,
            status: (row.status as any) || 'normal',
            description: row.description || '',
            position: {
              x: parseFloat(row.x) || 100,
              y: parseFloat(row.y) || 100,
            },
          }));

          const importedEmps: Employee[] = empRows.map((row: any) => ({
            id: row.id || `emp_${row.employeeId}`,
            employeeId: row.employeeId,
            name: row.name,
            departmentId: row.departmentId || null,
            position: row.position || '',
            phone: row.phone || '',
            email: row.email || '',
          }));

          previewImport({ departments: importedDepts, employees: importedEmps });
        } catch (error) {
          message.error('CSV 文件解析失败');
        }
      },
    });
    return false;
  };

  const previewImport = (data: { departments: Department[]; employees: Employee[] }) => {
    const preview: ImportPreview = {
      added: [],
      modified: [],
      deleted: [],
      addedEmployees: [],
      modifiedEmployees: [],
      deletedEmployees: [],
    };

    const existingDeptIds = new Set(departments.map(d => d.id));
    const existingDeptCodes = new Map(departments.map(d => [d.code, d.id]));
    const importedDeptIds = new Set(data.departments.map(d => d.id));

    data.departments.forEach(dept => {
      if (!existingDeptIds.has(dept.id) && !existingDeptCodes.has(dept.code)) {
        preview.added.push(dept);
      } else {
        preview.modified.push(dept);
      }
    });

    departments.forEach(dept => {
      if (!importedDeptIds.has(dept.id)) {
        preview.deleted.push(dept.id);
      }
    });

    const existingEmpIds = new Set(employees.map(e => e.id));
    const existingEmpCodes = new Map(employees.map(e => [e.employeeId, e.id]));
    const importedEmpIds = new Set(data.employees.map(e => e.id));

    data.employees.forEach(emp => {
      if (!existingEmpIds.has(emp.id) && !existingEmpCodes.has(emp.employeeId)) {
        preview.addedEmployees.push(emp);
      } else {
        preview.modifiedEmployees.push(emp);
      }
    });

    employees.forEach(emp => {
      if (!importedEmpIds.has(emp.id)) {
        preview.deletedEmployees.push(emp.id);
      }
    });

    setImportPreview(preview);
    setPendingImportData(data);
    setImportPreviewModal(true);
  };

  const confirmImport = () => {
    if (pendingImportData) {
      importData(pendingImportData);
      message.success('导入成功');
      setImportPreviewModal(false);
      setPendingImportData(null);
      setImportPreview(null);
    }
  };

  const handleValidate = () => {
    const { valid, conflicts } = validateAll();
    detectConflicts();
    if (valid) {
      message.success(`校验通过，${conflicts.length} 个警告`);
    } else {
      const errors = conflicts.filter(c => c.severity === 'error');
      message.error(`校验不通过，存在 ${errors.length} 个错误`);
    }
  };

  const handleSave = () => {
    markAsSaved();
    message.success('已保存');
  };

  const handleRestoreSnapshot = (id: string, name: string) => {
    Modal.confirm({
      title: '恢复快照',
      content: `确定要恢复到「${name}」吗？当前未保存的变更将丢失。`,
      okText: '恢复',
      cancelText: '取消',
      onOk: () => {
        restoreSnapshot(id);
        message.success('快照已恢复');
      },
    });
  };

  const exportMenu: MenuProps = {
    items: [
      {
        key: 'png',
        label: '导出为 PNG',
        icon: <PictureOutlined />,
        onClick: handleExportPNG,
      },
      {
        key: 'json',
        label: '导出为 JSON',
        icon: <FileDoneOutlined />,
        onClick: handleExportJSON,
      },
    ],
  };

  const importMenu: MenuProps = {
    items: [
      {
        key: 'json',
        label: (
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={handleImportJSON}
          >
            <div style={{ padding: '4px 0' }}>
              <FileDoneOutlined style={{ marginRight: 8 }} />
              导入 JSON
            </div>
          </Upload>
        ),
      },
      {
        key: 'csv',
        label: (
          <Upload
            accept=".csv"
            showUploadList={false}
            beforeUpload={handleImportCSV}
          >
            <div style={{ padding: '4px 0' }}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              导入 CSV
            </div>
          </Upload>
        ),
      },
    ],
  };

  return (
    <div style={{
      padding: '8px 16px',
      background: '#fff',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <Space size="middle">
        <span style={{ fontWeight: 600, fontSize: 16 }}>
          企业组织架构可视化编辑器
        </span>
        {hasUnsavedChanges && (
          <Tag color="orange" icon={<SyncOutlined spin />}>
            未保存
          </Tag>
        )}
      </Space>

      <Space size="small">
        <Button
          icon={<UndoOutlined />}
          onClick={undo}
          disabled={!canUndo()}
          title="撤销 (Ctrl+Z)"
        />
        <Button
          icon={<RedoOutlined />}
          onClick={redo}
          disabled={!canRedo()}
          title="重做 (Ctrl+Y)"
        />
        <Divider type="vertical" />
        <Button
          icon={<SafetyOutlined />}
          onClick={handleValidate}
          title="全量校验"
        >
          校验
        </Button>
        <Button
          icon={<SaveOutlined />}
          onClick={handleSave}
          type="primary"
          disabled={!hasUnsavedChanges}
        >
          保存
        </Button>
        <Divider type="vertical" />
        <Dropdown menu={importMenu} trigger={['click']}>
          <Button icon={<UploadOutlined />}>导入</Button>
        </Dropdown>
        <Dropdown menu={exportMenu} trigger={['click']}>
          <Button icon={<DownloadOutlined />}>导出</Button>
        </Dropdown>
        <Button
          icon={<HistoryOutlined />}
          onClick={() => setSnapshotModalOpen(true)}
        >
          <Badge count={snapshots.length} size="small" offset={[5, -3]}>
            快照
          </Badge>
        </Button>
      </Space>

      <Modal
        title="快照管理"
        open={snapshotModalOpen}
        onCancel={() => setSnapshotModalOpen(false)}
        footer={null}
        width={600}
      >
        {snapshots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
            <CameraOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>暂无快照，可在左侧面板保存</div>
          </div>
        ) : (
          <List
            dataSource={[...snapshots].reverse()}
            renderItem={(snapshot) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleRestoreSnapshot(snapshot.id, snapshot.name)}
                  >
                    恢复
                  </Button>,
                  <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => deleteSnapshot(snapshot.id)}
                  >
                    删除
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontWeight: 500 }}>{snapshot.name}</span>
                      <Tag style={{ fontSize: 12 }}>
                        {snapshot.departments.length} 个部门
                      </Tag>
                      <Tag style={{ fontSize: 12 }}>
                        {snapshot.employees.length} 名员工
                      </Tag>
                    </Space>
                  }
                  description={new Date(snapshot.createdAt).toLocaleString('zh-CN')}
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

      <Modal
        title="导入预览"
        open={importPreviewModal}
        onOk={confirmImport}
        onCancel={() => {
          setImportPreviewModal(false);
          setPendingImportData(null);
          setImportPreview(null);
        }}
        okText="确认导入"
        cancelText="取消"
        width={700}
      >
        {importPreview && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <h4 style={{ marginBottom: 8 }}>部门变更</h4>
              <Space wrap>
                <Tag color="green">新增: {importPreview.added.length}</Tag>
                <Tag color="blue">修改: {importPreview.modified.length}</Tag>
                <Tag color="red">删除: {importPreview.deleted.length}</Tag>
              </Space>
            </div>
            <div>
              <h4 style={{ marginBottom: 8 }}>员工变更</h4>
              <Space wrap>
                <Tag color="green">新增: {importPreview.addedEmployees.length}</Tag>
                <Tag color="blue">修改: {importPreview.modifiedEmployees.length}</Tag>
                <Tag color="red">删除: {importPreview.deletedEmployees.length}</Tag>
              </Space>
            </div>
            {importPreview.deleted.length > 0 && (
              <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                * 删除操作将在导入后移除相关部门，员工将变为未分配状态
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default Toolbar;
