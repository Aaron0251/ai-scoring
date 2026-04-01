<template>
  <AppLayout>
    <h2 class="page-title">目標設定</h2>
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
const configs = reactive({ target_hours: 10000, target_scenes: 100 })

onMounted(async () => {
  loading.value = true
  try {
    const res = await configApi.getAll()
    configs.target_hours = parseInt(res.data.target_hours || '10000')
    configs.target_scenes = parseInt(res.data.target_scenes || '100')
  } finally { loading.value = false }
})

async function saveAll() {
  saving.value = true
  try {
    await Promise.all([
      configApi.update('target_hours', String(configs.target_hours)),
      configApi.update('target_scenes', String(configs.target_scenes)),
    ])
    ElMessage.success('設定已儲存')
  } finally { saving.value = false }
}
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
</style>
