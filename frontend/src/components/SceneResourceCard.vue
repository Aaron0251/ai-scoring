<template>
  <div class="scene-res-card">
    <!-- 頂部：編號 + Org標籤 -->
    <div class="card-top">
      <span class="card-itemno">{{ scene.itemNo }}</span>
      <el-tag v-if="orgName" size="small" type="info" class="org-tag">{{ orgName }}</el-tag>
    </div>

    <!-- 場景名稱 -->
    <div class="card-title">{{ scene.sceneName }}</div>

    <!-- 資訊列 -->
    <div class="card-body">
      <div v-if="scene.developMethod" class="info-row">
        <span class="info-label">開發方式</span>
        <span class="info-value">{{ scene.developMethod }}</span>
      </div>
      <div v-if="owners" class="info-row">
        <span class="info-label">負責人</span>
        <span class="info-value">{{ owners }}</span>
      </div>
      <div v-if="scene.goLiveDate" class="info-row">
        <span class="info-label">上線日期</span>
        <span class="info-value">{{ formatDate(scene.goLiveDate) }}</span>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="card-footer">
      <el-button size="small" text type="primary" @click="viewScene">查看詳情 →</el-button>
      <el-select
        v-if="canEdit"
        :model-value="scene.resourceCategoryId"
        size="small"
        placeholder="設定分類"
        clearable
        style="width:110px"
        @change="(val) => $emit('assign-category', scene.id, val ?? null)"
      >
        <el-option
          v-for="cat in categories"
          :key="cat.id"
          :label="cat.name"
          :value="cat.id"
        />
      </el-select>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  scene:      { type: Object, required: true },
  canEdit:    { type: Boolean, default: false },
  categories: { type: Array,  default: () => [] },
})
const emit = defineEmits(['assign-category'])
const router = useRouter()

const orgName = computed(() =>
  props.scene.section?.name || props.scene.department?.name || props.scene.division?.name
)

const owners = computed(() => {
  const parts = []
  if (props.scene.taskOwners) parts.push(props.scene.taskOwners)
  return parts.join('')
})

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`
}

function viewScene() {
  router.push({ path: '/scenes', query: { keyword: props.scene.itemNo } })
}
</script>

<style scoped>
.scene-res-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .05);
  transition: box-shadow .2s, border-color .2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.scene-res-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, .09);
  border-color: #c7d2fe;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-itemno {
  font-size: 11px;
  color: #94a3b8;
  font-family: monospace;
  font-weight: 600;
}
.org-tag { flex-shrink: 0; }

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  word-break: break-all;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.info-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
}
.info-label {
  color: #94a3b8;
  flex-shrink: 0;
  min-width: 48px;
}
.info-value {
  color: #475569;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
  margin-top: auto;
}
</style>
