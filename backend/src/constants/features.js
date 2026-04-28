/**
 * 系統功能清單定義
 * 這是唯一的功能來源，新增功能時只需在此加入一筆即可自動出現在角色設定介面
 *
 * category: 分類群組（用於 UI 分組顯示）
 * key: 唯一識別碼（對應 frontend router name / DB featureKey）
 * label: 顯示名稱
 * defaultRoles: 預設有權限的角色（首次初始化時使用）
 */

const FEATURES = [
  // ── 主要功能 ────────────────────────────────
  {
    category: '主要功能',
    key: 'dashboard',
    label: '總覽',
    defaultRoles: ['admin', 'manager', 'executive', 'chief', 'boss'],
  },
  {
    category: '主要功能',
    key: 'scenes',
    label: '場景管理',
    defaultRoles: ['admin', 'manager', 'executive', 'chief', 'boss'],
  },
  {
    category: '主要功能',
    key: 'leader-tracking',
    label: '種子負責人場景追蹤',
    defaultRoles: ['admin', 'manager', 'executive', 'chief', 'boss'],
  },
  {
    category: '主要功能',
    key: 'weekly-tracking',
    label: '各本部週進度追蹤',
    defaultRoles: ['admin', 'manager', 'executive', 'chief', 'boss'],
  },
  {
    category: '主要功能',
    key: 'import',
    label: 'Excel 批次匯入',
    defaultRoles: ['admin', 'manager', 'chief', 'boss'],
  },
  // ── 系統管理 ────────────────────────────────
  {
    category: '系統管理',
    key: 'admin-users',
    label: '使用者管理',
    defaultRoles: ['admin'],
  },
  {
    category: '系統管理',
    key: 'admin-org',
    label: '組織架構管理',
    defaultRoles: ['admin'],
  },
  {
    category: '系統管理',
    key: 'admin-config',
    label: '目標設定',
    defaultRoles: ['admin'],
  },
  {
    category: '系統管理',
    key: 'admin-role-permissions',
    label: '角色功能設定',
    defaultRoles: ['admin'],
  },
];

module.exports = { FEATURES };
