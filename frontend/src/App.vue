<template>
  <router-view />
</template>

<style>
/* ── 全域覆寫 Element Plus 主色為 Indigo ── */
:root {
  --el-color-primary: #6366f1;
  --el-color-primary-light-3: #818cf8;
  --el-color-primary-light-5: #a5b4fc;
  --el-color-primary-light-7: #c7d2fe;
  --el-color-primary-light-8: #e0e7ff;
  --el-color-primary-light-9: #eef2ff;
  --el-color-primary-dark-2: #4f46e5;
}

/* 全域字體 */
body {
  font-family: 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  color: #1e293b;
}
</style>
