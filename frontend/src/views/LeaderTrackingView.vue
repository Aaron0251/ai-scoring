<template>
  <AppLayout>
    <div class="leader-tracking">
      <!-- 頁面標題 -->
      <div class="page-header">
        <div>
          <h2 class="page-title">
            <el-icon><UserFilled /></el-icon>
            種子負責人場景追蹤
          </h2>
          <div class="page-subtitle">掌握各種子負責人的 AI 場景推動進度</div>
        </div>
        <el-button :loading="loading" @click="loadLeaders">
          <el-icon><Refresh /></el-icon> 重新整理
        </el-button>
      </div>

      <!-- 載入中 -->
      <div v-if="loading" class="loading-wrapper">
        <el-skeleton :rows="4" animated />
      </div>

      <!-- 錯誤 -->
      <el-alert v-else-if="error" :title="error" type="error" show-icon :closable="false" />

      <!-- 主內容 -->
      <template v-else>
        <!-- 搜尋篩選列 -->
        <div class="filter-bar">
          <el-input
            v-model="searchKeyword"
            placeholder="搜尋種子負責人姓名..."
            clearable
            prefix-icon="Search"
            class="search-input"
          />
          <el-select v-model="filterDivision" placeholder="篩選本部" clearable class="division-select">
            <el-option
              v-for="div in divisionOptions"
              :key="div"
              :label="div"
              :value="div"
            />
          </el-select>
        </div>

        <!-- 無資料 -->
        <el-empty v-if="filteredLeaders.length === 0" description="暫無種子負責人資料" />

        <!-- 種子負責人卡片列表 -->
        <div class="leaders-grid">
          <div
            v-for="leader in filteredLeaders"
            :key="leader.name"
            class="leader-card"
          >
            <!-- 🟢 第一層：種子負責人概覽 -->
            <div class="leader-header" @click="toggleLeader(leader.name)">
              <div class="leader-info">
                <div class="leader-avatar">
                  <el-icon size="20"><User /></el-icon>
                </div>
                <div class="leader-meta">
                  <div class="leader-name">{{ leader.name }}</div>
                  <div class="leader-org">
                    <span v-if="leader.division">{{ leader.division.name }}</span>
                    <span v-if="leader.department" class="org-sep">›</span>
                    <span v-if="leader.department">{{ leader.department.name }}</span>
                    <span v-if="leader.section" class="org-sep">›</span>
                    <span v-if="leader.section">{{ leader.section.name }}</span>
                  </div>
                </div>
              </div>

              <!-- 場景統計徽章 -->
              <div class="scene-stats">
                <el-badge :value="leader.sceneStats.total" type="info">
                  <span class="stat-label">總場景</span>
                </el-badge>
                <el-badge :value="leader.sceneStats.inProgress" type="primary">
                  <span class="stat-label">進行中</span>
                </el-badge>
                <el-badge :value="leader.sceneStats.planning" type="warning">
                  <span class="stat-label">規劃中</span>
                </el-badge>
              </div>

              <el-icon class="expand-icon" :class="{ rotated: expandedLeaders.has(leader.name) }">
                <ArrowDown />
              </el-icon>
            </div>

            <!-- 🔵 第二層：場景清單卡片 (展開後顯示) -->
            <transition name="slide-down">
              <div v-if="expandedLeaders.has(leader.name)" class="scenes-wrapper">
                <!-- 無場景 -->
                <div v-if="leader.scenes.length === 0" class="no-scenes">
                  <el-icon><InfoFilled /></el-icon>
                  此本部目前無 AI 場景
                </div>

                <!-- 場景卡片 -->
                <div
                  v-for="scene in leader.scenes"
                  :key="scene.id"
                  class="scene-card"
                  @click="goToDetail(scene.id)"
                >
                  <!-- 場景標題行 -->
                  <div class="scene-card-header">
                    <div class="scene-title-group">
                      <span class="scene-item-no">{{ scene.itemNo }}</span>
                      <span class="scene-name">{{ scene.sceneName }}</span>
                    </div>
                    <el-tag :type="statusTagType(scene.status)" size="small">{{ scene.status }}</el-tag>
                  </div>

                  <!-- 進度條 -->
                  <div class="scene-progress-row">
                    <el-progress
                      :percentage="scene.progress"
                      :color="progressColor(scene.progress)"
                      :stroke-width="10"
                      :show-text="true"
                    />
                  </div>

                  <!-- 最新日誌摘要 -->
                  <div v-if="scene.latestLog" class="scene-latest-log">
                    <span class="log-dot" :class="logDotClass(scene.latestLog.status)" />
                    <span class="log-date">{{ formatDate(scene.latestLog.logDate) }}</span>
                    <span class="log-status-text">{{ scene.latestLog.status }}</span>
                    <span class="log-content">{{ truncate(scene.latestLog.content, 40) }}</span>
                  </div>
                  <div v-else class="scene-no-log">
                    <el-icon size="12"><InfoFilled /></el-icon> 尚無執行日誌
                  </div>

                  <!-- 查看詳情提示 -->
                  <div class="scene-card-footer">
                    <span>查看詳情</span>
                    <el-icon size="12"><ArrowRight /></el-icon>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import api from '../api/index.js'
import { UserFilled, User, ArrowDown, ArrowRight, InfoFilled, Refresh } from '@element-plus/icons-vue'

const router = useRouter()

const leaders       = ref([])
const loading       = ref(true)
const error         = ref('')
const searchKeyword = ref('')
const filterDivision = ref('')
const expandedLeaders = ref(new Set())

// 本部篩選選項
const divisionOptions = computed(() => {
  const divs = new Set()
  for (const l of leaders.value) {
    if (l.division?.name) divs.add(l.division.name)
  }
  return [...divs].sort()
})

// 篩選後的種子負責人
const filteredLeaders = computed(() => {
  return leaders.value.filter(l => {
    const matchName = !searchKeyword.value || l.name.includes(searchKeyword.value)
    const matchDiv  = !filterDivision.value || l.division?.name === filterDivision.value
    return matchName && matchDiv
  })
})

function toggleLeader(id) {
  if (expandedLeaders.value.has(id)) {
    expandedLeaders.value.delete(id)
  } else {
    expandedLeaders.value.add(id)
  }
  // 觸發響應式更新
  expandedLeaders.value = new Set(expandedLeaders.value)
}

function goToDetail(sceneId) {
  router.push({ name: 'leader-scene-detail', params: { id: sceneId } })
}

// 狀態標籤顏色
function statusTagType(status) {
  const map = { '進行中': 'primary', '規劃中': 'warning', '已完成': 'success', '暫停': 'info' }
  return map[status] || 'info'
}

// 進度條顏色
function progressColor(pct) {
  if (pct >= 80) return '#67c23a'
  if (pct >= 50) return '#409eff'
  if (pct >= 20) return '#e6a23c'
  return '#909399'
}

// 日誌圓點樣式
function logDotClass(status) {
  if (!status) return 'dot-gray'
  if (status.includes('成功') || status.includes('完成')) return 'dot-green'
  if (status.includes('失敗') || status.includes('錯誤')) return 'dot-red'
  return 'dot-gray'
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function truncate(str, maxLen) {
  if (!str) return ''
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str
}

async function loadLeaders() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/leader-tracking')
    leaders.value = data
  } catch (e) {
    error.value = e.response?.data?.error || '載入失敗，請重試'
  } finally {
    loading.value = false
  }
}

onMounted(loadLeaders)
onActivated(loadLeaders)
</script>

<style scoped>
.leader-tracking {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 0 40px;
}

/* 頁面標題 */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.4rem;
  font-weight: 700;
  color: #303133;
  margin: 0 0 4px;
}
.page-subtitle {
  font-size: 0.875rem;
  color: #909399;
}

/* 篩選列 */
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.search-input {
  flex: 1;
  min-width: 200px;
}
.division-select {
  min-width: 150px;
}

/* 種子負責人卡片 */
.leaders-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.leader-card {
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  transition: box-shadow 0.2s;
}
.leader-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

/* 種子負責人 header */
.leader-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.leader-header:hover {
  background: #f5f7fa;
}

.leader-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.leader-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff, #67c23a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.leader-meta {
  min-width: 0;
}
.leader-name {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
}
.leader-org {
  font-size: 0.75rem;
  color: #909399;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 2px;
}
.org-sep {
  color: #c0c4cc;
}

.scene-stats {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}
.stat-label {
  font-size: 0.7rem;
  color: #606266;
}

.expand-icon {
  flex-shrink: 0;
  color: #c0c4cc;
  transition: transform 0.25s;
}
.expand-icon.rotated {
  transform: rotate(180deg);
}

/* 場景清單 */
.scenes-wrapper {
  border-top: 1px solid #f0f0f0;
  padding: 12px;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.no-scenes {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #c0c4cc;
  font-size: 0.85rem;
  padding: 8px 0;
}

/* 場景卡片 */
.scene-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.scene-card:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64,158,255,0.15);
  transform: translateY(-1px);
}

.scene-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.scene-title-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
}
.scene-item-no {
  font-size: 0.75rem;
  font-weight: 700;
  color: #409eff;
  background: #ecf5ff;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.scene-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #303133;
}

.scene-progress-row {
  margin-bottom: 8px;
}

/* 摘要日誌 */
.scene-latest-log {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: #606266;
  flex-wrap: wrap;
}
.log-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-green { background: #67c23a; }
.dot-red   { background: #f56c6c; }
.dot-gray  { background: #c0c4cc; }

.log-date { color: #909399; white-space: nowrap; }
.log-status-text {
  padding: 0 4px;
  background: #f0f2f5;
  border-radius: 3px;
  white-space: nowrap;
}
.log-content { color: #606266; }

.scene-no-log {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: #c0c4cc;
}

.scene-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 0.75rem;
  color: #409eff;
  margin-top: 8px;
}

/* 載入 */
.loading-wrapper {
  padding: 20px 0;
}

/* 展開動畫 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 2000px;
  opacity: 1;
}

/* ── 手機版字體放大 ── */
@media (max-width: 768px) {
  .leader-name { font-size: 1.25rem; }
  .leader-org { font-size: 1rem; color: #606266; }
  .stat-label { font-size: 0.9rem; }
  .scene-name { font-size: 1.05rem; }
  .scene-item-no { font-size: 0.9rem; }
  .scene-latest-log { font-size: 0.95rem; }
  .scene-no-log { font-size: 0.95rem; }
  .scene-card-footer { font-size: 0.9rem; }
  .leader-header { padding: 16px 14px; gap: 10px; }
  .leader-avatar { width: 48px; height: 48px; }
  .scene-card { padding: 14px 12px; }
  .page-title { font-size: 1.3rem; }
  .page-subtitle { font-size: 1.05rem; }
  .filter-bar { gap: 8px; flex-direction: column; }
  .search-input, .division-select { min-width: 0; width: 100%; }
  /* 統計 badge 保持顯示，換行排列 */
  .scene-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex-shrink: 0;
  }
}

/* ≤600px 額外調整 */
@media (max-width: 600px) {
  .leader-header {
    flex-wrap: wrap;
    padding: 14px 12px;
  }
  .leader-info {
    width: 100%;
  }
  .scene-stats {
    display: flex;
    gap: 8px;
  }
  .expand-icon {
    margin-left: auto;
  }
}
</style>
