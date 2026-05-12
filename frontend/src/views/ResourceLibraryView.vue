<template>
  <AppLayout>
    <div class="rl-page">

      <!-- ── 頁頭 ── -->
      <div class="page-header">
        <div class="page-title">
          <el-icon class="title-icon"><Collection /></el-icon>
          <h1>成果資源庫</h1>
        </div>
        <div class="header-actions" v-if="canEdit">
          <el-button type="primary" @click="openToolDialog()">
            <el-icon><Plus /></el-icon> 新增工具卡片
          </el-button>
          <el-button @click="openCatManage">
            <el-icon><Setting /></el-icon> 管理分類
          </el-button>
        </div>
      </div>

      <!-- ── 個人最愛列 ── -->
      <FavoritesBar
        v-if="favorites.length"
        :favorites="favorites"
        @remove="removeFavorite"
        @update-folder="fetchFavorites"
      />

      <!-- ── 篩選列（三層聯動）── -->
      <div class="filter-bar">
        <el-input v-model="searchText" placeholder="搜尋工具名稱..." clearable style="width:200px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filterDivision" placeholder="全部本部" style="width:150px"
          :clearable="!myDivisionId" :disabled="!!myDivisionId"
          @change="filterDept = null; filterSection = null">
          <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <el-select v-model="filterDept" placeholder="全部部門" clearable style="width:150px"
          :disabled="!filterDivision" @change="filterSection = null">
          <el-option v-for="d in deptsByDivision(filterDivision)" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <el-select v-model="filterSection" placeholder="全部課別" clearable style="width:150px"
          :disabled="!filterDept">
          <el-option v-for="s in sectionsByDept(filterDept)" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>

      <!-- ── 載入中 ── -->
      <div v-if="loading" class="center-loading">
        <el-icon class="spin"><Loading /></el-icon>
      </div>

      <!-- ── 無資料 ── -->
      <el-empty v-else-if="!filteredDivGroups.length" description="目前尚無資源，請先新增工具卡片" />

      <!-- ── 本部分組（可折疊）── -->
      <div v-else class="div-sections">
        <div v-for="divGroup in filteredDivGroups" :key="divGroup.id" class="div-section">

          <!-- 本部標題列 -->
          <div class="div-header" @click="toggleDiv(divGroup.id)">
            <el-icon class="div-arrow" :class="{ open: openDivs[divGroup.id] }"><ArrowRight /></el-icon>
            <span class="div-name">{{ divGroup.name }}</span>
            <span class="div-badge">{{ divGroup.totalTools }} 項工具</span>
          </div>

          <!-- 展開內容 -->
          <div v-if="openDivs[divGroup.id]" class="div-body">
            <div v-for="cat in divGroup.categories" :key="cat.id" class="category-section">
              <div class="category-header">
                <span class="category-name">{{ cat.name }}</span>
                <span class="category-org-tag">
                  {{ cat.section?.name || cat.department?.name || cat.division?.name }}
                </span>
                <span class="category-count">{{ cat.tools.length }} 張</span>
              </div>
              <div class="tools-grid">
                <ToolCard
                  v-for="tool in cat.tools"
                  :key="tool.id"
                  :tool="tool"
                  :can-edit="canEdit"
                  @toggle-fav="toggleFavorite"
                  @edit="openToolDialog"
                  @delete="deleteTool"
                  @add-item="openItemDialog"
                  @delete-item="deleteItem"
                  @open-url="openUrl"
                  @download="downloadItem"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ══ 工具卡片 Dialog ══ -->
    <el-dialog v-model="toolDialogVisible" :title="editingTool ? '編輯工具卡片' : '新增工具卡片'"
      width="520px" destroy-on-close>
      <el-form :model="toolForm" label-width="80px">
        <el-form-item label="工具名稱" required>
          <el-input v-model="toolForm.name" placeholder="如：蝦皮店數更新工具" />
        </el-form-item>
        <el-form-item label="說明">
          <el-input v-model="toolForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <!-- 三層組織選擇 -->
        <el-form-item label="本部">
          <el-select v-model="toolForm.divisionId" placeholder="請選擇本部" style="width:100%"
            :clearable="!myDivisionId" :disabled="!!myDivisionId"
            @change="toolForm.departmentId = null; toolForm.sectionId = null; toolForm.categoryId = null">
            <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="部門">
          <el-select v-model="toolForm.departmentId" placeholder="（可選）" clearable style="width:100%"
            :disabled="!toolForm.divisionId"
            @change="toolForm.sectionId = null; toolForm.categoryId = null">
            <el-option v-for="d in deptsByDivision(toolForm.divisionId)" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="課別">
          <el-select v-model="toolForm.sectionId" placeholder="（可選）" clearable style="width:100%"
            :disabled="!toolForm.departmentId"
            @change="toolForm.categoryId = null">
            <el-option v-for="s in sectionsByDept(toolForm.departmentId)" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="分類" required>
          <el-select v-model="toolForm.categoryId" placeholder="請先選擇組織層級" style="width:100%"
            :disabled="!toolForm.divisionId">
            <el-option v-for="cat in categoriesForTool" :key="cat.id"
              :label="`${cat.name}（${cat.section?.name || cat.department?.name || cat.division?.name}）`"
              :value="cat.id" />
          </el-select>
          <div v-if="toolForm.divisionId && !categoriesForTool.length" class="hint-text">
            此組織層級尚無分類，請先至「管理分類」新增
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="toolForm.sortOrder" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="toolDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTool">儲存</el-button>
      </template>
    </el-dialog>

    <!-- ══ 新增資源項目 Dialog ══ -->
    <el-dialog v-model="itemDialogVisible" title="新增資源項目" width="480px" destroy-on-close>
      <el-form :model="itemForm" label-width="90px">
        <el-form-item label="項目名稱" required>
          <el-input v-model="itemForm.name" placeholder="如：操作說明書、官方網站" />
        </el-form-item>
        <el-form-item label="類型" required>
          <el-radio-group v-model="itemForm.itemType">
            <el-radio value="url">🔗 網址</el-radio>
            <el-radio value="video_url">🎬 影片連結</el-radio>
            <el-radio value="pdf">📄 PDF</el-radio>
            <el-radio value="excel">📊 Excel</el-radio>
            <el-radio value="video">🎥 影片檔</el-radio>
            <el-radio value="image">🖼️ 圖片</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="itemForm.itemType === 'url'" label="網址" required>
          <el-input v-model="itemForm.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item v-else-if="itemForm.itemType === 'video_url'" label="影片連結" required>
          <el-input v-model="itemForm.url" placeholder="https://www.youtube.com/..." />
        </el-form-item>
        <el-form-item v-else label="上傳檔案">
          <el-upload :auto-upload="false" :limit="1" :on-change="handleFileChange"
            :on-remove="() => itemFile = null" :accept="acceptForType(itemForm.itemType)">
            <el-button><el-icon><Upload /></el-icon> 選擇檔案</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="說明">
          <el-input v-model="itemForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveItem">儲存</el-button>
      </template>
    </el-dialog>

    <!-- ══ 管理分類 Dialog ══ -->
    <el-dialog v-model="catManageVisible" title="管理分類" width="560px" destroy-on-close>
      <div class="cat-manage">
        <!-- 三層組織選擇 -->
        <div class="cat-org-row">
          <el-select v-model="catForm.divisionId" placeholder="選擇本部" style="flex:1"
            :disabled="!!myDivisionId"
            @change="catForm.departmentId = null; catForm.sectionId = null; loadCatList()">
            <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
          <el-select v-model="catForm.departmentId" placeholder="部門（可選）" style="flex:1"
            clearable :disabled="!catForm.divisionId"
            @change="catForm.sectionId = null; loadCatList()">
            <el-option v-for="d in deptsByDivision(catForm.divisionId)" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
          <el-select v-model="catForm.sectionId" placeholder="課別（可選）" style="flex:1"
            clearable :disabled="!catForm.departmentId"
            @change="loadCatList()">
            <el-option v-for="s in sectionsByDept(catForm.departmentId)" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </div>

        <template v-if="catForm.divisionId">
          <div class="cat-add-row" style="margin-top:14px">
            <el-input v-model="newCatName" placeholder="輸入新分類名稱" clearable style="flex:1" />
            <el-button type="primary" @click="addCategory">新增</el-button>
          </div>
          <el-table :data="catManageList" size="small" style="margin-top:12px" empty-text="此層級尚無分類">
            <el-table-column prop="name" label="分類名稱" />
            <el-table-column label="層級" width="120">
              <template #default="{ row }">
                {{ row.section?.name || row.department?.name || row.division?.name }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center">
              <template #default="{ row }">
                <el-popconfirm title="確定刪除此分類？" @confirm="deleteCategory(row.id)">
                  <template #reference>
                    <el-button type="danger" size="small" text>刪除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </template>
        <el-empty v-else description="請先選擇本部" :image-size="60" />
      </div>
    </el-dialog>

  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '../components/AppLayout.vue'
import FavoritesBar from '../components/FavoritesBar.vue'
import ToolCard from '../components/ToolCard.vue'
import { useAuthStore } from '../stores/auth.js'
import api from '../api/index.js'

const auth = useAuthStore()
const canEdit = computed(() => auth.isAdmin || auth.isManager)

// ── 原始資料 ──────────────────────────────────
const loading = ref(false)
const saving  = ref(false)
const divGroups   = ref([])   // API 回傳：[ { id, name, categories: [...] } ]
const divisions   = ref([])
const departments = ref([])
const sections    = ref([])
const categories  = ref([])   // flat，供 Dialog 用
const favorites   = ref([])

// ── 篩選 ──────────────────────────────────────
const searchText    = ref('')
const filterDivision = ref(null)
const filterDept     = ref(null)
const filterSection  = ref(null)

// 帳號所屬組織（登入時已綁定）
const myDivisionId   = auth.user?.divisionId   ?? null
const myDepartmentId = auth.user?.departmentId ?? null
const mySectionId    = auth.user?.sectionId    ?? null

// 本部折疊狀態
const openDivs = ref({})

function toggleDiv(id) {
  openDivs.value[id] = !openDivs.value[id]
}

// 初始化新出現的本部為折疊
watch(divGroups, (groups) => {
  groups.forEach(g => {
    if (openDivs.value[g.id] === undefined) openDivs.value[g.id] = false
  })
}, { immediate: true })

// ── 組織層級輔助 ──────────────────────────────
function deptsByDivision(divId) {
  if (!divId) return []
  return departments.value.filter(d => d.divisionId === divId)
}
function sectionsByDept(deptId) {
  if (!deptId) return []
  return sections.value.filter(s => s.departmentId === deptId)
}

// ── 篩選後的本部分組 ──────────────────────────
const filteredDivGroups = computed(() => {
  return divGroups.value.map(div => {
    // 若有選本部篩選且不符 → 整個本部隱藏
    if (filterDivision.value && div.id !== filterDivision.value) return null

    const cats = div.categories.map(cat => {
      const tools = cat.tools.filter(tool => {
        const matchSearch = !searchText.value ||
          tool.name.toLowerCase().includes(searchText.value.toLowerCase())
        const matchDept    = !filterDept.value    || tool.departmentId === filterDept.value    || cat.departmentId === filterDept.value
        const matchSection = !filterSection.value || tool.sectionId    === filterSection.value || cat.sectionId    === filterSection.value
        return matchSearch && matchDept && matchSection
      })
      return { ...cat, tools }
    }).filter(cat => cat.tools.length > 0)

    if (!cats.length) return null
    return {
      ...div,
      totalTools: cats.reduce((sum, c) => sum + c.tools.length, 0),
      categories: cats,
    }
  }).filter(Boolean)
})

// 搜尋有結果時自動展開相關本部
watch(searchText, (val) => {
  if (val) {
    filteredDivGroups.value.forEach(g => { openDivs.value[g.id] = true })
  }
})
watch([filterDivision, filterDept, filterSection], () => {
  filteredDivGroups.value.forEach(g => { openDivs.value[g.id] = true })
})

// ── API ───────────────────────────────────────
async function fetchAll() {
  loading.value = true
  try {
    const [gRes, cRes, divRes, deptRes, secRes] = await Promise.all([
      api.get('/resource-library/grouped'),
      api.get('/resource-library/categories'),
      api.get('/divisions'),
      api.get('/departments'),
      api.get('/sections'),
    ])
    divGroups.value   = gRes.data
    categories.value  = cRes.data
    divisions.value   = divRes.data
    departments.value = deptRes.data
    sections.value    = secRes.data
  } catch (e) {
    ElMessage.error('載入失敗：' + (e.response?.data?.error || e.message))
  } finally {
    loading.value = false
  }
}

async function fetchFavorites() {
  try {
    const res = await api.get('/resource-library/favorites')
    favorites.value = res.data
  } catch {}
}

onMounted(async () => {
  await fetchAll()
  await fetchFavorites()

  // 依帳號綁定的組織層級，自動預設篩選條件
  if (myDivisionId) {
    filterDivision.value = myDivisionId
    if (myDepartmentId) {
      filterDept.value = myDepartmentId
      if (mySectionId) filterSection.value = mySectionId
    }
  }
})

// ── 工具卡片 Dialog ───────────────────────────
const toolDialogVisible = ref(false)
const editingTool = ref(null)
const toolForm = ref({ name: '', description: '', divisionId: null, departmentId: null, sectionId: null, categoryId: null, sortOrder: 0 })

const categoriesForTool = computed(() => {
  if (!toolForm.value.divisionId) return []
  const divId  = toolForm.value.divisionId
  const deptId = toolForm.value.departmentId
  const secId  = toolForm.value.sectionId

  // 本部下所有部門 ID（用來判斷部門是否屬於此本部）
  const divDeptIds = departments.value.filter(d => d.divisionId === divId).map(d => d.id)

  return categories.value.filter(cat => {
    if (secId)   return cat.sectionId    === secId
    if (deptId)  return cat.departmentId === deptId

    // 只選本部：直屬本部 OR 屬於本部下任一部門 OR 屬於本部下任一課別
    const catDivMatch  = cat.divisionId   === divId
    const catDeptMatch = cat.departmentId != null && divDeptIds.includes(cat.departmentId)
    return catDivMatch || catDeptMatch
  })
})

function openToolDialog(tool = null) {
  editingTool.value = tool
  if (tool) {
    toolForm.value = {
      name: tool.name, description: tool.description || '',
      divisionId: tool.divisionId, departmentId: tool.departmentId,
      sectionId: tool.sectionId, categoryId: tool.categoryId, sortOrder: tool.sortOrder,
    }
  } else {
    // 新增時：預填帳號所屬本部/部門/課
    toolForm.value = {
      name: '', description: '',
      divisionId:   myDivisionId,
      departmentId: myDepartmentId,
      sectionId:    mySectionId,
      categoryId: null, sortOrder: 0,
    }
  }
  toolDialogVisible.value = true
}

async function saveTool() {
  if (!toolForm.value.name) return ElMessage.warning('請填寫工具名稱')
  if (!toolForm.value.categoryId) return ElMessage.warning('請選擇分類')
  saving.value = true
  try {
    if (editingTool.value) {
      await api.put(`/resource-library/tools/${editingTool.value.id}`, toolForm.value)
      ElMessage.success('已更新')
    } else {
      await api.post('/resource-library/tools', toolForm.value)
      ElMessage.success('已新增')
    }
    toolDialogVisible.value = false
    await fetchAll()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '操作失敗')
  } finally {
    saving.value = false
  }
}

async function deleteTool(id) {
  try {
    await api.delete(`/resource-library/tools/${id}`)
    ElMessage.success('已刪除')
    await fetchAll()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '刪除失敗')
  }
}

// ── 資源項目 Dialog ───────────────────────────
const itemDialogVisible = ref(false)
const currentToolId = ref(null)
const itemFile = ref(null)
const itemForm = ref({ name: '', itemType: 'url', url: '', description: '' })

function openItemDialog(tool) {
  currentToolId.value = tool.id
  itemForm.value = { name: '', itemType: 'url', url: '', description: '' }
  itemFile.value = null
  itemDialogVisible.value = true
}

function handleFileChange(file) { itemFile.value = file.raw }

function acceptForType(type) {
  return { pdf: '.pdf', excel: '.xls,.xlsx', video: '.mp4,.webm,.ogg', image: '.jpg,.jpeg,.png,.gif,.webp' }[type] || ''
}

async function saveItem() {
  if (!itemForm.value.name) return ElMessage.warning('請填寫項目名稱')
  const isUrlType = itemForm.value.itemType === 'url' || itemForm.value.itemType === 'video_url'
  if (isUrlType && !itemForm.value.url) return ElMessage.warning('請填寫連結網址')
  saving.value = true
  try {
    const fd = new FormData()
    fd.append('name', itemForm.value.name)
    fd.append('itemType', itemForm.value.itemType)
    if (isUrlType) fd.append('url', itemForm.value.url)
    else if (itemFile.value) fd.append('file', itemFile.value)
    if (itemForm.value.description) fd.append('description', itemForm.value.description)
    await api.post(`/resource-library/tools/${currentToolId.value}/items`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    ElMessage.success('已新增資源')
    itemDialogVisible.value = false
    await fetchAll()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '新增失敗')
  } finally {
    saving.value = false
  }
}

async function deleteItem(toolId, itemId) {
  try {
    await api.delete(`/resource-library/tools/${toolId}/items/${itemId}`)
    ElMessage.success('已刪除')
    await fetchAll()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '刪除失敗')
  }
}

function downloadItem(item) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || ''
  const token = sessionStorage.getItem('token')
  const url = `${baseURL}/api/resource-library/tools/${item.toolId}/items/${item.id}/file`
  const a = document.createElement('a')
  a.href = url + '?token=' + token
  a.target = '_blank'
  a.click()
}

// ── 管理分類 ──────────────────────────────────
const catManageVisible = ref(false)
const newCatName = ref('')
const catManageList = ref([])
const catForm = ref({ divisionId: null, departmentId: null, sectionId: null })

function openCatManage() {
  // 預填帳號所屬本部/部門/課
  catForm.value = {
    divisionId:   myDivisionId,
    departmentId: myDepartmentId,
    sectionId:    mySectionId,
  }
  catManageList.value = []
  newCatName.value = ''
  catManageVisible.value = true
  // 若有預設本部則立即載入分類列表
  if (myDivisionId) loadCatList()
}

async function loadCatList() {
  if (!catForm.value.divisionId) { catManageList.value = []; return }
  const params = {}
  if (catForm.value.sectionId)         params.sectionId    = catForm.value.sectionId
  else if (catForm.value.departmentId) params.departmentId = catForm.value.departmentId
  else                                 params.divisionId   = catForm.value.divisionId
  try {
    const res = await api.get('/resource-library/categories', { params })
    catManageList.value = res.data
  } catch {}
}

async function addCategory() {
  if (!newCatName.value.trim()) return ElMessage.warning('請填寫分類名稱')
  try {
    await api.post('/resource-library/categories', {
      name: newCatName.value.trim(),
      divisionId:   catForm.value.divisionId,
      departmentId: catForm.value.departmentId || null,
      sectionId:    catForm.value.sectionId    || null,
    })
    newCatName.value = ''
    await loadCatList()
    const res = await api.get('/resource-library/categories')
    categories.value = res.data
    await fetchAll()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '新增失敗')
  }
}

async function deleteCategory(id) {
  try {
    await api.delete(`/resource-library/categories/${id}`)
    await loadCatList()
    const res = await api.get('/resource-library/categories')
    categories.value = res.data
    await fetchAll()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '刪除失敗')
  }
}

// ── 最愛 ──────────────────────────────────────
async function toggleFavorite(tool) {
  try {
    if (tool.isFavorite) {
      await api.delete(`/resource-library/favorites/${tool.id}`)
      tool.isFavorite = false
    } else {
      await api.post(`/resource-library/favorites/${tool.id}`, {})
      tool.isFavorite = true
    }
    await fetchFavorites()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '操作失敗')
  }
}

async function removeFavorite(toolId) {
  try {
    await api.delete(`/resource-library/favorites/${toolId}`)
    await fetchFavorites()
    for (const div of divGroups.value)
      for (const cat of div.categories)
        for (const tool of cat.tools)
          if (tool.id === toolId) tool.isFavorite = false
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '操作失敗')
  }
}

function openUrl(url) {
  if (!url) { ElMessage.warning('此項目尚未設定連結，請刪除後重新新增'); return }
  window.open(url.startsWith('http') ? url : 'https://' + url, '_blank')
}
</script>

<style scoped>
.rl-page { max-width: 1200px; margin: 0 auto; }

.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.page-title  { display: flex; align-items: center; gap: 10px; }
.page-title h1 { font-size: 22px; font-weight: 700; color: #1e293b; margin: 0; }
.title-icon  { font-size: 24px; color: #6366f1; }
.header-actions { display: flex; gap: 8px; }

.filter-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }

.center-loading { text-align: center; padding: 60px; font-size: 28px; color: #6366f1; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

/* ── 本部分組 ── */
.div-sections { display: flex; flex-direction: column; gap: 12px; }
.div-section  { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }

.div-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px; cursor: pointer;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  transition: background .15s;
  user-select: none;
}
.div-header:hover { background: #f1f5f9; }
.div-arrow { font-size: 14px; color: #94a3b8; transition: transform .2s; }
.div-arrow.open { transform: rotate(90deg); }
.div-name  { font-size: 15px; font-weight: 700; color: #1e293b; }
.div-badge { font-size: 12px; color: #94a3b8; background: #f1f5f9; border-radius: 10px; padding: 2px 10px; margin-left: auto; }

.div-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 20px; }

/* ── 分類 ── */
.category-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.category-name   { font-size: 14px; font-weight: 700; color: #334155; border-left: 3px solid #6366f1; padding-left: 8px; }
.category-org-tag { font-size: 12px; color: #6366f1; background: #eef2ff; border-radius: 8px; padding: 1px 8px; }
.category-count  { font-size: 12px; color: #94a3b8; margin-left: auto; }

/* ── 卡片格 ── */
.tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

/* ── 管理分類 ── */
.cat-manage {}
.cat-org-row { display: flex; gap: 8px; }
.cat-add-row { display: flex; gap: 8px; }
.hint-text   { font-size: 12px; color: #f59e0b; margin-top: 4px; }

@media (max-width: 768px) {
  .tools-grid { grid-template-columns: 1fr; }
  .filter-bar { flex-direction: column; }
  .filter-bar .el-input,
  .filter-bar .el-select { width: 100% !important; }
  .cat-org-row { flex-direction: column; }
}
</style>
