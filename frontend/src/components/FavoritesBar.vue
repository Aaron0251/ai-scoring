<template>
  <div class="fav-bar">
    <el-icon class="fav-bar-icon"><StarFilled /></el-icon>
    <span class="fav-bar-label">我的最愛：</span>

    <!-- 未分組 -->
    <div
      v-for="fav in noFolder"
      :key="fav.id"
      class="fav-chip"
      @click="openTool(fav)"
      :title="fav.tool?.name"
    >
      <el-icon><Link /></el-icon>
      {{ fav.tool?.name }}
      <el-icon class="chip-close" @click.stop="$emit('remove', fav.toolId)"><Close /></el-icon>
    </div>

    <!-- 資料夾 -->
    <el-dropdown
      v-for="(items, folder) in folderMap"
      :key="folder"
      trigger="click"
    >
      <div class="fav-chip folder-chip">
        <el-icon><Folder /></el-icon>
        {{ folder }}
        <el-icon class="chip-arrow"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="fav in items"
            :key="fav.id"
            @click="openTool(fav)"
          >
            <el-icon><Link /></el-icon>
            {{ fav.tool?.name }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 編輯資料夾 -->
    <el-tooltip content="設定資料夾" placement="top">
      <el-icon class="fav-bar-setting" @click="openManage = true"><Setting /></el-icon>
    </el-tooltip>

    <!-- 管理最愛 Dialog -->
    <el-dialog v-model="openManage" title="管理我的最愛" width="480px" destroy-on-close>
      <el-table :data="favoritesRef" size="small">
        <el-table-column prop="tool.name" label="名稱" min-width="120" />
        <el-table-column label="資料夾" min-width="140">
          <template #default="{ row }">
            <el-input
              v-model="row.folderName"
              placeholder="無資料夾"
              size="small"
              clearable
              @change="updateFolder(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="移除" width="70" align="center">
          <template #default="{ row }">
            <el-button
              type="danger"
              size="small"
              text
              @click="$emit('remove', row.toolId); openManage = false"
            >移除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../api/index.js'

const props = defineProps({
  favorites: { type: Array, default: () => [] },
})
const emit = defineEmits(['remove', 'update-folder'])

const favoritesRef = computed(() => props.favorites)

const noFolder = computed(() => favoritesRef.value.filter(f => !f.folderName))
const folderMap = computed(() => {
  const map = {}
  for (const f of favoritesRef.value) {
    if (f.folderName) {
      if (!map[f.folderName]) map[f.folderName] = []
      map[f.folderName].push(f)
    }
  }
  return map
})

function openTool(fav) {
  const url = fav.tool?.items?.[0]?.url
  if (!url) return ElMessage.info('此工具沒有網址')
  window.open(url.startsWith('http') ? url : 'https://' + url, '_blank')
}

const openManage = ref(false)

async function updateFolder(row) {
  try {
    await api.put(`/resource-library/favorites/${row.id}/folder`, {
      folderName: row.folderName || null,
    })
    emit('update-folder')
  } catch (e) {
    ElMessage.error('更新失敗')
  }
}
</script>

<style scoped>
.fav-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 6px 12px;
  margin-bottom: 16px;
  font-size: 13px;
}
.fav-bar-icon {
  color: #f59e0b;
  font-size: 16px;
  flex-shrink: 0;
}
.fav-bar-label {
  color: #92400e;
  font-weight: 600;
  margin-right: 4px;
  flex-shrink: 0;
}
.fav-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 2px 10px 2px 8px;
  cursor: pointer;
  color: #475569;
  font-size: 12px;
  transition: border-color .15s, background .15s;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fav-chip:hover {
  border-color: #6366f1;
  background: #f5f3ff;
  color: #6366f1;
}
.chip-close {
  font-size: 11px;
  color: #cbd5e1;
  margin-left: 2px;
  flex-shrink: 0;
}
.chip-close:hover { color: #ef4444; }
.folder-chip { background: #eff6ff; border-color: #bfdbfe; }
.chip-arrow { font-size: 11px; color: #94a3b8; margin-left: 2px; }
.fav-bar-setting {
  margin-left: auto;
  font-size: 15px;
  color: #94a3b8;
  cursor: pointer;
  flex-shrink: 0;
}
.fav-bar-setting:hover { color: #6366f1; }
</style>
