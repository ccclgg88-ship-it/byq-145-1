import React, { useState } from 'react';
import { Card, Input, Button, Space, Tag, List, Modal, Form, Select, message } from 'antd';
import { PlusOutlined, UnorderedListOutlined, FolderOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import { DepartmentStatus } from '../types';

const statusOptions = [
  { value: 'normal', label: '正常', color: 'green' },
  { value: 'preparing', label: '筹备中', color: 'orange' },
  { value: 'revoked', label: '已撤销', color: 'default' },
];

const DepartmentPanel: React.FC = () => {
  const { departments, addDepartment, getDepartmentEmployees, saveSnapshot } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [form] = Form.useForm();

  const onDragStart = (event: React.DragEvent, deptType: string) => {
    const deptData = {
      code: `D${String(Date.now()).slice(-6)}`,
      name: deptType,
      parentId: null,
      managerId: null,
      status: 'normal' as DepartmentStatus,
    };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(deptData));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleAddDepartment = async () => {
    try {
      const values = await form.validateFields();
      addDepartment({
        ...values,
        status: values.status || 'normal',
      });
      message.success('部门创建成功，可拖拽到画布');
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      // Validation error
    }
  };

  const handleSaveSnapshot = () => {
    if (!snapshotName.trim()) {
      message.warning('请输入快照名称');
      return;
    }
    saveSnapshot(snapshotName);
    message.success('快照保存成功');
    setSnapshotModalOpen(false);
    setSnapshotName('');
  };

  const departmentTypes = [
    { name: '研发部门', icon: '💻' },
    { name: '销售部门', icon: '📈' },
    { name: '市场部门', icon: '📢' },
    { name: '人力资源', icon: '👥' },
    { name: '财务部门', icon: '💰' },
    { name: '运营部门', icon: '⚙️' },
    { name: '产品部门', icon: '📱' },
    { name: '行政部门', icon: '📋' },
  ];

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Card title="部门库" size="small">
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsModalOpen(true)}
              block
            >
              新建部门
            </Button>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
              拖拽下方部门到画布
            </div>
            {departmentTypes.map((type) => (
              <div
                key={type.name}
                className="dndnode"
                draggable
                onDragStart={(e) => onDragStart(e, type.name)}
              >
                <Space>
                  <span>{type.icon}</span>
                  <span>{type.name}</span>
                </Space>
              </div>
            ))}
          </Space>
        </Card>

        <Card title="现有部门" size="small" extra={<UnorderedListOutlined />}>
          <List
            size="small"
            dataSource={departments}
            renderItem={(dept) => {
              const empCount = getDepartmentEmployees(dept.id).length;
              const status = statusOptions.find(s => s.value === dept.status);
              return (
                <List.Item
                  style={{
                    cursor: 'grab',
                    padding: '8px 4px',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                  draggable
                  onDragStart={(e) => {
                    const deptData = {
                      code: dept.code,
                      name: dept.name,
                      parentId: dept.parentId,
                      managerId: dept.managerId,
                      status: dept.status,
                    };
                    e.dataTransfer.setData('application/reactflow', JSON.stringify(deptData));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size={4}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <FolderOutlined style={{ color: '#1890ff' }} />
                        <span style={{ fontWeight: 500 }}>{dept.name}</span>
                      </Space>
                      <Tag color={status?.color} style={{ fontSize: 12 }}>
                        {status?.label}
                      </Tag>
                    </Space>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                      {dept.code} · {empCount} 人
                    </div>
                  </Space>
                </List.Item>
              );
            }}
          />
        </Card>

        <Card title="快捷操作" size="small">
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Button block onClick={() => setSnapshotModalOpen(true)}>
              保存快照
            </Button>
          </Space>
        </Card>
      </Space>

      <Modal
        title="新建部门"
        open={isModalOpen}
        onOk={handleAddDepartment}
        onCancel={() => setIsModalOpen(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="部门编码"
            rules={[{ required: true, message: '请输入部门编码' }]}
          >
            <Input placeholder="如：D001" />
          </Form.Item>
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          <Form.Item name="status" label="部门状态" initialValue="normal">
            <Select options={statusOptions.map(s => ({ value: s.value, label: s.label }))} />
          </Form.Item>
          <Form.Item name="description" label="部门描述">
            <Input.TextArea rows={3} placeholder="请输入部门描述" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="保存快照"
        open={snapshotModalOpen}
        onOk={handleSaveSnapshot}
        onCancel={() => setSnapshotModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Input
          placeholder="请输入快照名称"
          value={snapshotName}
          onChange={(e) => setSnapshotName(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default DepartmentPanel;
