<template>
  <div class="tool-card" :class="{ 'is-favorite': tool.isFavorite, 'is-scene': !!tool.sceneId }">
    <!-- 卡片頭 -->
    <div class="card-header">
      <div class="card-title-wrap">
        <!-- 場景代號 badge -->
        <div v-if="tool.scene" class="scene-badge">
          <el-tag size="small" type="success" effect="light">🔗 {{ tool.scene.itemNo }}</el-tag>
        </div>
        <div class="card-title">{{ tool.name }}</div>
      </div>
      <div class="card-actions">
        <el-tooltip :content="tool.isFavorite ? '從最愛移除' : '加入最愛'" placement="top">
          <el-icon class="fav-btn" :class="{ active: tool.isFavorite }" @click="$emit('toggle-fav', tool)">
            <StarFilled v-if="tool.isFavorite" /><Star v-else />
          </el-icon>
        </el-tooltip>
        <template v-if="canEdit">
          <el-icon class="action-btn" @click="$emit('edit', tool)"><Edit /></el-icon>
          <!-- 場景綁定卡：禁止直接刪除，改為說明提示 -->
          <el-tooltip v-if="tool.sceneId"
            content="此卡片由場景自動建立，如需隱藏請將場景狀態改回「進行中」"
            placement="top">
            <el-icon class="action-btn danger disabled"><Delete /></el-icon>
          </el-tooltip>
          <el-popconfirm v-else title="確定刪除此工具卡片？" @confirm="$emit('delete', tool.id)">
            <template #reference>
              <el-icon class="action-btn danger"><Delete /></el-icon>
            </template>
          </el-popconfirm>
        </template>
      </div>
    </div>

    <!-- 組織標籤 + 負責人（同一列） -->
    <div class="card-org" v-if="tool.section || tool.department || tool.division || tool.scene?.taskOwners">
      <el-tag v-if="tool.section || tool.department || tool.division" size="small" type="info">
        {{ tool.section?.name || tool.department?.name || tool.division?.name }}
      </el-tag>
      <span v-if="tool.scene?.taskOwners" class="owners-inline">
        <span class="owners-label">負責人</span>
        <span class="owners-value">{{ tool.scene.taskOwners }}</span>
      </span>
    </div>

    <!-- 描述：優先顯示手動填寫的 description，否則顯示場景開發方式 -->
    <div v-if="tool.description" class="card-desc">{{ tool.description }}</div>
    <div v-else-if="tool.scene?.developMethod" class="card-desc scene-desc">{{ tool.scene.developMethod }}</div>

    <!-- 資源項目 -->
    <div class="items-list">
      <div v-for="item in tool.items" :key="item.id" class="item-row">
        <el-icon class="item-icon"><component :is="itemIcon(item.itemType)" /></el-icon>
        <span class="item-link" @click="handleClick(item)">{{ item.name }}</span>
        <el-tag size="small" :type="itemTagType(item.itemType)" class="item-type-tag">
          {{ itemTypeLabel(item.itemType) }}
        </el-tag>
        <template v-if="canEdit">
          <el-popconfirm title="確定刪除此項目？" @confirm="$emit('delete-item', tool.id, item.id)">
            <template #reference>
              <el-icon class="item-del"><Close /></el-icon>
            </template>
          </el-popconfirm>
        </template>
      </div>
      <!-- 新增資源 -->
      <div v-if="canEdit" class="add-item-row" @click="$emit('add-item', tool)">
        <el-icon><Plus /></el-icon><span>新增資源</span>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  tool:    { type: Object, required: true },
  canEdit: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle-fav','edit','delete','add-item','delete-item','open-url','download'])

function handleClick(item) {
  if (item.itemType === 'url' || item.itemType === 'video_url') emit('open-url', item.url)
  else emit('download', item)
}

function itemIcon(type) {
  return { url: 'Link', video_url: 'VideoPlay', pdf: 'Document', excel: 'Grid', video: 'VideoCamera', image: 'Picture', text: 'Memo' }[type] || 'Document'
}
function itemTypeLabel(type) {
  return { url: '網址', video_url: '影片連結', pdf: 'PDF', excel: 'Excel', video: '影片檔', image: '圖片', text: '文字' }[type] || type
}
function itemTagType(type) {
  return { url: 'primary', video_url: 'danger', pdf: 'danger', excel: 'success', video: 'warning', image: '', text: 'info' }[type] || ''
}
</script>

<style scoped>
.tool-card {
  background: #fff; border-radius: 12px; padding: 14px;
  border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,.05);
  transition: box-shadow .2s, border-color .2s;
}
.tool-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.09); border-color: #c7d2fe; }
.tool-card.is-favorite { border-color: #fbbf24; box-shadow: 0 2px 8px rgba(251,191,36,.2); }
/* 場景自動建立的卡片：左上角顯示淡綠邊 */
.tool-card.is-scene { border-left: 3px solid #86efac; }

.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.card-title-wrap { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.scene-badge { line-height: 1; }
.card-title  { font-size: 14px; font-weight: 600; color: #1e293b; word-break: break-all; }
.card-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.fav-btn { font-size: 17px; cursor: pointer; color: #cbd5e1; transition: color .15s, transform .15s; }
.fav-btn:hover { color: #fbbf24; transform: scale(1.15); }
.fav-btn.active { color: #f59e0b; }
.action-btn { font-size: 14px; cursor: pointer; color: #94a3b8; }
.action-btn:hover { color: #6366f1; }
.action-btn.danger:hover { color: #ef4444; }
.action-btn.disabled { color: #d1d5db; cursor: not-allowed; pointer-events: none; }

.card-org    { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.card-desc   { font-size: 12px; color: #64748b; margin-bottom: 6px; line-height: 1.5; }
.scene-desc  { color: #64748b; font-style: italic; }

.owners-inline { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.owners-label  { color: #94a3b8; flex-shrink: 0; }
.owners-value  { color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.items-list { border-top: 1px solid #f1f5f9; padding-top: 8px; display: flex; flex-direction: column; gap: 3px; }
.item-row   { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 5px; font-size: 12px; transition: background .15s; }
.item-row:hover { background: #f8fafc; }
.item-icon  { font-size: 13px; color: #94a3b8; flex-shrink: 0; }
.item-link  { flex: 1; color: #3b82f6; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-link:hover { text-decoration: underline; }
.item-type-tag { flex-shrink: 0; }
.item-del   { font-size: 12px; color: #cbd5e1; cursor: pointer; flex-shrink: 0; }
.item-del:hover { color: #ef4444; }

.add-item-row {
  display: flex; align-items: center; gap: 4px; font-size: 12px; color: #94a3b8;
  padding: 3px 4px; border-radius: 5px; cursor: pointer;
  border: 1px dashed #e2e8f0; margin-top: 4px; transition: border-color .15s, color .15s;
}
.add-item-row:hover { border-color: #6366f1; color: #6366f1; }
</style>
