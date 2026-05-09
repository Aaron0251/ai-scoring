<template>
  <div class="tool-card" :class="{ 'is-favorite': tool.isFavorite }">
    <!-- 卡片頭 -->
    <div class="card-header">
      <div class="card-title">{{ tool.name }}</div>
      <div class="card-actions">
        <el-tooltip :content="tool.isFavorite ? '從最愛移除' : '加入最愛'" placement="top">
          <el-icon class="fav-btn" :class="{ active: tool.isFavorite }" @click="$emit('toggle-fav', tool)">
            <StarFilled v-if="tool.isFavorite" /><Star v-else />
          </el-icon>
        </el-tooltip>
        <template v-if="canEdit">
          <el-icon class="action-btn" @click="$emit('edit', tool)"><Edit /></el-icon>
          <el-popconfirm title="確定刪除此工具卡片？" @confirm="$emit('delete', tool.id)">
            <template #reference>
              <el-icon class="action-btn danger"><Delete /></el-icon>
            </template>
          </el-popconfirm>
        </template>
      </div>
    </div>

    <!-- 描述 -->
    <div v-if="tool.description" class="card-desc">{{ tool.description }}</div>

    <!-- 組織標籤 -->
    <div class="card-org" v-if="tool.section || tool.department || tool.division">
      <el-tag size="small" type="info">
        {{ tool.section?.name || tool.department?.name || tool.division?.name }}
      </el-tag>
    </div>

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
  if (item.itemType === 'url') emit('open-url', item.url)
  else emit('download', item)
}

function itemIcon(type) {
  return { url: 'Link', pdf: 'Document', excel: 'Grid', video: 'VideoPlay', image: 'Picture', text: 'Memo' }[type] || 'Document'
}
function itemTypeLabel(type) {
  return { url: '網址', pdf: 'PDF', excel: 'Excel', video: '影片', image: '圖片', text: '文字' }[type] || type
}
function itemTagType(type) {
  return { url: 'primary', pdf: 'danger', excel: 'success', video: 'warning', image: '', text: 'info' }[type] || ''
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

.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.card-title  { font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; word-break: break-all; }
.card-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.fav-btn { font-size: 17px; cursor: pointer; color: #cbd5e1; transition: color .15s, transform .15s; }
.fav-btn:hover { color: #fbbf24; transform: scale(1.15); }
.fav-btn.active { color: #f59e0b; }
.action-btn { font-size: 14px; cursor: pointer; color: #94a3b8; }
.action-btn:hover { color: #6366f1; }
.action-btn.danger:hover { color: #ef4444; }

.card-desc { font-size: 12px; color: #64748b; margin-bottom: 8px; line-height: 1.5; }
.card-org  { margin-bottom: 10px; }

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
