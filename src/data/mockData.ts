import { v4 as uuidv4 } from 'uuid';
import { Department, Employee } from '../types';

const ceoId = uuidv4();
const cooId = uuidv4();
const ctoId = uuidv4();
const cfoId = uuidv4();
const hrId = uuidv4();
const techId = uuidv4();
const productId = uuidv4();
const salesId = uuidv4();
const marketingId = uuidv4();
const financeId = uuidv4();
const frontendId = uuidv4();
const backendId = uuidv4();
const qaId = uuidv4();

export const mockDepartments: Department[] = [
  {
    id: ceoId,
    code: 'D001',
    name: '首席执行官办公室',
    parentId: null,
    managerId: null,
    status: 'normal',
    description: '公司最高管理层',
    position: { x: 600, y: 50 },
  },
  {
    id: cooId,
    code: 'D002',
    name: '运营中心',
    parentId: ceoId,
    managerId: null,
    status: 'normal',
    description: '负责公司整体运营',
    position: { x: 150, y: 200 },
  },
  {
    id: ctoId,
    code: 'D003',
    name: '技术中心',
    parentId: ceoId,
    managerId: null,
    status: 'normal',
    description: '负责产品研发与技术支持',
    position: { x: 450, y: 200 },
  },
  {
    id: cfoId,
    code: 'D004',
    name: '财务中心',
    parentId: ceoId,
    managerId: null,
    status: 'normal',
    description: '负责财务管理与风控',
    position: { x: 750, y: 200 },
  },
  {
    id: hrId,
    code: 'D005',
    name: '人力资源部',
    parentId: cooId,
    managerId: null,
    status: 'normal',
    description: '负责招聘、培训与绩效管理',
    position: { x: 50, y: 380 },
  },
  {
    id: salesId,
    code: 'D006',
    name: '销售部',
    parentId: cooId,
    managerId: null,
    status: 'normal',
    description: '负责产品销售与客户关系',
    position: { x: 250, y: 380 },
  },
  {
    id: marketingId,
    code: 'D007',
    name: '市场部',
    parentId: cooId,
    managerId: null,
    status: 'preparing',
    description: '负责品牌推广与市场营销',
    position: { x: 50, y: 550 },
  },
  {
    id: techId,
    code: 'D008',
    name: '研发部',
    parentId: ctoId,
    managerId: null,
    status: 'normal',
    description: '负责产品研发',
    position: { x: 350, y: 380 },
  },
  {
    id: productId,
    code: 'D009',
    name: '产品部',
    parentId: ctoId,
    managerId: null,
    status: 'normal',
    description: '负责产品规划与设计',
    position: { x: 550, y: 380 },
  },
  {
    id: financeId,
    code: 'D010',
    name: '会计部',
    parentId: cfoId,
    managerId: null,
    status: 'normal',
    description: '负责财务核算',
    position: { x: 750, y: 380 },
  },
  {
    id: frontendId,
    code: 'D011',
    name: '前端组',
    parentId: techId,
    managerId: null,
    status: 'normal',
    description: '负责前端开发',
    position: { x: 250, y: 550 },
  },
  {
    id: backendId,
    code: 'D012',
    name: '后端组',
    parentId: techId,
    managerId: null,
    status: 'normal',
    description: '负责后端开发',
    position: { x: 450, y: 550 },
  },
  {
    id: qaId,
    code: 'D013',
    name: '测试组',
    parentId: techId,
    managerId: null,
    status: 'revoked',
    description: '负责质量测试（已撤销）',
    position: { x: 650, y: 550 },
  },
];

const firstNames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高'];
const lastNames = ['伟', '芳', '娜', '敏', '静', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明'];
const positions = ['工程师', '高级工程师', '主管', '经理', '总监', '专员', '助理', '分析师', '设计师'];

const generateEmployee = (index: number, deptId: string | null): Employee => {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const position = positions[Math.floor(Math.random() * positions.length)];
  const employeeNum = String(index + 1).padStart(4, '0');
  
  return {
    id: uuidv4(),
    employeeId: `EMP${employeeNum}`,
    name: `${firstName}${lastName}`,
    departmentId: deptId,
    position,
    phone: `138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    email: `emp${employeeNum}@company.com`,
  };
};

export const generateMockEmployees = (departments: Department[]): Employee[] => {
  const employees: Employee[] = [];
  let empIndex = 0;
  
  departments.forEach(dept => {
    if (dept.status !== 'revoked') {
      const empCount = Math.floor(Math.random() * 8) + 3;
      for (let i = 0; i < empCount; i++) {
        employees.push(generateEmployee(empIndex++, dept.id));
      }
    }
  });
  
  for (let i = 0; i < 15; i++) {
    employees.push(generateEmployee(empIndex++, null));
  }
  
  const deptIds = departments.filter(d => d.status !== 'revoked').map(d => d.id);
  departments.forEach(dept => {
    if (dept.status !== 'revoked') {
      const deptEmps = employees.filter(e => e.departmentId === dept.id);
      if (deptEmps.length > 0) {
        const manager = deptEmps[Math.floor(Math.random() * deptEmps.length)];
        dept.managerId = manager.id;
      }
    }
  });
  
  return employees;
};

export const mockEmployees = generateMockEmployees(mockDepartments);
