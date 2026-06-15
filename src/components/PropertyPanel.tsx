import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Modal,
  message,
  Tag,
  Alert,
  Divider,
} from 'antd';
import { DeleteOutlined, UserOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import { Department, DepartmentStatus } from '../types';

const statusOptions = [
  { value: 'normal', label: '正常' },
  { value: 'preparing', label: '筹备中' },
  { value: 'revoked', label: '已撤销' },
];

const { confirm } = Modal;

const PropertyPanel: React.FC = () => {
  const {
    selectedNodeId,
    departments,
    employees,
    updateDepartment,
    deleteDepartment,
    getDepartmentEmployees,
    setSelectedNode,
    openTransferRecordDrawer,
  } = useAppStore();

  const [form] = Form.useForm();
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [managerConflictModal, setManagerConflictModal] = useState(false);
  const [pendingManagerId, setPendingManagerId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedNodeId) {
      const dept = departments.find(d => d.id === selectedNodeId);
      setSelectedDept(dept || null);
      if (dept) {
        form.setFieldsValue({
          name: dept.name,
          code: dept.code,
          parentId: dept.parentId,
          managerId: dept.managerId,
          status: dept.status,
          description: dept.description,
        });
      }
    } else {
      setSelectedDept(null);
      form.resetFields();
    }
  }, [selectedNodeId, departments, form]);

  if (!selectedNodeId || !selectedDept) {
    return (
      <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
        <Card size="small">
          <div style={{ textAlign: 'center', color: '#8c8c8c', padding: '40px 0' }}>
            <UserOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>请选择一个部门节点</div>
          </div>
        </Card>
      </div>
    );
  }

  const deptEmployees = getDepartmentEmployees(selectedDept.id);
  const manager = employees.find(e => e.id === selectedDept.managerId);
  const parentDept = departments.find(d => d.id === selectedDept.parentId);
  const deptMap = new Map(departments.map(d => [d.id, d.name]));

  const employeeOptions = employees.map(e => {
    const deptName = e.departmentId ? deptMap.get(e.departmentId) : '未分配';
    const isCurrentDept = e.departmentId === selectedDept.id;
    return {
      value: e.id,
      label: `${e.name} (${e.employeeId})${deptName ? ` - ${deptName}${isCurrentDept ? ' (本部门)' : ''}` : ''}`,
    };
  }).sort((a, b) => {
    const aIsCurrent = a.label.includes('(本部门)');
    const bIsCurrent = b.label.includes('(本部门)');
    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return 1;
    return a.label.localeCompare(b.label);
  });

  const departmentOptions = departments
    .filter(d => d.id !== selectedDept.id && d.status !== 'revoked')
    .map(d => ({
      value: d.id,
      label: `${d.name} (${d.code})`,
    }));

  const handleValuesChange = (changedValues: any) => {
    if (changedValues.managerId !== undefined) {
      const newManagerId = changedValues.managerId;
      if (newManagerId) {
        const newManager = employees.find(e => e.id === newManagerId);
        if (newManager && newManager.departmentId && newManager.departmentId !== selectedDept.id) {
          const currentDept = departments.find(d => d.id === newManager.departmentId);
          setPendingManagerId(newManagerId);
          Modal.confirm({
            title: '负责人冲突',
            icon: <ExclamationCircleOutlined />,
            content: (
              <div>
                <p>员工「{newManager.name}」当前属于「{currentDept?.name}」部门。</p>
                <p>请选择处理方式：</p>
              </div>
            ),
            okText: '合并（保留原部门）',
            cancelText: '替换（移至新部门）',
            onOk: () => {
              updateDepartment(selectedDept.id, { managerId: newManagerId });
              message.success('已设置负责人，员工仍在原部门');
              setPendingManagerId(null);
            },
            onCancel: () => {
              useAppStore.getState().transferEmployee(
                newManagerId,
                selectedDept.id,
                '部门负责人调动',
                new Date().toISOString().split('T')[0]
              );
              updateDepartment(selectedDept.id, { managerId: newManagerId });
              message.success('已设置负责人并将员工移至本部门');
              setPendingManagerId(null);
            },
          });
          return;
        }
      }
      updateDepartment(selectedDept.id, { managerId: newManagerId });
    } else {
      updateDepartment(selectedDept.id, changedValues);
    }
  };

  const handleDelete = () => {
    confirm({
      title: '确认删除部门',
      content: `删除「${selectedDept.name}」后，该部门下的员工将变为未分配状态，且无法恢复。是否继续？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        deleteDepartment(selectedDept.id);
        setSelectedNode(null);
        message.success('部门已删除');
      },
    });
  };

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Card
          title="部门属性"
          size="small"
          extra={
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            >
              删除
            </Button>
          }
        >
          {selectedDept.status === 'revoked' && (
            <Alert
              type="warning"
              message="该部门已撤销，不可新增员工"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          
          <Form
            form={form}
            layout="vertical"
            onValuesChange={handleValuesChange}
          >
            <Form.Item
              name="name"
              label="部门名称"
              rules={[{ required: true, message: '请输入部门名称' }]}
            >
              <Input placeholder="请输入部门名称" />
            </Form.Item>

            <Form.Item
              name="code"
              label="部门编码"
              rules={[{ required: true, message: '请输入部门编码' }]}
            >
              <Input placeholder="请输入部门编码" />
            </Form.Item>

            <Form.Item name="parentId" label="上级部门">
              <Select
                placeholder="请选择上级部门"
                allowClear
                options={departmentOptions}
              />
            </Form.Item>

            <Form.Item name="managerId" label="负责人">
              <Select
                placeholder="请选择负责人（支持搜索姓名/工号/部门）"
                allowClear
                options={employeeOptions}
                disabled={selectedDept.status === 'revoked'}
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
                listHeight={300}
              />
            </Form.Item>

            <Form.Item
              name="status"
              label="部门状态"
              rules={[{ required: true }]}
            >
              <Select options={statusOptions} />
            </Form.Item>

            <Form.Item name="description" label="部门描述">
              <Input.TextArea rows={3} placeholder="请输入部门描述" />
            </Form.Item>
          </Form>
        </Card>

        <Card title="基本信息" size="small">
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <span style={{ color: '#8c8c8c' }}>当前负责人：</span>
              <span>{manager ? `${manager.name} (${manager.employeeId})` : '未指定'}</span>
            </div>
            <div>
              <span style={{ color: '#8c8c8c' }}>上级部门：</span>
              <span>{parentDept ? `${parentDept.name} (${parentDept.code})` : '无'}</span>
            </div>
            <div>
              <span style={{ color: '#8c8c8c' }}>在职人数：</span>
              <span>{deptEmployees.length} 人</span>
            </div>
            <div>
              <span style={{ color: '#8c8c8c' }}>状态：</span>
              <Tag
                color={
                  selectedDept.status === 'normal' ? 'green' :
                  selectedDept.status === 'preparing' ? 'orange' : 'default'
                }
              >
                {statusOptions.find(s => s.value === selectedDept.status)?.label}
              </Tag>
            </div>
          </Space>
        </Card>

        <Card title="员工列表（双击节点查看详情）" size="small">
          {deptEmployees.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {deptEmployees.slice(0, 5).map(emp => (
                <div
                  key={emp.id}
                  style={{
                    padding: '4px 0',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => openTransferRecordDrawer(emp.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 500 }}>{emp.name}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                    {emp.employeeId} · {emp.position} · <span style={{ color: '#1890ff' }}>查看调动历史</span>
                  </div>
                </div>
              ))}
              {deptEmployees.length > 5 && (
                <div style={{ textAlign: 'center', color: '#8c8c8c', fontSize: 12 }}>
                  还有 {deptEmployees.length - 5} 名员工...
                </div>
              )}
            </Space>
          ) : (
            <div style={{ textAlign: 'center', color: '#8c8c8c', padding: '20px 0' }}>
              暂无员工
            </div>
          )}
        </Card>
      </Space>
    </div>
  );
};

export default PropertyPanel;
