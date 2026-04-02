<template>
  <div class="no-access-page">
    <el-result
      icon="warning"
      title="您沒有權限存取此頁面"
      sub-title="請聯絡管理員開啟對應功能，或點選下方可用功能"
    >
      <template #extra>
        <div v-if="accessibleFeatures.length > 0" class="feature-links">
          <p style="color:#606266; margin-bottom:12px">您目前可使用的功能：</p>
          <el-button
            v-for="f in accessibleFeatures"
            :key="f.key"
            type="primary"
            plain
            @click="router.push(f.path)"
          >
            {{ f.label }}
          </el-button>
        </div>
        <div v-else style="color:#909399">
          目前無任何可用功能，請聯絡管理員
        </div>
      </template>
    </el-result>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { FEATURES } from '../constants/features.js'

const router = useRouter()
const auth = useAuthStore()

const accessibleFeatures = computed(() =>
  FEATURES.filter(f => f.path && auth.hasFeature(f.key))
)
</script>

<style scoped>
.no-access-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.feature-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
</style>
