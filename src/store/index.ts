import { create } from 'zustand';
import { produce, castDraft } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import {
  Department,
  Employee,
  TransferRecord,
  Snapshot,
  Conflict,
  HistoryAction,
  DepartmentStatus,
} from '../types';

interface AppState {
  departments: Department[];
  employees: Employee[];
  edges: { id: string; source: string; target: string }[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  transferRecords: TransferRecord[];
  snapshots: Snapshot[];
  conflicts: Conflict[];
  hasUnsavedChanges: boolean;
  history: HistoryAction[][];
  historyIndex: number;
  maxHistory: number;
  viewport: { x: number; y: number; zoom: number };
}

interface AppActions {
  addDepartment: (dept: Omit<Department, 'id' | 'position'> & { position?: { x: number; y: number } }) => void;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
  moveDepartment: (id: string, position: { x: number; y: number }) => void;
  addEdge: (source: string, target: string) => boolean;
  deleteEdge: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  transferEmployee: (employeeId: string, departmentId: string | null, reason: string, effectiveDate: string) => boolean;
  batchTransferEmployees: (employeeIds: string[], departmentId: string | null, reason: string, effectiveDate: string) => Promise<{ success: number; failed: { id: string; reason: string }[] }>;
  saveSnapshot: (name: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  detectConflicts: () => void;
  validateAll: () => { valid: boolean; conflicts: Conflict[] };
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  importData: (data: { departments: Department[]; employees: Employee[] }) => void;
  exportData: () => { departments: Department[]; employees: Employee[]; edges: AppState['edges'] };
  reset: () => void;
  markAsSaved: () => void;
  getDepartmentEmployees: (deptId: string) => Employee[];
  getUnassignedEmployees: () => Employee[];
}

const MAX_HISTORY = 20;

const initialState: AppState = {
  departments: [],
  employees: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  transferRecords: [],
  snapshots: [],
  conflicts: [],
  hasUnsavedChanges: false,
  history: [],
  historyIndex: -1,
  maxHistory: MAX_HISTORY,
  viewport: { x: 0, y: 0, zoom: 1 },
};

const pushHistory = (state: AppState, action: HistoryAction): AppState => {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push([action]);
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }
  return {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1,
    hasUnsavedChanges: true,
  };
};

const pushBatchHistory = (state: AppState, actions: HistoryAction[]): AppState => {
  if (actions.length === 0) return state;
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(actions);
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }
  return {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1,
    hasUnsavedChanges: true,
  };
};

const detectConflictsInState = (state: AppState): Conflict[] => {
  const conflicts: Conflict[] = [];
  const deptMap = new Map(state.departments.map(d => [d.id, d]));

  const codeMap = new Map<string, string[]>();
  state.departments.forEach(d => {
    if (!codeMap.has(d.code)) {
      codeMap.set(d.code, []);
    }
    codeMap.get(d.code)!.push(d.id);
  });

  codeMap.forEach((ids, code) => {
    if (ids.length > 1) {
      conflicts.push({
        id: uuidv4(),
        type: 'duplicate_code',
        severity: 'error',
        message: `部门编码「${code}」被 ${ids.length} 个部门重复使用`,
        departmentIds: ids,
      });
    }
  });

  state.departments.forEach(dept => {
    const hasParent = dept.parentId && deptMap.has(dept.parentId);
    const hasChildren = state.edges.some(e => e.source === dept.id);
    if (!hasParent && !hasChildren && state.departments.length > 1) {
      conflicts.push({
        id: uuidv4(),
        type: 'isolated_node',
        severity: 'warning',
        message: `部门「${dept.name}」既没有上级也没有下级，是孤立节点`,
        departmentIds: [dept.id],
      });
    }
  });

  const detectCycle = (startId: string): string[] | null => {
    const visited = new Set<string>();
    const path: string[] = [];
    
    const dfs = (id: string): string[] | null => {
      if (id === startId && visited.has(startId)) {
        return [...path, startId];
      }
      if (visited.has(id)) return null;
      
      visited.add(id);
      path.push(id);
      
      const children = state.edges.filter(e => e.source === id).map(e => e.target);
      for (const child of children) {
        const result = dfs(child);
        if (result) return result;
      }
      
      path.pop();
      return null;
    };
    
    return dfs(startId);
  };

  const cycleFound = new Set<string>();
  state.departments.forEach(dept => {
    if (!cycleFound.has(dept.id)) {
      const cycle = detectCycle(dept.id);
      if (cycle) {
        cycle.forEach(id => cycleFound.add(id));
        const deptNames = cycle.map(id => deptMap.get(id)?.name || id).join(' → ');
        conflicts.push({
          id: uuidv4(),
          type: 'cycle',
          severity: 'error',
          message: `检测到循环汇报链：${deptNames}`,
          departmentIds: cycle,
        });
      }
    }
  });

  state.departments.forEach(dept => {
    if (dept.managerId) {
      const manager = state.employees.find(e => e.id === dept.managerId);
      if (!manager) {
        conflicts.push({
          id: uuidv4(),
          type: 'invalid_manager',
          severity: 'error',
          message: `部门「${dept.name}」的负责人不存在`,
          departmentIds: [dept.id],
        });
      } else if (manager.departmentId !== dept.id) {
        conflicts.push({
          id: uuidv4(),
          type: 'invalid_manager',
          severity: 'warning',
          message: `部门「${dept.name}」的负责人「${manager.name}」归属其他部门`,
          departmentIds: [dept.id],
        });
      }
    }
  });

  return conflicts;
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  ...initialState,

  addDepartment: (dept) => {
    const newDept: Department = {
      ...dept,
      id: uuidv4(),
      position: dept.position || { x: 100, y: 100 },
    };
    
    set(state => {
      const withDept = produce(state, draft => {
        draft.departments.push(castDraft(newDept));
        if (newDept.parentId) {
          draft.edges.push({
            id: uuidv4(),
            source: newDept.parentId!,
            target: newDept.id,
          });
        }
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      return pushHistory(withDept, { type: 'ADD_NODE', payload: newDept });
    });
  },

  updateDepartment: (id, updates) => {
    set(state => {
      const oldDept = state.departments.find(d => d.id === id);
      if (!oldDept) return state;
      
      const withUpdates = produce(state, draft => {
        const dept = draft.departments.find(d => d.id === id);
        if (dept) {
          Object.assign(dept, updates);
        }
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      
      const newDept = { ...oldDept, ...updates };
      return pushHistory(withUpdates, { type: 'UPDATE_NODE', payload: newDept });
    });
  },

  deleteDepartment: (id) => {
    set(state => {
      const actions: HistoryAction[] = [{ type: 'DELETE_NODE', payload: id }];
      
      const withDelete = produce(state, draft => {
        const deptIndex = draft.departments.findIndex(d => d.id === id);
        if (deptIndex === -1) return;
        
        const employeesToUpdate = draft.employees.filter(e => e.departmentId === id);
        employeesToUpdate.forEach(emp => {
          emp.departmentId = null;
          actions.push({
            type: 'UPDATE_EMPLOYEE',
            payload: { ...emp, departmentId: null },
          });
        });
        
        draft.departments.splice(deptIndex, 1);
        draft.edges = draft.edges.filter(e => e.source !== id && e.target !== id);
        draft.departments.forEach(d => {
          if (d.parentId === id) {
            d.parentId = null;
            actions.push({
              type: 'UPDATE_NODE',
              payload: { ...d, parentId: null },
            });
          }
          if (d.managerId && employeesToUpdate.some(e => e.id === d.managerId)) {
            d.managerId = null;
          }
        });
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      
      return pushBatchHistory(withDelete, actions);
    });
  },

  moveDepartment: (id, position) => {
    set(state => {
      const withMove = produce(state, draft => {
        const dept = draft.departments.find(d => d.id === id);
        if (dept) {
          dept.position = castDraft(position);
        }
      });
      return pushHistory(withMove, { type: 'MOVE_NODE', payload: { id, position } });
    });
  },

  addEdge: (source, target) => {
    if (source === target) return false;
    
    const state = get();
    const wouldCreateCycle = () => {
      const visited = new Set<string>();
      const stack = [target];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === source) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        state.edges.filter(e => e.source === current).forEach(e => stack.push(e.target));
      }
      return false;
    };
    
    if (wouldCreateCycle()) {
      return false;
    }
    
    set(state => {
      const existing = state.edges.find(e => e.source === source && e.target === target);
      if (existing) return state;
      
      const withEdge = produce(state, draft => {
        draft.edges.push({
          id: uuidv4(),
          source,
          target,
        });
        const targetDept = draft.departments.find(d => d.id === target);
        if (targetDept) {
          targetDept.parentId = source;
        }
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      
      return pushHistory(withEdge, { type: 'ADD_EDGE', payload: { source, target } });
    });
    
    return true;
  },

  deleteEdge: (id) => {
    set(state => {
      const edge = state.edges.find(e => e.id === id);
      if (!edge) return state;
      
      const withDelete = produce(state, draft => {
        draft.edges = draft.edges.filter(e => e.id !== id);
        const targetDept = draft.departments.find(d => d.id === edge.target);
        if (targetDept && targetDept.parentId === edge.source) {
          targetDept.parentId = null;
        }
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      
      return pushHistory(withDelete, { type: 'DELETE_EDGE', payload: id });
    });
  },

  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  addEmployee: (emp) => {
    const newEmp: Employee = { ...emp, id: uuidv4() };
    set(state => {
      const withEmp = produce(state, draft => {
        draft.employees.push(castDraft(newEmp));
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      return pushHistory(withEmp, { type: 'ADD_EMPLOYEE', payload: newEmp });
    });
  },

  updateEmployee: (id, updates) => {
    set(state => {
      const oldEmp = state.employees.find(e => e.id === id);
      if (!oldEmp) return state;
      
      const withUpdates = produce(state, draft => {
        const emp = draft.employees.find(e => e.id === id);
        if (emp) {
          Object.assign(emp, updates);
        }
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      
      const newEmp = { ...oldEmp, ...updates };
      return pushHistory(withUpdates, { type: 'UPDATE_EMPLOYEE', payload: newEmp });
    });
  },

  deleteEmployee: (id) => {
    set(state => {
      const withDelete = produce(state, draft => {
        draft.employees = draft.employees.filter(e => e.id !== id);
        draft.departments.forEach(d => {
          if (d.managerId === id) {
            d.managerId = null;
          }
        });
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      return pushHistory(withDelete, { type: 'DELETE_EMPLOYEE', payload: id });
    });
  },

  transferEmployee: (employeeId, departmentId, reason, effectiveDate) => {
    const state = get();
    const employee = state.employees.find(e => e.id === employeeId);
    if (!employee) return false;
    
    const currentDept = state.departments.find(d => d.id === employee.departmentId);
    if (currentDept && currentDept.managerId === employeeId) {
      const otherEmployees = state.getDepartmentEmployees(currentDept.id).filter(e => e.id !== employeeId);
      if (otherEmployees.length > 0) {
        return false;
      }
    }
    
    set(state => {
      const fromDept = state.departments.find(d => d.id === employee.departmentId);
      const toDept = state.departments.find(d => d.id === departmentId);
      
      const record: TransferRecord = {
        id: uuidv4(),
        employeeId,
        employeeName: employee.name,
        fromDepartmentId: employee.departmentId,
        fromDepartmentName: fromDept?.name || null,
        toDepartmentId: departmentId,
        toDepartmentName: toDept?.name || null,
        reason,
        effectiveDate,
        createdAt: new Date().toISOString(),
      };
      
      const withTransfer = produce(state, draft => {
        const emp = draft.employees.find(e => e.id === employeeId);
        if (emp) {
          emp.departmentId = departmentId;
        }
        draft.transferRecords.push(castDraft(record));
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      
      return pushHistory(withTransfer, {
        type: 'TRANSFER_EMPLOYEE',
        payload: { employeeId, departmentId },
      });
    });
    
    return true;
  },

  batchTransferEmployees: async (employeeIds, departmentId, reason, effectiveDate) => {
    const results: { success: number; failed: { id: string; reason: string }[] } = {
      success: 0,
      failed: [],
    };
    
    for (const employeeId of employeeIds) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const state = get();
      const employee = state.employees.find(e => e.id === employeeId);
      if (!employee) {
        results.failed.push({ id: employeeId, reason: '员工不存在' });
        continue;
      }
      
      const currentDept = state.departments.find(d => d.id === employee.departmentId);
      if (currentDept && currentDept.managerId === employeeId) {
        const otherEmployees = state.getDepartmentEmployees(currentDept.id).filter(e => e.id !== employeeId);
        if (otherEmployees.length > 0) {
          results.failed.push({ id: employeeId, reason: '该员工是部门负责人，需先指定新负责人' });
          continue;
        }
      }
      
      const success = get().transferEmployee(employeeId, departmentId, reason, effectiveDate);
      if (success) {
        results.success++;
      } else {
        results.failed.push({ id: employeeId, reason: '调动失败' });
      }
    }
    
    return results;
  },

  saveSnapshot: (name) => {
    const state = get();
    const snapshot: Snapshot = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      departments: JSON.parse(JSON.stringify(state.departments)),
      employees: JSON.parse(JSON.stringify(state.employees)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    };
    set(state => ({
      snapshots: [...state.snapshots, snapshot],
    }));
  },

  restoreSnapshot: (id) => {
    set(state => {
      const snapshot = state.snapshots.find(s => s.id === id);
      if (!snapshot) return state;
      return {
        ...state,
        departments: JSON.parse(JSON.stringify(snapshot.departments)),
        employees: JSON.parse(JSON.stringify(snapshot.employees)),
        edges: JSON.parse(JSON.stringify(snapshot.edges)),
        conflicts: detectConflictsInState({
          ...state,
          departments: snapshot.departments,
          employees: snapshot.employees,
          edges: snapshot.edges,
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  deleteSnapshot: (id) => {
    set(state => ({
      snapshots: state.snapshots.filter(s => s.id !== id),
    }));
  },

  detectConflicts: () => {
    set(state => ({
      conflicts: detectConflictsInState(state),
    }));
  },

  validateAll: () => {
    const state = get();
    const conflicts = detectConflictsInState(state);
    const valid = conflicts.every(c => c.severity !== 'error');
    return { valid, conflicts };
  },

  undo: () => {
    set(state => {
      if (state.historyIndex < 0) return state;
      
      const actions = state.history[state.historyIndex];
      let newSelectedNodeId = state.selectedNodeId;
      const newState = produce(state, draft => {
        actions.reverse().forEach(action => {
          switch (action.type) {
            case 'ADD_NODE': {
              const idx = draft.departments.findIndex(d => d.id === action.payload.id);
              if (idx !== -1) draft.departments.splice(idx, 1);
              draft.edges = draft.edges.filter(e => e.source !== action.payload.id && e.target !== action.payload.id);
              if (draft.selectedNodeId === action.payload.id) {
                draft.selectedNodeId = null;
                newSelectedNodeId = null;
              }
              break;
            }
            case 'UPDATE_NODE': {
              const idx = draft.departments.findIndex(d => d.id === action.payload.id);
              if (idx !== -1) {
                const old = state.departments.find(d => d.id === action.payload.id);
                if (old) draft.departments[idx] = castDraft({ ...old });
              }
              break;
            }
            case 'DELETE_NODE': {
              const old = state.departments.find(d => d.id === action.payload);
              if (old) draft.departments.push(castDraft({ ...old }));
              break;
            }
            case 'MOVE_NODE': {
              const dept = draft.departments.find(d => d.id === action.payload.id);
              if (dept) {
                const old = state.departments.find(d => d.id === action.payload.id);
                if (old) dept.position = castDraft(old.position);
              }
              break;
            }
            case 'ADD_EDGE': {
              const idx = draft.edges.findIndex(e => e.source === action.payload.source && e.target === action.payload.target);
              if (idx !== -1) draft.edges.splice(idx, 1);
              const targetDept = draft.departments.find(d => d.id === action.payload.target);
              if (targetDept) targetDept.parentId = null;
              break;
            }
            case 'DELETE_EDGE': {
              const old = state.edges.find(e => e.id === action.payload);
              if (old) {
                draft.edges.push(castDraft({ ...old }));
                const targetDept = draft.departments.find(d => d.id === old.target);
                if (targetDept) targetDept.parentId = old.source;
              }
              break;
            }
            case 'ADD_EMPLOYEE': {
              const idx = draft.employees.findIndex(e => e.id === action.payload.id);
              if (idx !== -1) draft.employees.splice(idx, 1);
              break;
            }
            case 'UPDATE_EMPLOYEE': {
              const idx = draft.employees.findIndex(e => e.id === action.payload.id);
              if (idx !== -1) {
                const old = state.employees.find(e => e.id === action.payload.id);
                if (old) draft.employees[idx] = castDraft({ ...old });
              }
              break;
            }
            case 'DELETE_EMPLOYEE': {
              const old = state.employees.find(e => e.id === action.payload);
              if (old) draft.employees.push(castDraft({ ...old }));
              break;
            }
            case 'TRANSFER_EMPLOYEE': {
              const emp = draft.employees.find(e => e.id === action.payload.employeeId);
              if (emp) {
                const old = state.employees.find(e => e.id === action.payload.employeeId);
                if (old) emp.departmentId = old.departmentId;
              }
              break;
            }
          }
        });
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      
      return {
        ...newState,
        historyIndex: state.historyIndex - 1,
        hasUnsavedChanges: true,
      };
    });
  },

  redo: () => {
    set(state => {
      if (state.historyIndex >= state.history.length - 1) return state;
      
      const actions = state.history[state.historyIndex + 1];
      const newState = produce(state, draft => {
        actions.forEach(action => {
          switch (action.type) {
            case 'ADD_NODE': {
              draft.departments.push(castDraft({ ...action.payload }));
              if (action.payload.parentId) {
                draft.edges.push({
                  id: uuidv4(),
                  source: action.payload.parentId,
                  target: action.payload.id,
                });
              }
              break;
            }
            case 'UPDATE_NODE': {
              const idx = draft.departments.findIndex(d => d.id === action.payload.id);
              if (idx !== -1) draft.departments[idx] = castDraft({ ...action.payload });
              break;
            }
            case 'DELETE_NODE': {
              const idx = draft.departments.findIndex(d => d.id === action.payload);
              if (idx !== -1) draft.departments.splice(idx, 1);
              draft.edges = draft.edges.filter(e => e.source !== action.payload && e.target !== action.payload);
              draft.employees.forEach(e => {
                if (e.departmentId === action.payload) e.departmentId = null;
              });
              if (draft.selectedNodeId === action.payload) {
                draft.selectedNodeId = null;
              }
              break;
            }
            case 'MOVE_NODE': {
              const dept = draft.departments.find(d => d.id === action.payload.id);
              if (dept) dept.position = castDraft(action.payload.position);
              break;
            }
            case 'ADD_EDGE': {
              draft.edges.push({
                id: uuidv4(),
                source: action.payload.source,
                target: action.payload.target,
              });
              const targetDept = draft.departments.find(d => d.id === action.payload.target);
              if (targetDept) targetDept.parentId = action.payload.source;
              break;
            }
            case 'DELETE_EDGE': {
              const idx = draft.edges.findIndex(e => e.id === action.payload);
              if (idx !== -1) draft.edges.splice(idx, 1);
              break;
            }
            case 'ADD_EMPLOYEE': {
              draft.employees.push(castDraft({ ...action.payload }));
              break;
            }
            case 'UPDATE_EMPLOYEE': {
              const idx = draft.employees.findIndex(e => e.id === action.payload.id);
              if (idx !== -1) draft.employees[idx] = castDraft({ ...action.payload });
              break;
            }
            case 'DELETE_EMPLOYEE': {
              const idx = draft.employees.findIndex(e => e.id === action.payload);
              if (idx !== -1) draft.employees.splice(idx, 1);
              break;
            }
            case 'TRANSFER_EMPLOYEE': {
              const emp = draft.employees.find(e => e.id === action.payload.employeeId);
              if (emp) emp.departmentId = action.payload.departmentId;
              break;
            }
          }
        });
        draft.conflicts = castDraft(detectConflictsInState(draft as AppState));
      });
      
      return {
        ...newState,
        historyIndex: state.historyIndex + 1,
        hasUnsavedChanges: true,
      };
    });
  },

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  setViewport: (viewport) => set({ viewport }),

  importData: (data) => {
    set(state => ({
      ...state,
      departments: data.departments,
      employees: data.employees,
      edges: data.departments
        .filter(d => d.parentId)
        .map(d => ({
          id: uuidv4(),
          source: d.parentId!,
          target: d.id,
        })),
      conflicts: detectConflictsInState({
        ...state,
        departments: data.departments,
        employees: data.employees,
      }),
      history: [],
      historyIndex: -1,
      hasUnsavedChanges: true,
    }));
  },

  exportData: () => {
    const state = get();
    return {
      departments: state.departments,
      employees: state.employees,
      edges: state.edges,
    };
  },

  reset: () => set({ ...initialState }),

  markAsSaved: () => set({ hasUnsavedChanges: false }),

  getDepartmentEmployees: (deptId) => {
    return get().employees.filter(e => e.departmentId === deptId);
  },

  getUnassignedEmployees: () => {
    return get().employees.filter(e => e.departmentId === null);
  },
}));
