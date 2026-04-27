/**
 * 系統功能清單定義（前端版）
 * 此為唯一功能來源，新增功能時在此加入即可自動出現在角色設定介面
 *
 * key: 唯一識別碼（對應 router name 與後端 featureKey）
 * label: 顯示名稱
 * path: 對應路由路徑
 * icon: Element Plus icon 名稱
 * category: 分類群組
 * defaultRoles: 預設有權限的角色（初始化用）
 * alwaysVisible: 永遠顯示（如 profile、not-found）
 */

export const FEATURES = [
  // ── 主要功能 ────────────────────────────────
  {
    category: '主要功能',
    key: 'dashboard',
    label: '總覽',
    path: '/dashboard',
    icon: 'DataAnalysis',
    defaultRoles: ['admin', 'manager', 'executive', 'chief'],
  },
  {
    category: '主要功能',
    key: 'scenes',
    label: '場景管理',
    path: '/scenes',
    icon: 'Document',
    defaultRoles: ['admin', 'manager', 'executive', 'chief'],
  },
    {
    category: '主要功能',
    key: 'leader-tracking',
    label: '種子負責人場景追蹤',
    path: '/leader-tracking',
    icon: 'UserFilled',
    defaultRoles: ['admin', 'manager', 'executive', 'chief'],
  },
  {
    category: '主要功能',
    key: 'weekly-tracking',
    label: '各本部週進度追蹤',
    path: '/weekly-tracking',
    icon: 'Calendar',
    defaultRoles: ['admin', 'manager', 'executive', 'chief'],
  },
  {
    category: '主要功能',
    key: 'import',
    label: 'Excel 批次匯入',
    path: '/import',
    icon: 'Upload',
    defaultRoles: ['admin', 'manager'],
  },
  // ── 系統管理 ────────────────────────────────
  {
    category: '系統管理',
    key: 'admin-users',
    label: '使用者管理',
    path: '/admin/users',
    icon: 'User',
    defaultRoles: ['admin'],
  },
  {
    category: '系統管理',
    key: 'admin-org',
    label: '組織架構管理',
    path: '/admin/org',
    icon: 'OfficeBuilding',
    defaultRoles: ['admin'],
  },
  {
    category: '系統管理',
    key: 'admin-config',
    label: '目標設定',
    path: '/admin/config',
    icon: 'Setting',
    defaultRoles: ['admin'],
  },
  {
    category: '系統管理',
    key: 'admin-role-permissions',
    label: '角色功能設定',
    path: '/admin/role-permissions',
    icon: 'Lock',
    defaultRoles: ['admin'],
  },
];

// 取得某 featureKey 的資訊
export function getFeature(key) {
  return FEATURES.find(f => f.key === key) || null;
}

// 分組
export function getFeaturesByCategory() {
  const groups = {};
  for (const f of FEATURES) {
    if (!groups[f.category]) groups[f.category] = [];
    groups[f.category].push(f);
  }
  return groups;
}
