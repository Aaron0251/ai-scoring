/**
 * 存取控制共用工具
 * 規則：
 *   - admin / boss / executive → 無限制（看全部）
 *   - 其他角色，無任何組織指定 → 無限制（看全部）
 *   - 有 divisionId → 限制在該本部底下所有部門
 *   - 有 departmentId（無 divisionId）→ 限制在該部門
 */

const prisma = require('../prisma');

/**
 * 回傳使用者可存取的部門 ID 清單
 *   null       = 無限制（看全部）
 *   number[]   = 只能看這些部門 ID
 */
async function getAccessibleDeptIds(user) {
  if (!user) return null;

  const roles = Array.isArray(user.roles)
    ? user.roles
    : JSON.parse(user.roles || '[]');

  // 高權限角色無限制
  if (roles.includes('admin') || roles.includes('boss') || roles.includes('executive')) {
    return null;
  }

  // 未指定任何組織 → 看全部
  if (!user.divisionId && !user.departmentId) {
    return null;
  }

  // 指定本部 → 該本部所有部門
  if (user.divisionId) {
    const depts = await prisma.department.findMany({
      where: { divisionId: user.divisionId },
      select: { id: true },
    });
    return depts.map(d => d.id);
  }

  // 只指定部門
  if (user.departmentId) return [user.departmentId];

  return null;
}

/**
 * 根據 allowedDeptIds 建立 Prisma Scene WHERE 片段
 * 用於加入現有 where 條件中
 */
function deptFilter(allowedDeptIds) {
  if (allowedDeptIds === null) return {};
  return { departmentId: { in: allowedDeptIds } };
}

module.exports = { getAccessibleDeptIds, deptFilter };
