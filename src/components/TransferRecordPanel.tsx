import React, { useState, useMemo, useEffect } from 'react';
import {
  Drawer,
  Table,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Statistic,
  Card,
  Row,
  Col,
  Tag,
  Empty,
  message,
} from 'antd';
import {
  SearchOutlined,
  SwapOutlined,
  DownloadOutlined,
  ClearOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import Papa from 'papaparse';
import { useAppStore } from '../store';
import { TransferRecord } from '../types';

const { RangePicker } = DatePicker;

const TransferRecordPanel: React.FC = () => {
  const {
    transferRecords,
    departments,
    employees,
    transferRecordDrawerOpen,
    transferRecordFilterEmployeeId,
    closeTransferRecordDrawer,
    setSelectedNode,
  } = useAppStore();

  const [searchText, setSearchText] = useState('');
  const [fromDeptFilter, setFromDeptFilter] = useState<string | undefined>(undefined);
  const [toDeptFilter, setToDeptFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  useEffect(() => {
    if (transferRecordFilterEmployeeId) {
      const emp = employees.find(e => e.id === transferRecordFilterEmployeeId);
      if (emp) {
        setSearchText(emp.name);
      }
    }
  }, [transferRecordFilterEmployeeId]);

  const deptNameMap = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach(d => map.set(d.id, d.name));
    return map;
  }, [departments]);

  const deptFilterOptions = useMemo(() => {
    return [
      { value: '__unassigned__', label: '未分配' },
      ...departments.map(d => ({ value: d.id, label: d.name })),
    ];
  }, [departments]);

  const filteredRecords = useMemo(() => {
    let records = [...transferRecords].reverse();

    if (searchText.trim()) {
      const keyword = searchText.trim().toLowerCase();
      records = records.filter(r =>
        r.employeeName.toLowerCase().includes(keyword) ||
        r.employeeCode?.toLowerCase().includes(keyword)
      );
    }

    if (fromDeptFilter) {
      records = records.filter(r => {
        if (fromDeptFilter === '__unassigned__') return !r.fromDepartmentId;
        return r.fromDepartmentId === fromDeptFilter;
      });
    }

    if (toDeptFilter) {
      records = records.filter(r => {
        if (toDeptFilter === '__unassigned__') return !r.toDepartmentId;
        return r.toDepartmentId === toDeptFilter;
      });
    }

    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day').toDate();
      const end = dateRange[1].endOf('day').toDate();
      records = records.filter(r => {
        const effectiveDate = new Date(r.effectiveDate);
        return effectiveDate >= start && effectiveDate <= end;
      });
    }

    return records;
  }, [transferRecords, searchText, fromDeptFilter, toDeptFilter, dateRange]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getFullYear() * 100 + now.getMonth();
    const today = now.toISOString().split('T')[0];

    let monthCount = 0;
    let pendingCount = 0;

    transferRecords.forEach(r => {
      const effDate = new Date(r.effectiveDate);
      const effMonth = effDate.getFullYear() * 100 + effDate.getMonth();
      if (effMonth === currentMonth) monthCount++;
      if (r.effectiveDate > today) pendingCount++;
    });

    return {
      total: transferRecords.length,
      thisMonth: monthCount,
      pending: pendingCount,
    };
  }, [transferRecords]);

  const hasFilters = searchText.trim() || fromDeptFilter || toDeptFilter || dateRange;

  const clearFilters = () => {
    setSearchText('');
    setFromDeptFilter(undefined);
    setToDeptFilter(undefined);
    setDateRange(null);
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      message.warning('没有可导出的记录');
      return;
    }

    const exportData = filteredRecords.map(r => ({
      '员工姓名': r.employeeName,
      '员工工号': r.employeeCode || '',
      '调出部门': r.fromDepartmentName || '未分配',
      '调入部门': r.toDepartmentName || '未分配',
      '调动原因': r.reason,
      '生效日期': r.effectiveDate,
      '操作时间': new Date(r.createdAt).toLocaleString('zh-CN'),
    }));

    const csv = Papa.unparse(exportData, { quotes: true });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `调动记录_${new Date().toISOString().split('T')[0]}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    message.success('CSV 导出成功');
  };

  const handleDeptClick = (deptId: string | null) => {
    if (deptId) {
      setSelectedNode(deptId);
    }
  };

  const renderDeptName = (deptId: string | null, deptName: string | null) => {
    if (!deptId) {
      return <Tag>未分配</Tag>;
    }
    return (
      <Button
        type="link"
        size="small"
        style={{ padding: 0, height: 'auto', fontSize: 13 }}
        onClick={() => handleDeptClick(deptId)}
      >
        {deptName || deptId}
      </Button>
    );
  };

  const today = new Date().toISOString().split('T')[0];

  const columns = [
    {
      title: '员工姓名',
      dataIndex: 'employeeName',
      key: 'employeeName',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '工号',
      dataIndex: 'employeeCode',
      key: 'employeeCode',
      width: 90,
    },
    {
      title: '调出部门',
      key: 'fromDept',
      width: 130,
      render: (_: any, record: TransferRecord) =>
        renderDeptName(record.fromDepartmentId, record.fromDepartmentName),
    },
    {
      title: '',
      key: 'arrow',
      width: 40,
      render: () => <SwapOutlined style={{ color: '#1890ff' }} />,
    },
    {
      title: '调入部门',
      key: 'toDept',
      width: 130,
      render: (_: any, record: TransferRecord) =>
        renderDeptName(record.toDepartmentId, record.toDepartmentName),
    },
    {
      title: '调动原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 140,
      ellipsis: true,
    },
    {
      title: '生效日期',
      dataIndex: 'effectiveDate',
      key: 'effectiveDate',
      width: 110,
      render: (date: string) => (
        <Space size={4}>
          <CalendarOutlined style={{ color: date > today ? '#fa8c16' : '#8c8c8c' }} />
          <span style={{ color: date > today ? '#fa8c16' : undefined }}>
            {date}
          </span>
        </Space>
      ),
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: TransferRecord) => {
        if (record.effectiveDate > today) {
          return <Tag color="orange" icon={<ClockCircleOutlined />}>待生效</Tag>;
        }
        return <Tag color="green">已生效</Tag>;
      },
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <FileTextOutlined />
          <span>员工调动记录中心</span>
        </Space>
      }
      open={transferRecordDrawerOpen}
      onClose={closeTransferRecordDrawer}
      width={960}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ padding: '0 24px' }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title="总调动次数"
                value={stats.total}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title="本月调动"
                value={stats.thisMonth}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title="待生效"
                value={stats.pending}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        <div style={{
          marginBottom: 16,
          padding: 16,
          background: '#fafafa',
          borderRadius: 8,
        }}>
          <Space wrap size={12}>
            <Input
              placeholder="搜索员工姓名/工号"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="调出部门"
              value={fromDeptFilter}
              onChange={setFromDeptFilter}
              options={deptFilterOptions}
              style={{ width: 150 }}
              allowClear
            />
            <Select
              placeholder="调入部门"
              value={toDeptFilter}
              onChange={setToDeptFilter}
              options={deptFilterOptions}
              style={{ width: 150 }}
              allowClear
            />
            <RangePicker
              placeholder={['生效起始', '生效结束']}
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
              style={{ width: 240 }}
            />
            {hasFilters && (
              <Button
                icon={<ClearOutlined />}
                onClick={clearFilters}
              >
                清空条件
              </Button>
            )}
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}
              disabled={filteredRecords.length === 0}
            >
              导出 CSV
            </Button>
          </Space>
          {hasFilters && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
              已筛选出 {filteredRecords.length} 条记录（共 {transferRecords.length} 条）
            </div>
          )}
        </div>

        {transferRecords.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <span>暂无调动记录</span>
                <span style={{ fontSize: 12, color: '#bfbfbf' }}>
                  记录会在员工调动操作时自动生成
                </span>
              </Space>
            }
            style={{ padding: '60px 0' }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredRecords}
            rowKey="id"
            pagination={{
              pageSize: 15,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            scroll={{ x: 1000, y: 'calc(100vh - 420px)' }}
            size="small"
            rowClassName={(record) =>
              record.effectiveDate > today ? 'pending-transfer-row' : ''
            }
          />
        )}
      </div>
    </Drawer>
  );
};

export default TransferRecordPanel;
