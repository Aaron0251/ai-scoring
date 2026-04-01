<template>
  <AppLayout>
    <h2 class="page-title">系統設定</h2>
    <el-card style="max-width: 520px" v-loading="loading">
      <el-form label-width="160px">
        <el-form-item label="目標省時總時數">
          <el-input-number v-model="configs.target_hours" :min="0" :step="1000" />
          <span style="margin-left:8px; color:#888">小時</span>
        </el-form-item>
        <el-form-item label="目標場景數">
          <el-input-number v-model="configs.target_scenes" :min="0" :step="10" />
          <span style="margin-left:8px; color:#888">個</span>
        </el-form-item>
        <el-form-item label="自動評分模式">
          <el-select v-model="configs.auto_score_mode">
            <el-option label="草稿（不公開）" value="draft" />
            <el-option label="直接公開" value="publish" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveAll">儲存設定</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { configApi } from '../../api/index.js'
import AppLayout from '../../components/AppLayout.vue'

const loading = ref(false)
const saving = ref(false)
const configs = reactive({ target_hours: 10000, target_scenes: 100, auto_score_mode: 'draft' })

onMounted(async () => {
  loading.value = true
  try {
    const res = await configApi.getAll()
    configs.target_hours = parseInt(res.data.target_hours || '10000')
    configs.target_scenes = parseInt(res.data.target_scenes || '100')
    configs.auto_score_mode = res.data.auto_score_mode || 'draft'
  } finally { loading.value = false }
})

async function saveAll() {
  saving.value = true
  try {
    await Promise.all([
      configApi.update('target_hours', String(configs.target_hours)),
      configApi.update('target_scenes', String(configs.target_scenes)),
      configApi.update('auto_score_mode', configs.auto_score_mode),
    ])
    ElMessage.success('設定已儲存')
  } finally { saving.value = false }
}
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
</style>
