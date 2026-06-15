export type DepartmentStatus = 'normal' | 'preparing' | 'revoked';

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  departmentId: string | null;
  position: string;
  phone: string;
  email: string;
  avatar?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  status: DepartmentStatus;
  description?: string;
  position: { x: number; y: number };
}

export interface TransferRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  fromDepartmentId: string | null;
  fromDepartmentName: string | null;
  toDepartmentId: string | null;
  toDepartmentName: string | null;
  reason: string;
  effectiveDate: string;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  name: string;
  createdAt: string;
  departments: Department[];
  employees: Employee[];
  edges: { id: string; source: string; target: string }[];
}

export interface Conflict {
  id: string;
  type: 'duplicate_code' | 'isolated_node' | 'cycle' | 'invalid_manager';
  severity: 'error' | 'warning';
  message: string;
  departmentIds: string[];
}

export interface ImportPreview {
  added: Department[];
  modified: Department[];
  deleted: string[];
  addedEmployees: Employee[];
  modifiedEmployees: Employee[];
  deletedEmployees: string[];
}

export type HistoryAction =
  | { type: 'ADD_NODE'; payload: Department }
  | { type: 'UPDATE_NODE'; payload: Department }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'MOVE_NODE'; payload: { id: string; position: { x: number; y: number } } }
  | { type: 'ADD_EDGE'; payload: { source: string; target: string } }
  | { type: 'DELETE_EDGE'; payload: string }
  | { type: 'ADD_EMPLOYEE'; payload: Employee }
  | { type: 'UPDATE_EMPLOYEE'; payload: Employee }
  | { type: 'DELETE_EMPLOYEE'; payload: string }
  | { type: 'TRANSFER_EMPLOYEE'; payload: { employeeId: string; departmentId: string | null } };
