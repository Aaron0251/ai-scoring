<template>
  <AppLayout>
    <div class="import-view">
      <h2 class="page-title">Excel 批次匯入</h2>

      <el-alert type="info" :closable="false" style="margin-bottom: 16px">
        <template #title>
          請使用標準範本匯入，需包含以下 <strong>19 個必要欄位</strong>（標題名稱必須完全一致）
        </template>
        <div class="col-list">
          {{ requiredCols.join('、') }}
        </div>
      </el-alert>

      <el-button @click="downloadTemplate" style="margin-bottom: 16px">
        下載 Excel 範本
      </el-button>

      <el-upload
        ref="uploadRef"
        drag
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
      >
        <el-icon style="font-size: 48px; color: #c0c4cc"><Upload /></el-icon>
        <div>拖曳 Excel 檔案至此，或 <em>點擊選取</em></div>
        <template #tip>
          <div class="el-upload__tip">僅支援 .xlsx / .xls，檔案大小不超過 10MB</div>
        </template>
      </el-upload>

      <el-button
        type="primary"
        :loading="uploading"
        :disabled="!selectedFile"
        style="margin-top: 16px"
        @click="handleUpload"
      >
        開始匯入
      </el-button>

      <!-- 結果 -->
      <el-card v-if="result" class="result-card">
        <template #header>匯入結果</template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="總筆數">{{ result.totalRows }}</el-descriptions-item>
          <el-descriptions-item label="成功">
            <el-tag type="success">{{ result.successRows }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="失敗/跳過">
            <el-tag type="danger">{{ result.failedRows }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="result.missingColumns" class="mt-12">
          <el-alert type="error" :closable="false" title="缺少必要欄位，匯入被拒絕">
            <div>{{ result.missingColumns.join('、') }}</div>
          </el-alert>
        </div>

        <div v-if="result.errors && result.errors.length > 0" class="mt-12">
          <p style="font-weight:600; margin-bottom:8px">錯誤/警告明細（{{ result.errors.length }} 筆）</p>
          <el-table :data="result.errors" size="small" max-height="300">
            <el-table-column prop="row" label="行號" width="70" />
            <el-table-column prop="error" label="說明" />
            <el-table-column prop="level" label="類型" width="70">
              <template #default="{ row }">
                <el-tag :type="row.level === 'warn' ? 'warning' : 'danger'" size="small">
                  {{ row.level === 'warn' ? '警告' : '錯誤' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { importApi } from '../api/index.js'
import AppLayout from '../components/AppLayout.vue'

const uploadRef = ref()
const selectedFile = ref(null)
const uploading = ref(false)
const result = ref(null)

const requiredCols = [
  '部門', '課級', '場景名稱', '維持型或開發型', '是否由資訊協助完成',
  'Agent類型', '開發工具/方法描述', '輸入描述', '輸出描述', '工作步驟',
  '每次花費時間(小時)', '月執行頻率', '需求人次', '執行人員', '種子人員',
  '直屬主管', '預估省時(小時/月)', '優先度', '備註',
]

function handleFileChange(file) { selectedFile.value = file.raw }
function handleFileRemove() { selectedFile.value = null }

async function downloadTemplate() {
  try {
    const res = await importApi.downloadTemplate()
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'scene_import_template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('範本下載失敗')
  }
}

async function handleUpload() {
  if (!selectedFile.value) return
  uploading.value = true
  result.value = null
  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    const res = await importApi.uploadExcel(fd)
    result.value = res.data
    if (res.data.successRows > 0) {
      ElMessage.success(`成功匯入 ${res.data.successRows} 筆場景`)
    }
  } catch (e) {
    const data = e.response?.data
    if (data?.missingColumns) {
      result.value = data
    } else {
      ElMessage.error(data?.error || '匯入失敗')
    }
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.import-view { max-width: 800px; }
.page-title { margin: 0 0 16px; font-size: 20px; }
.col-list { margin-top: 8px; color: #606266; font-size: 13px; }
.result-card { margin-top: 24px; }
.mt-12 { margin-top: 12px; }
</style>
