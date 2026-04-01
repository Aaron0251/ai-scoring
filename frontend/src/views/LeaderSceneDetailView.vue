<template>
  <AppLayout>
    <div class="leader-scene-detail" ref="pageRef">
      <!-- 載入中 -->
      <div v-if="loading" class="loading-wrapper">
        <el-skeleton :rows="6" animated />
      </div>

      <!-- 錯誤 -->
      <el-alert v-else-if="error" :title="error" type="error" show-icon :closable="false" />

      <!-- 主內容 -->
      <template v-else-if="scene">
        <!-- ── 固定標題列（向上滑動後固定頂端）── -->
        <div class="sticky-header" :class="{ 'is-sticky': isSticky }">
          <div class="sticky-breadcrumb">
            <el-button link @click="$router.back()">
              <el-icon><ArrowLeft /></el-icon>
              返回
            </el-button>
            <span class="sticky-item-no">{{ scene.itemNo }}</span>
            <span class="sticky-scene-name">{{ scene.sceneName }}</span>
          </div>
          <div class="sticky-progress">
            <el-progress
              :percentage="scene.progress"
              :color="progressColor(scene.progress)"
              :stroke-width="6"
              :show-text="true"
              style="width: 120px"
            />
            <el-tag :type="statusTagType(scene.status)" size="small">{{ scene.status }}</el-tag>
          </div>
        </div>

        <!-- ── 場景基本資訊卡 ── -->
        <div class="scene-hero">
          <div class="hero-top">
            <div>
              <div class="hero-item-no">{{ scene.itemNo }}</div>
              <div class="hero-name">{{ scene.sceneName }}</div>
            </div>
            <el-tag :type="statusTagType(scene.status)" size="default">{{ scene.status }}</el-tag>
          </div>

          <!-- 組織 + 種子負責人 -->
          <div class="hero-meta">
            <div v-if="scene.department" class="meta-row">
              <el-icon><OfficeBuilding /></el-icon>
              <span>{{ scene.department?.division?.name || '' }}
                <span v-if="scene.department?.name"> › {{ scene.department.name }}</span>
                <span v-if="scene.section?.name"> › {{ scene.section.name }}</span>
              </span>
            </div>
            <div v-if="scene.developMethod" class="meta-row">
              <el-icon><Tools /></el-icon>
              <span>{{ scene.developMethod }}
                <span v-if="scene.developToolDesc"> ({{ scene.developToolDesc }})</span>
              </span>
            </div>
            <div v-if="scene.seedOwners" class="meta-row">
              <el-icon><UserFilled /></el-icon>
              <span>種子負責人：{{ scene.seedOwners }}</span>
            </div>
          </div>

          <!-- 大進度條 -->
          <div class="hero-progress">
            <el-progress
              :percentage="scene.progress"
              :color="progressColor(scene.progress)"
              :stroke-width="14"
              :show-text="true"
            />
          </div>

          <!-- 快速數據 -->
          <div class="hero-quick-stats">
            <div class="qs-item">
              <div class="qs-val">{{ scene.originalHeadcount ?? '-' }} 人</div>
              <div class="qs-label">原作業人數</div>
            </div>
            <div class="qs-divider" />
            <div class="qs-item">
              <div class="qs-val">{{ scene.improvedHeadcount ?? '-' }} 人</div>
              <div class="qs-label">改善後人數</div>
            </div>
            <div class="qs-divider" />
            <div class="qs-item">
              <div class="qs-val">{{ estimatedSavedHours }} 小時</div>
              <div class="qs-label">預計節省</div>
            </div>
          </div>
        </div>

        <!-- ── 快速導航 Tabs ── -->
        <div class="nav-tabs" ref="navTabsRef">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="nav-tab"
            :class="{ active: activeTab === tab.key }"
            @click="scrollToSection(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
        <!-- 🟡 第三層內容 -->
        <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->

        <!-- ① 【置頂】執行日誌歷程 -->
        <div ref="logSectionRef" class="detail-section">
          <div class="section-title">
            <span class="section-icon">🕐</span>
            執行日誌歷程
          </div>

          <div v-if="executionLogs.length === 0" class="empty-logs">
            <el-icon size="24"><Clock /></el-icon>
            <div>尚無執行紀錄</div>
          </div>

          <div v-else class="log-timeline">
            <div
              v-for="(log, idx) in displayedLogs"
              :key="log.id"
              class="log-item"
              :class="{ expanded: expandedLogIds.has(log.id) }"
              @click="toggleLog(log.id)"
            >
              <!-- 時間軸線 -->
              <div class="timeline-left">
                <div class="timeline-dot" :class="logDotClass(log.status)" />
                <div v-if="idx < displayedLogs.length - 1" class="timeline-line" />
              </div>

              <!-- 日誌內容 -->
              <div class="log-content-box">
                <div class="log-header-row">
                  <span class="log-date">{{ formatDateTime(log.logDate) }}</span>
                  <el-tag :type="logTagType(log.status)" size="small">{{ log.status }}</el-tag>
                </div>
                <div class="log-content-preview">{{ truncate(log.content, 60) }}</div>
                <!-- 展開詳情 -->
                <transition name="fade">
                  <div v-if="expandedLogIds.has(log.id)" class="log-detail">
                    <div class="log-full-content">{{ log.content }}</div>
                    <div v-if="log.executor" class="log-meta-row">
                      <el-icon><User /></el-icon> 執行人員：{{ log.executor }}
                    </div>
                    <div v-if="log.note" class="log-meta-row">
                      <el-icon><Comment /></el-icon> 備註：{{ log.note }}
                    </div>
                  </div>
                </transition>
                <div class="log-expand-hint">
                  <el-icon size="12" :class="{ rotated: expandedLogIds.has(log.id) }"><ArrowDown /></el-icon>
                </div>
              </div>
            </div>

            <!-- 查看更多 -->
            <div v-if="executionLogs.length > 5" class="show-more-row">
              <el-button link @click="showAllLogs = !showAllLogs">
                {{ showAllLogs ? '收起' : `查看更多（還有 ${executionLogs.length - 5} 筆）` }}
                <el-icon><component :is="showAllLogs ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
              </el-button>
            </div>
          </div>
        </div>

        <!-- ② 需求與邏輯 -->
        <div ref="logicSectionRef" class="detail-section">
          <div class="section-title">
            <span class="section-icon">📋</span>
            需求與邏輯
          </div>

          <div class="info-block" v-if="scene.inputDesc">
            <div class="info-label">需求定義</div>
            <div class="info-value">{{ scene.inputDesc }}</div>
          </div>
          <div class="info-block" v-if="scene.taskSteps">
            <div class="info-label">任務步驟</div>
            <div class="info-value pre-wrap">{{ scene.taskSteps }}</div>
          </div>

          <!-- 範例對照 -->
          <div v-if="scene.rawDataExample || scene.finalDataExample" class="example-compare">
            <div class="example-col" v-if="scene.rawDataExample">
              <div class="example-label">原始範例</div>
              <div class="example-content">{{ scene.rawDataExample }}</div>
            </div>
            <div v-if="scene.rawDataExample && scene.finalDataExample" class="example-arrow">
              <el-icon><ArrowRight /></el-icon>
            </div>
            <div class="example-col" v-if="scene.finalDataExample">
              <div class="example-label">最終範例</div>
              <div class="example-content">{{ scene.finalDataExample }}</div>
            </div>
          </div>

          <el-empty v-if="!scene.inputDesc && !scene.taskSteps" description="尚無需求與邏輯資料" />
        </div>

        <!-- ③ 執行數據與成效 -->
        <div ref="perfSectionRef" class="detail-section">
          <div class="section-title">
            <span class="section-icon">📊</span>
            執行數據與成效
          </div>

          <!-- 執行統計 3 欄 -->
          <div class="perf-stats-row">
            <div class="perf-stat">
              <div class="perf-stat-val">{{ scene.timePerExecution || '-' }}</div>
              <div class="perf-stat-label">每次執行時間</div>
            </div>
            <div class="perf-stat">
              <div class="perf-stat-val">{{ scene.monthlyFrequency || '-' }}</div>
              <div class="perf-stat-label">執行頻率</div>
            </div>
            <div class="perf-stat">
              <div class="perf-stat-val">{{ scene.demandCount ?? '-' }} 人</div>
              <div class="perf-stat-label">需求人次</div>
            </div>
          </div>

          <!-- 預計節省對比 -->
          <div class="compare-table">
            <div class="compare-header">
              <span></span>
              <span>人數</span>
              <span>時數</span>
            </div>
            <div class="compare-row original">
              <span class="compare-label">原作業</span>
              <span>{{ scene.originalHeadcount ?? '-' }} 人</span>
              <span>{{ scene.originalHours ?? '-' }} 小時</span>
            </div>
            <div class="compare-row improved">
              <span class="compare-label">改善後</span>
              <span>{{ scene.improvedHeadcount ?? '-' }} 人</span>
              <span>{{ scene.improvedHours ?? '-' }} 小時</span>
            </div>
          </div>

          <!-- 實際節省時數 (按月) -->
          <div v-if="currentYearSavings" class="savings-monthly">
            <div class="savings-year-title">實際節省時數（{{ currentYearSavings.year }} 年）</div>
            <div class="savings-months-grid">
              <div
                v-for="(val, mon) in monthFields"
                :key="mon"
                class="savings-month-item"
                :class="{ 'has-value': currentYearSavings[mon] != null }"
              >
                <div class="savings-month-label">{{ mon === 'jan' ? '1' : mon === 'feb' ? '2' : mon === 'mar' ? '3' : mon === 'apr' ? '4' : mon === 'may' ? '5' : mon === 'jun' ? '6' : mon === 'jul' ? '7' : mon === 'aug' ? '8' : mon === 'sep' ? '9' : mon === 'oct' ? '10' : mon === 'nov' ? '11' : '12' }}月</div>
                <div class="savings-month-val">{{ currentYearSavings[mon] ?? '-' }}</div>
              </div>
            </div>
          </div>

          <!-- 文字與實績說明 -->
          <div v-if="scene.resultText" class="info-block" style="margin-top:16px">
            <div class="info-label">實績說明</div>
            <div class="info-value">{{ scene.resultText }}</div>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import api from '../api/index.js'
import { ArrowLeft, ArrowDown, ArrowRight, ArrowUp, UserFilled, User, OfficeBuilding, Tools, Clock, Comment } from '@element-plus/icons-vue'

const route = useRoute()

const scene         = ref(null)
const executionLogs = ref([])
const loading       = ref(true)
const error         = ref('')
const isSticky      = ref(false)
const showAllLogs   = ref(false)
const expandedLogIds = ref(new Set())
const activeTab     = ref('logs')

const pageRef      = ref(null)
const logSectionRef   = ref(null)
const logicSectionRef = ref(null)
const perfSectionRef  = ref(null)

const tabs = [
  { key: 'logs',  label: '📋 日誌' },
  { key: 'logic', label: '🧠 邏輯' },
  { key: 'perf',  label: '📊 成效' },
]

const monthFields = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }

const estimatedSavedHours = computed(() => {
  if (scene.value?.originalHours != null && scene.value?.improvedHours != null) {
    return (scene.value.originalHours - scene.value.improvedHours).toFixed(1)
  }
  return '-'
})

const currentYearSavings = computed(() => {
  if (!scene.value?.actualSavings?.length) return null
  return scene.value.actualSavings[0]
})

const displayedLogs = computed(() => {
  return showAllLogs.value ? executionLogs.value : executionLogs.value.slice(0, 5)
})

function progressColor(pct) {
  if (pct >= 80) return '#67c23a'
  if (pct >= 50) return '#409eff'
  if (pct >= 20) return '#e6a23c'
  return '#909399'
}

function statusTagType(status) {
  const map = { '進行中': 'primary', '規劃中': 'warning', '已完成': 'success', '暫停': 'info' }
  return map[status] || 'info'
}

function logDotClass(status) {
  if (!status) return 'dot-gray'
  if (status.includes('成功') || status.includes('完成')) return 'dot-green'
  if (status.includes('失敗') || status.includes('錯誤')) return 'dot-red'
  return 'dot-gray'
}

function logTagType(status) {
  if (!status) return 'info'
  if (status.includes('成功') || status.includes('完成')) return 'success'
  if (status.includes('失敗') || status.includes('錯誤')) return 'danger'
  return 'info'
}

function formatDateTime(d) {
  if (!d) return ''
  const date = new Date(d)
  return date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function truncate(str, maxLen) {
  if (!str) return ''
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str
}

function toggleLog(id) {
  if (expandedLogIds.value.has(id)) {
    expandedLogIds.value.delete(id)
  } else {
    expandedLogIds.value.add(id)
  }
  expandedLogIds.value = new Set(expandedLogIds.value)
}

function scrollToSection(key) {
  activeTab.value = key
  const map = { logs: logSectionRef.value, logic: logicSectionRef.value, perf: perfSectionRef.value }
  const el = map[key]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// Sticky header on scroll
function onScroll() {
  const heroEl = pageRef.value?.querySelector('.scene-hero')
  if (heroEl) {
    isSticky.value = heroEl.getBoundingClientRect().bottom < 60
  }
}

onMounted(async () => {
  window.addEventListener('scroll', onScroll, { passive: true })
  const sceneId = parseInt(route.params.id)
  try {
    const [sceneRes, logsRes] = await Promise.all([
      api.get(`/scenes/${sceneId}`),
      api.get(`/scenes/${sceneId}/execution-logs`),
    ])
    scene.value = sceneRes.data
    executionLogs.value = logsRes.data
  } catch (e) {
    error.value = e.response?.data?.error || '載入失敗，請重試'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.leader-scene-detail {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 0 80px;
}

/* ── 固定標題列 ── */
.sticky-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: white;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  transition: box-shadow 0.2s;
}
.sticky-header.is-sticky {
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  border-bottom: 1px solid #e4e7ed;
}
.sticky-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.sticky-item-no {
  font-size: 0.75rem;
  font-weight: 700;
  color: #409eff;
  background: #ecf5ff;
  padding: 2px 6px;
  border-radius: 4px;
}
.sticky-scene-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
.sticky-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── 場景 Hero ── */
.scene-hero {
  background: linear-gradient(135deg, #f0f7ff 0%, #f5f2ff 100%);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}
.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.hero-item-no {
  font-size: 0.8rem;
  font-weight: 700;
  color: #409eff;
  margin-bottom: 4px;
}
.hero-name {
  font-size: 1.2rem;
  font-weight: 700;
  color: #303133;
  line-height: 1.3;
}
.hero-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: #606266;
}
.hero-progress {
  margin-bottom: 16px;
}
.hero-quick-stats {
  display: flex;
  align-items: center;
  gap: 0;
  background: rgba(255,255,255,0.8);
  border-radius: 10px;
  padding: 10px 0;
}
.qs-item {
  flex: 1;
  text-align: center;
}
.qs-val {
  font-size: 1rem;
  font-weight: 700;
  color: #409eff;
}
.qs-label {
  font-size: 0.7rem;
  color: #909399;
  margin-top: 2px;
}
.qs-divider {
  width: 1px;
  height: 30px;
  background: #e4e7ed;
}

/* ── 快速導航 Tabs ── */
.nav-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
  position: sticky;
  top: 52px;
  z-index: 90;
  background: white;
  padding-top: 8px;
}
.nav-tab {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #e4e7ed;
  background: #f5f7fa;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s;
  color: #606266;
}
.nav-tab.active, .nav-tab:hover {
  background: #409eff;
  color: white;
  border-color: #409eff;
}

/* ── 詳情區塊 ── */
.detail-section {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  scroll-margin-top: 110px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 1rem;
  font-weight: 700;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}
.section-icon {
  font-size: 1.1rem;
}

/* ── 執行日誌時間軸 ── */
.empty-logs {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #c0c4cc;
  padding: 24px 0;
}

.log-timeline {
  display: flex;
  flex-direction: column;
}

.log-item {
  display: flex;
  gap: 0;
  cursor: pointer;
}

.timeline-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
  flex-shrink: 0;
}
.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}
.dot-green { background: #67c23a; box-shadow: 0 0 0 3px rgba(103,194,58,0.2); }
.dot-red   { background: #f56c6c; box-shadow: 0 0 0 3px rgba(245,108,108,0.2); }
.dot-gray  { background: #c0c4cc; }

.timeline-line {
  width: 2px;
  flex: 1;
  background: #e4e7ed;
  margin: 4px 0;
  min-height: 16px;
}

.log-content-box {
  flex: 1;
  min-width: 0;
  background: #f9fafb;
  border-radius: 10px;
  padding: 10px 12px;
  margin-left: 10px;
  margin-bottom: 8px;
  border: 1px solid #eee;
  transition: all 0.2s;
}
.log-item:hover .log-content-box {
  border-color: #c6e2ff;
  background: #f0f7ff;
}

.log-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.log-date {
  font-size: 0.75rem;
  color: #909399;
}
.log-content-preview {
  font-size: 0.85rem;
  color: #303133;
  line-height: 1.4;
}

.log-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e4e7ed;
}
.log-full-content {
  font-size: 0.85rem;
  color: #303133;
  line-height: 1.5;
  white-space: pre-wrap;
  margin-bottom: 8px;
}
.log-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: #909399;
  margin-top: 4px;
}

.log-expand-hint {
  display: flex;
  justify-content: center;
  margin-top: 4px;
  color: #c0c4cc;
  font-size: 0.7rem;
}
.log-expand-hint .el-icon {
  transition: transform 0.25s;
}
.log-expand-hint .el-icon.rotated {
  transform: rotate(180deg);
}

.show-more-row {
  text-align: center;
  padding: 8px 0 4px;
}

/* ── 需求與邏輯 ── */
.info-block {
  margin-bottom: 16px;
}
.info-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #909399;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.info-value {
  font-size: 0.88rem;
  color: #303133;
  line-height: 1.6;
}
.info-value.pre-wrap {
  white-space: pre-wrap;
}

.example-compare {
  display: flex;
  align-items: stretch;
  gap: 8px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
  flex-wrap: wrap;
}
.example-col {
  flex: 1;
  min-width: 120px;
}
.example-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #909399;
  margin-bottom: 4px;
}
.example-content {
  font-size: 0.82rem;
  color: #303133;
  white-space: pre-wrap;
  background: white;
  border-radius: 6px;
  padding: 8px;
  border: 1px solid #e4e7ed;
}
.example-arrow {
  display: flex;
  align-items: center;
  color: #c0c4cc;
}

/* ── 執行數據與成效 ── */
.perf-stats-row {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  background: #f5f7fa;
  border-radius: 10px;
  overflow: hidden;
}
.perf-stat {
  flex: 1;
  text-align: center;
  padding: 12px 8px;
  border-right: 1px solid #e4e7ed;
}
.perf-stat:last-child {
  border-right: none;
}
.perf-stat-val {
  font-size: 0.95rem;
  font-weight: 700;
  color: #409eff;
}
.perf-stat-label {
  font-size: 0.7rem;
  color: #909399;
  margin-top: 2px;
}

.compare-table {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
  font-size: 0.85rem;
}
.compare-header,
.compare-row {
  display: grid;
  grid-template-columns: 70px 1fr 1fr;
  gap: 0;
}
.compare-header {
  background: #f5f7fa;
  padding: 8px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #909399;
  border-bottom: 1px solid #e4e7ed;
}
.compare-header span, .compare-row span {
  padding: 0 4px;
}
.compare-row {
  padding: 10px 12px;
  align-items: center;
}
.compare-row.original {
  border-bottom: 1px solid #f0f0f0;
  background: #fff9f0;
}
.compare-row.improved {
  background: #f0fff4;
}
.compare-label {
  font-weight: 600;
  color: #606266;
}

/* 實際節省時數 */
.savings-year-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #606266;
  margin-bottom: 10px;
}
.savings-months-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}
@media (max-width: 400px) {
  .savings-months-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
.savings-month-item {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 6px 4px;
  text-align: center;
  border: 1px solid #eee;
}
.savings-month-item.has-value {
  background: #ecf5ff;
  border-color: #c6e2ff;
}
.savings-month-label {
  font-size: 0.68rem;
  color: #c0c4cc;
}
.savings-month-val {
  font-size: 0.85rem;
  font-weight: 600;
  color: #409eff;
}

/* 載入 */
.loading-wrapper {
  padding: 24px 0;
}

/* 動畫 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
