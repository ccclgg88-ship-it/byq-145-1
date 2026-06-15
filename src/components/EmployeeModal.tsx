import React, { useState, useMemo } from 'react';
import {
  Modal,
  Table,
  Input,
  Button,
  Space,
  Select,
  message,
  Progress,
  Checkbox,
  Form,
  DatePicker,
  Popconfirm,
  Tag,
} from 'antd';
import { SearchOutlined, UserAddOutlined, ExportOutlined, HistoryOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import { Employee } from '../types';

interface EmployeeModalProps {
  departmentId: string;
  open: boolean;
  onClose: () => void;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ departmentId, open, onClose }) => {
  const {
    departments,
    employees,
    transferEmployee,
    batchTransferEmployees,
    getDepartmentEmployees,
    getUnassignedEmployees,
    updateEmployee,
    openTransferRecordDrawer,
  } = useAppStore();

  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm] = Form.useForm();
  const [batchProgress, setBatchProgress] = useState<{ visible: boolean; percent: number; total: number; success: number; failed: { id: string; reason: string }[] }>({
    visible: false,
    percent: 0,
    total: 0,
    success: 0,
    failed: [],
  });
  const [activeTab, setActiveTab] = useState<'current' | 'available'>('current');

  const department = departments.find(d => d.id === departmentId);
  const deptEmployees = useMemo(() => getDepartmentEmployees(departmentId), [departmentId, getDepartmentEmployees]);
  const unassignedEmployees = useMemo(() => getUnassignedEmployees(), [getUnassignedEmployees]);

  const currentEmployees = useMemo(() => {
    return deptEmployees.filter(e =>
      e.name.includes(searchText) ||
      e.employeeId.includes(searchText) ||
      e.position.includes(searchText)
    );
  }, [deptEmployees, searchText]);

  const availableEmployees = useMemo(() => {
    return unassignedEmployees.filter(e =>
      e.name.includes(searchText) ||
      e.employeeId.includes(searchText) ||
      e.position.includes(searchText)
    );
  }, [unassignedEmployees, searchText]);

  const displayEmployees = activeTab === 'current' ? currentEmployees : availableEmployees;

  const handleBatchTransferOut = async () => {
    try {
      const values = await transferForm.validateFields();
      const targetDeptId = values.targetDepartment;
      const reason = values.reason;
      const effectiveDate = values.effectiveDate?.format('YYYY-MM-DD') || new Date().toISOString().split('T')[0];

      setBatchProgress({
        visible: true,
        percent: 0,
        total: selectedRowKeys.length,
        success: 0,
        failed: [],
      });

      const results = await batchTransferEmployees(
        selectedRowKeys as string[],
        targetDeptId || null,
        reason,
        effectiveDate
      );

      setBatchProgress(prev => ({
        ...prev,
        percent: 100,
        success: results.success,
        failed: results.failed,
      }));

      setTimeout(() => {
        setBatchProgress({ visible: false, percent: 0, total: 0, success: 0, failed: [] });
        if (results.failed.length > 0) {
          message.warning(`批量处理完成：成功 ${results.success} 个，失败 ${results.failed.length} 个`);
        } else {
          message.success(`成功调动 ${results.success} 名员工`);
        }
        setSelectedRowKeys([]);
        setShowTransferModal(false);
        transferForm.resetFields();
      }, 1000);
    } catch (error) {
      // Validation error
    }
  };

  const handleTransferIn = async (employeeId: string) => {
    if (department?.status === 'revoked') {
      message.error('已撤销部门不可新增员工');
      return;
    }
    
    const success = transferEmployee(
      employeeId,
      departmentId,
      '部门调入',
      new Date().toISOString().split('T')[0]
    );
    
    if (success) {
      message.success('员工调入成功');
    } else {
      message.error('调入失败');
    }
  };

  const handleRemoveEmployee = (employee: Employee) => {
    if (department?.managerId === employee.id) {
      const otherEmployees = deptEmployees.filter(e => e.id !== employee.id);
      if (otherEmployees.length > 0) {
        Modal.confirm({
          title: '无法移除',
          content: '该员工是当前部门负责人，请先指定新的负责人。',
          okText: '去设置',
          cancelText: '取消',
          onOk: () => {
            onClose();
          },
        });
        return;
      }
    }

    Modal.confirm({
      title: '确认移除',
      content: `确定将「${employee.name}」移出本部门？移出后员工将变为未分配状态。`,
      okText: '移出',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        const success = transferEmployee(
          employee.id,
          null,
          '部门移出',
          new Date().toISOString().split('T')[0]
        );
        if (success) {
          message.success('已移出部门');
        }
      },
    });
  };

  const columns = [
    {
      title: '员工编号',
      dataIndex: 'employeeId',
      key: 'employeeId',
      width: 100,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '职位',
      dataIndex: 'position',
      key: 'position',
      width: 120,
    },
    {
      title: '联系方式',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '是否负责人',
      key: 'isManager',
      width: 100,
      render: (_: any, record: Employee) => (
        department?.managerId === record.id ? (
          <Tag color="blue">负责人</Tag>
        ) : null
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: Employee) => (
        <Space size="small">
          {activeTab === 'current' ? (
            <Popconfirm
              title="确认移出"
              description="确定将该员工移出本部门？"
              onConfirm={() => handleRemoveEmployee(record)}
              okText="移出"
              okType="danger"
              cancelText="取消"
            >
              <Button type="link" danger size="small">
                移出
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => handleTransferIn(record.id)}
              disabled={department?.status === 'revoked'}
            >
              调入
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => {
              onClose();
              openTransferRecordDrawer(record.id);
            }}
          >
            调动历史
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record: Employee) => ({
      disabled: department?.managerId === record.id && activeTab === 'current',
    }),
  };

  return (
    <>
      <Modal
        title={`${department?.name || '部门'} - 员工管理`}
        open={open}
        onCancel={onClose}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Input
              placeholder="搜索员工姓名、编号、职位"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
            <Space>
              <Button.Group>
                <Button
                  type={activeTab === 'current' ? 'primary' : 'default'}
                  onClick={() => setActiveTab('current')}
                >
                  本部门员工 ({deptEmployees.length})
                </Button>
                <Button
                  type={activeTab === 'available' ? 'primary' : 'default'}
                  onClick={() => setActiveTab('available')}
                >
                  待分配员工 ({unassignedEmployees.length})
                </Button>
              </Button.Group>
              {activeTab === 'current' && selectedRowKeys.length > 0 && (
                <Button
                  type="primary"
                  icon={<ExportOutlined />}
                  onClick={() => setShowTransferModal(true)}
                  disabled={department?.status === 'revoked'}
                >
                  批量调动 ({selectedRowKeys.length})
                </Button>
              )}
            </Space>
          </div>

          <Table
            rowSelection={activeTab === 'current' ? rowSelection : undefined}
            columns={columns}
            dataSource={displayEmployees}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
            }}
            scroll={{ y: 400 }}
          />
        </Space>
      </Modal>

      <Modal
        title="批量调动员工"
        open={showTransferModal}
        onOk={handleBatchTransferOut}
        onCancel={() => {
          setShowTransferModal(false);
          transferForm.resetFields();
        }}
        okText="确认调动"
        cancelText="取消"
        width={500}
      >
        <Form form={transferForm} layout="vertical">
          <Form.Item
            name="targetDepartment"
            label="目标部门"
          >
            <Select
              placeholder="选择目标部门（不选则变为未分配）"
              allowClear
              options={departments
                .filter(d => d.id !== departmentId && d.status !== 'revoked')
                .map(d => ({ value: d.id, label: `${d.name} (${d.code})` }))}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="调动原因"
            rules={[{ required: true, message: '请输入调动原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入调动原因" />
          </Form.Item>
          <Form.Item
            name="effectiveDate"
            label="生效日期"
            rules={[{ required: true, message: '请选择生效日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {batchProgress.visible && (
        <div className="progress-overlay">
          <div className="progress-content">
            <h3 style={{ marginBottom: 20 }}>批量处理中...</h3>
            <Progress percent={batchProgress.percent} status="active" />
            <div style={{ marginTop: 16, fontSize: 14 }}>
              <p>总计：{batchProgress.total} 个</p>
              <p>成功：{batchProgress.success} 个</p>
              {batchProgress.failed.length > 0 && (
                <>
                  <p style={{ color: '#ff4d4f' }}>失败：{batchProgress.failed.length} 个</p>
                  <div style={{ maxHeight: 150, overflow: 'auto', background: '#fff7f7', padding: 8, borderRadius: 4 }}>
                    {batchProgress.failed.map((f, idx) => (
                      <div key={idx} style={{ fontSize: 12, color: '#ff4d4f' }}>
                        - {f.id}: {f.reason}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeeModal;
