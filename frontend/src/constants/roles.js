/**
 * 統一的角色定義與標籤
 */

// 角色列表
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CHIEF: 'chief',
  EXECUTIVE: 'executive',
}

// 角色選項（用於下拉選項、複選框等）
export const ROLE_OPTIONS = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.CHIEF,
  ROLES.EXECUTIVE,
]

// 角色標籤（顯示用）
export const ROLE_MAP = {
  [ROLES.ADMIN]: '系統管理員',
  [ROLES.MANAGER]: '種子負責人',
  [ROLES.CHIEF]: '主管',
  [ROLES.EXECUTIVE]: '公司管理層',
}

// 取得角色標籤
export function getRoleLabel(role) {
  return ROLE_MAP[role] || role
}
