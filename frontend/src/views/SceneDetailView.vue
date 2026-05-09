<template>
  <AppLayout>
    <div v-loading="loading">
      <div class="toolbar">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <el-breadcrumb>
            <el-breadcrumb-item :to="{ path: '/scenes' }">場景管理</el-breadcrumb-item>
            <el-breadcrumb-item>{{ scene?.itemNo }} {{ scene?.sceneName }}</el-breadcrumb-item>
          </el-breadcrumb>
          <span v-if="scene?.seedOwners" style="color:#606266;font-size:13px">
            種子負責人：{{ scene.seedOwners }}
          </span>
        </div>
        <div v-if="auth.isAdmin || auth.isManager || auth.isChief">
          <el-button v-if="!editing" type="primary" @click="startEdit">編輯</el-button>
          <template v-else>
            <el-button @click="cancelEdit">取消</el-button>
            <el-button type="primary" :loading="saving" @click="handleSave">儲存</el-button>
          </template>
        </div>
      </div>

      <el-tabs v-if="scene" v-model="activeTab">

        <!-- ── Tab 1：基本資訊 ───────────────────── -->
        <el-tab-pane label="基本資訊" name="tab1">
          <!-- 場景身份資訊 -->
          <el-card shadow="hover" style="margin-bottom:16px">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:14px">📋 場景身份</span>
              </div>
            </template>
            <el-row :gutter="24">
              <el-col :xs="24" :sm="12" :md="6">
                <div class="form-field">
                  <label class="field-label">項目編號</label>
                  <div class="field-value">{{ scene.itemNo }}</div>
                </div>
              </el-col>
              <el-col :xs="24" :sm="12" :md="9">
                <div class="form-field">
                  <label class="field-label">場景名稱</label>
                  <div v-if="!editing" class="field-value" style="font-weight:500">{{ scene.sceneName }}</div>
                  <el-input v-else v-model="form.sceneName" maxlength="100" show-word-limit />
                </div>
              </el-col>
              <el-col :xs="24" :sm="12" :md="9">
                <div class="form-field">
                  <label class="field-label">是否由資訊協助完成</label>
                  <div v-if="!editing">
                    <el-tag v-if="scene.itAssisted === true" type="success" size="small">是</el-tag>
                    <el-tag v-else-if="scene.itAssisted === false" type="info" size="small">否</el-tag>
                    <span v-else style="color:#909399">未設定</span>
                  </div>
                  <el-select v-else v-model="form.itAssisted" clearable style="width:100%">
                    <el-option label="是" :value="true" />
                    <el-option label="否" :value="false" />
                  </el-select>
                </div>
              </el-col>
            </el-row>
          </el-card>

          <!-- 組織結構資訊 -->
          <el-card shadow="hover" style="margin-bottom:16px">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:14px">🏢 組織結構</span>
              </div>
            </template>
            <el-row :gutter="24">
              <el-col :xs="24" :sm="12" :md="8">
                <div class="form-field">
                  <label class="field-label">所屬本部</label>
                  <div v-if="!editing" class="field-value">{{ scene.department?.division?.name || '-' }}</div>
                  <el-select v-else v-model="form.divisionId" clearable placeholder="選擇本部" style="width:100%" :disabled="(auth.isChief || auth.isManager) && !auth.isAdmin && !auth.isExecutive" @change="onDivisionChange">
                    <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
                  </el-select>
                </div>
              </el-col>
              <el-col :xs="24" :sm="12" :md="8">
                <div class="form-field">
                  <label class="field-label">所屬部門</label>
                  <div v-if="!editing" class="field-value">{{ scene.department?.name || '-' }}</div>
                  <el-select v-else v-model="form.departmentId" clearable placeholder="選擇部門" style="width:100%" :disabled="!form.divisionId" @change="onDepartmentChange">
                    <el-option v-for="d in filteredDepts" :key="d.id" :label="d.name" :value="d.id" />
                  </el-select>
                </div>
              </el-col>
              <el-col :xs="24" :sm="12" :md="8">
                <div class="form-field">
                  <label class="field-label">所屬課別</label>
                  <div v-if="!editing" class="field-value">{{ scene.section?.name || '-' }}</div>
                  <el-select v-else v-model="form.sectionId" clearable placeholder="（選填）" style="width:100%" :disabled="!form.departmentId">
                    <el-option v-for="s in sections" :key="s.id" :label="s.name" :value="s.id" />
                  </el-select>
                </div>
              </el-col>
            </el-row>
          </el-card>

          <!-- 開發資訊 -->
          <el-card shadow="hover" style="margin-bottom:16px">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:14px">⚙️ 開發資訊</span>
              </div>
            </template>
            <el-row :gutter="24">
              <el-col :xs="24" :sm="12" :md="8">
                <div class="form-field">
                  <label class="field-label">維持/開發/作廢</label>
                  <div v-if="!editing" class="field-value">{{ scene.maintainOrDevelop || '-' }}</div>
                  <el-select v-else v-model="form.maintainOrDevelop" clearable style="width:100%">
                    <el-option label="維持" value="維持" />
                    <el-option label="開發" value="開發" />
                    <el-option label="作廢" value="作廢" />
                  </el-select>
                </div>
              </el-col>
              <el-col :xs="24" :sm="12" :md="8">
                <div class="form-field">
                  <label class="field-label">開發方式</label>
                  <div v-if="!editing" class="field-value">{{ scene.developMethod || '-' }}</div>
                  <el-select v-else v-model="form.developMethod" clearable style="width:100%">
                    <el-option label="AI Agent" value="AI Agent" />
                    <el-option label="系統開發" value="系統開發" />
                    <el-option label="自行開發" value="自行開發" />
                    <el-option label="其他工具" value="其他工具" />
                  </el-select>
                </div>
              </el-col>
              <el-col :xs="24" :sm="12" :md="8">
                <div class="form-field">
                  <label class="field-label">AI Agent 用途分類</label>
                  <div v-if="!editing" class="field-value">{{ scene.agentCategory || '-' }}</div>
                  <el-input v-else v-model="form.agentCategory" maxlength="100" placeholder="輸入分類" />
                </div>
              </el-col>
            </el-row>
            <el-row :gutter="24" v-if="editing ? form.developMethod === '其他工具' : scene.developMethod === '其他工具'" style="margin-top:16px">
              <el-col :xs="24">
                <div class="form-field">
                  <label class="field-label">開發工具說明</label>
                  <div v-if="!editing" class="field-value">{{ scene.developToolDesc || '-' }}</div>
                  <el-input v-else v-model="form.developToolDesc" maxlength="200" show-word-limit placeholder="說明使用的工具" />
                </div>
              </el-col>
            </el-row>
          </el-card>

          <!-- 責任人員 -->
          <el-card shadow="hover">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:14px">👥 責任人員</span>
              </div>
            </template>
            <el-row :gutter="24">
              <el-col :xs="24" :sm="12">
                <div class="form-field">
                  <label class="field-label">任務負責人</label>
                  <div v-if="!editing" class="field-value">{{ scene.taskOwners || '-' }}</div>
                  <el-input v-else v-model="form.taskOwners" maxlength="500" placeholder="多人以逗號分隔，例：王小明, 李大華" />
                </div>
              </el-col>
              <el-col :xs="24" :sm="12">
                <div class="form-field">
                  <label class="field-label">種子負責人</label>
                  <div v-if="!editing" class="field-value">{{ scene.seedOwners || '-' }}</div>
                  <el-input v-else v-model="form.seedOwners" maxlength="500" placeholder="多人以逗號分隔，例：張三, 李四" />
                </div>
              </el-col>
            </el-row>
          </el-card>
        </el-tab-pane>

        <!-- ── Tab 2：場景內容（需求、執行）── -->
        <el-tab-pane label="場景內容" name="tab2">
          <!-- 需求定義 -->
          <el-card shadow="hover" style="margin-bottom:16px">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:14px">📝 需求定義</span>
              </div>
            </template>
            <el-row :gutter="24">
              <el-col :xs="24">
                <div class="form-field">
                  <label class="field-label">常見問項 / 希望 AI 處理什麼</label>
                  <div v-if="!editing" class="field-value-textarea">{{ scene.inputDesc || '-' }}</div>
                  <el-input v-else v-model="form.inputDesc" type="textarea" :rows="4" maxlength="1000" show-word-limit placeholder="描述常見的問題或期望 AI 處理的任務..." />
                </div>
              </el-col>
            </el-row>
          </el-card>

          <!-- 任務執行 -->
          <el-card shadow="hover" style="margin-bottom:16px">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:14px">⚡ 任務執行</span>
              </div>
            </template>
            <el-row :gutter="24" style="margin-bottom:16px">
              <el-col :xs="24">
                <div class="form-field">
                  <label class="field-label">預期輸出成果</label>
                  <div v-if="!editing" class="field-value-textarea">{{ scene.outputDesc || '-' }}</div>
                  <el-input v-else v-model="form.outputDesc" type="textarea" :rows="3" maxlength="1000" show-word-limit placeholder="描述預期的輸出或成果..." />
                </div>
              </el-col>
            </el-row>
            <el-row :gutter="24" style="margin-bottom:16px">
              <el-col :xs="24">
                <div class="form-field">
                  <label class="field-label">任務步驟或處理邏輯</label>
                  <div v-if="!editing" class="field-value-textarea">{{ scene.taskSteps || '-' }}</div>
                  <el-input v-else v-model="form.taskSteps" type="textarea" :rows="5" maxlength="2000" show-word-limit placeholder="詳細描述任務的執行步驟..." />
                </div>
              </el-col>
            </el-row>
            <el-row :gutter="24">
              <el-col :xs="24" :sm="12">
                <div class="form-field">
                  <label class="field-label">原始資料範例說明</label>
                  <div v-if="!editing" class="field-value-textarea">{{ scene.rawDataExample || '-' }}</div>
                  <el-input v-else v-model="form.rawDataExample" type="textarea" :rows="3" maxlength="1000" show-word-limit placeholder="提供原始資料的例子..." />
                </div>
              </el-col>
              <el-col :xs="24" :sm="12">
                <div class="form-field">
                  <label class="field-label">最終資料範例說明</label>
                  <div v-if="!editing" class="field-value-textarea">{{ scene.finalDataExample || '-' }}</div>
                  <el-input v-else v-model="form.finalDataExample" type="textarea" :rows="3" maxlength="1000" show-word-limit placeholder="提供最終資料的例子..." />
                </div>
              </el-col>
            </el-row>
          </el-card>

        </el-tab-pane>

        <!-- ── Tab 3：管理與成效 + 執行數據 + 日誌 ── -->
        <el-tab-pane label="管理與成效" name="tab3">
          <!-- 執行數據 -->
          <el-card shadow="hover" style="margin-bottom:16px">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:14px">📊 執行數據</span>
              </div>
            </template>
            <el-row :gutter="24">
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">每次執行耗費時間</label>
                  <div v-if="!editing" class="field-value">{{ scene.timePerExecution || '-' }}</div>
                  <div v-else style="display:flex;gap:8px;align-items:center">
                    <el-input-number v-model="form.timePerExecutionVal" :min="0" :precision="1" style="flex:1" />
                    <el-select v-model="form.timePerExecutionUnit" style="width:80px">
                      <el-option label="小時" value="小時" />
                      <el-option label="分鐘" value="分鐘" />
                    </el-select>
                  </div>
                </div>
              </el-col>
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">執行頻率</label>
                  <div v-if="!editing" class="field-value">{{ scene.monthlyFrequency || '-' }}</div>
                  <div v-else style="display:flex;gap:8px;align-items:center">
                    <el-input-number v-model="form.monthlyFrequencyVal" :min="0" :precision="0" style="flex:1" />
                    <el-select v-model="form.monthlyFrequencyUnit" style="width:100px">
                      <el-option label="次/每月" value="次/每月" />
                      <el-option label="次/每週" value="次/每週" />
                    </el-select>
                  </div>
                </div>
              </el-col>
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">有需求的人數</label>
                  <div v-if="!editing" class="field-value">{{ scene.demandCount ?? '-' }}</div>
                  <el-input-number v-else v-model="form.demandCount" :min="0" :precision="0" style="width:100%" />
                </div>
              </el-col>
            </el-row>
          </el-card>

          <!-- 進度與優先序 -->
          <el-card shadow="hover" style="margin-bottom:16px">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:14px">🎯 進度與優先序</span>
              </div>
            </template>
            <el-row :gutter="24" style="margin-bottom:16px">
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">優先序</label>
                  <div v-if="!editing">
                    <el-tag :type="priorityType(scene.priority)" size="small">{{ scene.priority }}</el-tag>
                  </div>
                  <el-select v-else v-model="form.priority" style="width:100%">
                    <el-option label="高" value="高" />
                    <el-option label="中" value="中" />
                    <el-option label="低" value="低" />
                  </el-select>
                </div>
              </el-col>
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">狀態</label>
                  <div v-if="!editing">
                    <el-tag :type="statusType(scene.status)" size="small">{{ scene.status }}</el-tag>
                  </div>
                  <el-select v-else v-model="form.status" style="width:100%">
                    <el-option label="規劃中" value="規劃中" />
                    <el-option label="進行中" value="進行中" />
                    <el-option label="已完成" value="已完成" />
                    <el-option label="暫停" value="暫停" />
                  </el-select>
                </div>
              </el-col>
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">進度</label>
                  <div v-if="!editing" style="padding:4px 0">
                    <el-progress :percentage="scene.progress" />
                  </div>
                  <el-slider v-else v-model="form.progress" :max="100" show-input />
                </div>
              </el-col>
            </el-row>
            <el-row :gutter="24">
              <el-col :xs="24" :sm="12">
                <div class="form-field">
                  <label class="field-label">成立日</label>
                  <div v-if="!editing" class="field-value">{{ formatDate(scene.establishDate) }}</div>
                  <el-date-picker v-else v-model="form.establishDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
                </div>
              </el-col>
              <el-col :xs="24" :sm="12">
                <div class="form-field">
                  <label class="field-label">預計完成日</label>
                  <div v-if="!editing" class="field-value">{{ formatDate(scene.targetDate) }}</div>
                  <el-date-picker v-else v-model="form.targetDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
                </div>
              </el-col>
            </el-row>
            <div style="margin-top:16px" v-if="scene.goLiveDate || editing">
              <el-row :gutter="24">
                <el-col :xs="24">
                  <div class="form-field">
                    <label class="field-label">上線日期時間</label>
                    <div v-if="!editing" class="field-value">{{ formatDate(scene.goLiveDate) }}</div>
                    <el-date-picker v-else v-model="form.goLiveDate" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" />
                  </div>
                </el-col>
              </el-row>
            </div>
          </el-card>

          <!-- 成效指標 -->
          <el-card shadow="hover" style="margin-bottom:16px">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:14px">📈 成效指標</span>
              </div>
            </template>
            <!-- 時數三欄 -->
            <el-row :gutter="24" style="margin-bottom:16px">
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">
                    原總作業時數
                    <el-tooltip content="系統自動計算：每次執行時間 × 執行頻率 × 有需求人數" placement="top">
                      <el-icon style="color:#909399;cursor:help;margin-left:4px"><InfoFilled /></el-icon>
                    </el-tooltip>
                  </label>
                  <div class="field-value" style="color:#606266">
                    {{ autoOriginalHours != null ? autoOriginalHours + ' 小時（自動計算）' : '-' }}
                  </div>
                </div>
              </el-col>
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">改善後預估總作業時數</label>
                  <div v-if="!editing" class="field-value">{{ scene.improvedHours ?? '-' }}</div>
                  <el-input-number v-else v-model="form.improvedHours" :min="0" :max="9999.9" :precision="1" style="width:100%" />
                </div>
              </el-col>
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">
                    預估節省時數（月）
                    <el-tooltip content="有填原時數與改善後時數時自動計算；亦可單獨手動填入" placement="top">
                      <el-icon style="color:#909399;cursor:help;margin-left:4px"><InfoFilled /></el-icon>
                    </el-tooltip>
                  </label>
                  <div v-if="!editing" class="field-value" style="color:#409eff;font-weight:500">
                    {{ scene.savingHoursMonthly != null ? scene.savingHoursMonthly + ' h' : '-' }}
                  </div>
                  <el-input-number
                    v-else
                    v-model="form.savingHoursMonthly"
                    :min="0" :max="9999.9" :precision="1"
                    style="width:100%"
                    placeholder="自動計算或手動填入"
                  />
                </div>
              </el-col>
            </el-row>
            <!-- 人數三欄 -->
            <el-row :gutter="24" style="margin-bottom:16px">
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">原總作業人數</label>
                  <div v-if="!editing" class="field-value">{{ scene.originalHeadcount ?? '-' }}</div>
                  <el-input-number v-else v-model="form.originalHeadcount" :min="0" :precision="0" style="width:100%" />
                </div>
              </el-col>
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">改善後總作業人數</label>
                  <div v-if="!editing" class="field-value">{{ scene.improvedHeadcount ?? '-' }}</div>
                  <el-input-number v-else v-model="form.improvedHeadcount" :min="0" :precision="0" style="width:100%" />
                </div>
              </el-col>
              <el-col :xs="24" :sm="8">
                <div class="form-field">
                  <label class="field-label">節省人數</label>
                  <div class="field-value" style="color:#409eff;font-weight:500">{{ estimatedSavedHeadcount ?? '-' }}</div>
                </div>
              </el-col>
            </el-row>
            <!-- 實際節省時數月份表 -->
            <el-divider style="margin:12px 0" />
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
              <span style="font-weight:600;font-size:13px">實際節省時數</span>
              <el-button circle size="small" @click="baseYear--">－</el-button>
              <span style="font-size:13px;font-weight:600;min-width:80px;text-align:center">
                {{ baseYear }}{{ rowCount > 1 ? ' ～ ' + (baseYear + rowCount - 1) : '' }}
              </span>
              <el-button circle size="small" @click="baseYear++">＋</el-button>
              <el-radio-group v-model="rowCount" size="small">
                <el-radio-button :value="1">1列</el-radio-button>
                <el-radio-button :value="2">2列</el-radio-button>
                <el-radio-button :value="3">3列</el-radio-button>
              </el-radio-group>
            </div>
            <!-- 表頭 -->
            <div style="display:grid;grid-template-columns:52px repeat(12,1fr);gap:3px;margin-bottom:3px">
              <div></div>
              <div v-for="m in MONTHS" :key="m.key" style="font-size:11px;color:#888;text-align:center">{{ m.label }}</div>
            </div>
            <!-- 年份列 -->
            <div v-for="year in visibleYears" :key="year" style="display:grid;grid-template-columns:52px repeat(12,1fr);gap:3px;margin-bottom:3px;align-items:center">
              <div style="font-size:13px;font-weight:600;text-align:center;color:#555">{{ year }}</div>
              <el-input-number
                v-for="m in MONTHS" :key="m.key"
                v-model="ensureYearRow(year)[m.key]"
                :min="0" :max="9999.9" :precision="1" :controls="false" size="small"
                style="width:100%"
                placeholder="-"
                @blur="autoSave(year)"
                @keydown.enter.native="autoSave(year)"
              />
            </div>
            <el-divider style="margin:12px 0" />
            <el-row :gutter="24">
              <el-col :xs="24">
                <div class="form-field">
                  <label class="field-label">文字成效說明</label>
                  <div v-if="!editing" class="field-value-textarea">{{ scene.resultText || '-' }}</div>
                  <el-input v-else v-model="form.resultText" type="textarea" :rows="3" placeholder="描述實現的成效..." />
                </div>
              </el-col>
            </el-row>
            <el-divider style="margin:12px 0" />
            <el-row :gutter="24">
              <el-col :xs="24">
                <div class="form-field">
                  <label class="field-label">上線實際成效說明</label>
                  <div v-if="!editing" class="field-value-textarea">{{ scene.actualResultText || '-' }}</div>
                  <el-input v-else v-model="form.actualResultText" type="textarea" :rows="3" placeholder="上線後的實際成效..." />
                </div>
              </el-col>
            </el-row>
            <el-divider style="margin:12px 0" />
            <el-row :gutter="24" style="margin-bottom:16px">
              <el-col :xs="24">
                <div class="form-field">
                  <label class="field-label">其他量化成效說明</label>
                  <div v-if="!editing" class="field-value-textarea">{{ scene.otherMetrics || '-' }}</div>
                  <el-input v-else v-model="form.otherMetrics" type="textarea" :rows="3" placeholder="其他可量化的成效指標..." />
                </div>
              </el-col>
            </el-row>
            <el-row :gutter="24">
              <el-col :xs="24">
                <div class="form-field">
                  <label class="field-label">備註</label>
                  <div v-if="!editing" class="field-value-textarea">{{ scene.note || '-' }}</div>
                  <el-input v-else v-model="form.note" type="textarea" :rows="2" placeholder="其他備註..." />
                </div>
              </el-col>
            </el-row>
          </el-card>

          <!-- 執行日誌 -->
          <el-card shadow="hover">
            <template #header>
              <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-weight:600;font-size:14px">📋 執行日誌</span>
                </div>
                <el-button v-if="auth.isAdmin || auth.isManager || auth.isChief" type="primary" size="small" @click="openLogDialog(null)">
                  + 新增日誌
                </el-button>
              </div>
            </template>
            <el-table :data="executionLogs" border size="small" empty-text="尚無執行日誌" max-height="500">
              <el-table-column label="日期" prop="logDate" width="110" align="center">
                <template #default="{row}">{{ row.logDate?.substring(0, 10) }}</template>
              </el-table-column>
              <el-table-column label="執行人" prop="executor" width="100" align="center" />
              <el-table-column label="執行內容" prop="content" min-width="220" show-overflow-tooltip>
                <template #default="{row}">
                  <div style="white-space:pre-wrap;word-break:break-word;max-height:100px;overflow:auto">{{ row.content }}</div>
                </template>
              </el-table-column>
              <el-table-column label="狀態" prop="status" width="100" align="center">
                <template #default="{row}">
                  <el-tag :type="logStatusType(row.status)" size="small">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="備註" prop="note" min-width="120" show-overflow-tooltip />
              <el-table-column v-if="auth.isAdmin || auth.isManager || auth.isChief" label="操作" width="120" align="center" fixed="right">
                <template #default="{row}">
                  <el-button size="small" link @click="openLogDialog(row)">編輯</el-button>
                  <el-divider direction="vertical" />
                  <el-button size="small" link type="danger" @click="deleteLog(row.id)">刪除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-tab-pane>

        <!-- ── Tab 4：進度歷程 ── -->
        <el-tab-pane label="進度歷程" name="tab4">
          <el-card shadow="hover">
            <template #header>
              <span style="font-weight:600;font-size:14px">📈 進度變化趨勢</span>
            </template>
            <div v-if="progressHistory.length === 0" style="text-align:center;padding:40px 0">
              <el-empty description="尚無進度歷程記錄" />
            </div>
            <template v-else>
              <v-chart :option="progressChartOption" style="height:300px" autoresize />
              <el-divider />
              <el-table :data="progressHistory" size="small" stripe max-height="300">
                <el-table-column label="變更時間" width="160" align="center">
                  <template #default="{row}">{{ row.changedAt?.substring(0,16).replace('T',' ') }}</template>
                </el-table-column>
                <el-table-column label="進度" width="80" align="center">
                  <template #default="{row}">
                    <el-tag type="primary" size="small">{{ row.progressValue }}%</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="changedBy" label="變更者" width="100" align="center" />
                <el-table-column prop="remarks" label="備註" min-width="200" show-overflow-tooltip />
              </el-table>
            </template>
          </el-card>
        </el-tab-pane>

      </el-tabs>

      <!-- 執行日誌編輯 Dialog -->
      <el-dialog v-model="logDialogVisible" :title="logForm.id ? '編輯日誌' : '新增日誌'" width="480px">
        <el-form :model="logForm" label-width="90px" size="small">
          <el-form-item label="日期" required>
            <el-date-picker v-model="logForm.logDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
          </el-form-item>
          <el-form-item label="執行人">
            <el-input v-model="logForm.executor" />
          </el-form-item>
          <el-form-item label="執行內容" required>
            <el-input v-model="logForm.content" type="textarea" :rows="4" />
          </el-form-item>
          <el-form-item label="狀態">
            <el-select v-model="logForm.status" style="width:100%">
              <el-option label="完成" value="完成" />
              <el-option label="進行中" value="進行中" />
              <el-option label="暫停" value="暫停" />
              <el-option label="待辦" value="待辦" />
            </el-select>
          </el-form-item>
          <el-form-item label="備註">
            <el-input v-model="logForm.note" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="logDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="logSaving" @click="saveLog">儲存</el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api, { scenesApi, sectionsApi, deptPersonsApi, divisionsApi, departmentsApi, executionLogsApi, actualSavingsApi } from '../api/index.js'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent])

const MONTHS = [
  { key: 'jan', label: '一月' }, { key: 'feb', label: '二月' }, { key: 'mar', label: '三月' },
  { key: 'apr', label: '四月' }, { key: 'may', label: '五月' }, { key: 'jun', label: '六月' },
  { key: 'jul', label: '七月' }, { key: 'aug', label: '八月' }, { key: 'sep', label: '九月' },
  { key: 'oct', label: '十月' }, { key: 'nov', label: '十一月' }, { key: 'dec', label: '十二月' },
]
import { useAuthStore } from '../stores/auth.js'
import AppLayout from '../components/AppLayout.vue'

const auth = useAuthStore()
const route = useRoute()
const scene = ref(null)
const loading = ref(false)
const editing = ref(route.query.edit === '1')
const saving = ref(false)
const activeTab = ref('tab1')
const sections = ref([])
const deptPersons = ref([])
const form = reactive({
  sceneName: '',
  divisionId: null,
  departmentId: null,
  sectionId: null,
  maintainOrDevelop: null,
  developMethod: null,
  developToolDesc: '',
  agentCategory: '',
  itAssisted: null,
  inputDesc: '',
  outputDesc: '',
  taskSteps: '',
  rawDataExample: '',
  finalDataExample: '',
  timePerExecution: null,
  timePerExecutionVal: null,
  timePerExecutionUnit: '小時',
  monthlyFrequency: null,
  monthlyFrequencyVal: null,
  monthlyFrequencyUnit: '次/每月',
  demandCount: null,
  taskOwners: '',
  seedOwners: '',
  priority: '中',
  status: '規劃中',
  progress: 0,
  establishDate: null,
  targetDate: null,
  goLiveDate: null,
  originalHours: null,
  improvedHours: null,
  savingHoursMonthly: null,
  timeSavedHours: null,
  actualTimeSavedHours: null,
  originalHeadcount: null,
  improvedHeadcount: null,
  actualDemandCount: null,
  resultText: '',
  actualResultText: '',
  otherMetrics: '',
  note: '',
})
const divisions = ref([])
const baseYear = ref(new Date().getFullYear())
const rowCount = ref(2)
const actualSavingsList = ref([])
const savingsMap = reactive({})
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

const visibleYears = computed(() =>
  Array.from({ length: rowCount.value }, (_, i) => baseYear.value + i)
)

function ensureYearRow(year) {
  if (!savingsMap[year]) {
    savingsMap[year] = reactive(Object.fromEntries(MONTH_KEYS.map(k => [k, null])))
    const row = actualSavingsList.value.find(r => r.year === year)
    if (row) for (const k of MONTH_KEYS) savingsMap[year][k] = row[k] ?? null
  }
  return savingsMap[year]
}

watch(visibleYears, (years) => { years.forEach(ensureYearRow) }, { immediate: true })
const allDepartments = ref([])
const filteredDepts = computed(() =>
  form.divisionId ? allDepartments.value.filter(d => d.divisionId === form.divisionId) : []
)
const estimatedSavedHeadcount = computed(() => {
  const orig = editing.value ? form.originalHeadcount : scene.value?.originalHeadcount
  const imp  = editing.value ? form.improvedHeadcount : scene.value?.improvedHeadcount
  if (orig == null || imp == null) return null
  return orig - imp
})

// 原總作業時數自動計算：每次執行時間(小時) × 執行頻率(次/月) × 有需求人數
const autoOriginalHours = computed(() => {
  const timeVal  = editing.value ? form.timePerExecutionVal  : parseFloat(scene.value?.timePerExecution)
  const timeUnit = editing.value ? form.timePerExecutionUnit : (scene.value?.timePerExecution?.includes('分鐘') ? '分鐘' : '小時')
  const freqVal  = editing.value ? form.monthlyFrequencyVal  : parseFloat(scene.value?.monthlyFrequency)
  const freqUnit = editing.value ? form.monthlyFrequencyUnit : (scene.value?.monthlyFrequency?.includes('週') ? '次/每週' : '次/每月')
  const demand   = editing.value ? form.demandCount          : scene.value?.demandCount

  if (timeVal == null || isNaN(timeVal) || freqVal == null || isNaN(freqVal) || demand == null) return null

  // 時間轉小時
  const timeHours = timeUnit === '分鐘' ? timeVal / 60 : timeVal
  // 頻率轉次/月（每週 × 4.33）
  const monthlyFreq = freqUnit === '次/每週' ? freqVal * 4.33 : freqVal

  return Math.round(timeHours * monthlyFreq * demand * 10) / 10
})

// 情境一：原時數 + 改善後時數都有值時，自動帶入 savingHoursMonthly
watch([autoOriginalHours, () => form.improvedHours], ([orig, imp]) => {
  if (!editing.value) return
  if (orig != null && imp != null) {
    form.savingHoursMonthly = Math.max(0, Math.round((orig - imp) * 10) / 10)
  }
})

onMounted(async () => {
  loading.value = true
  try {
    const [sceneRes, divRes, deptRes] = await Promise.all([
      scenesApi.get(route.params.id),
      divisionsApi.list(),
      departmentsApi.list(),
    ])
    scene.value = sceneRes.data
    divisions.value = divRes.data
    allDepartments.value = deptRes.data
    fillForm(sceneRes.data)
    await Promise.all([
      loadSections(sceneRes.data.departmentId),
      loadDeptPersons(sceneRes.data.departmentId),
      loadActualSavings(),
    ])
    // 場景和部門資料加載成功後，再加載執行日誌
    try {
      const logsRes = await executionLogsApi.list(route.params.id)
      executionLogs.value = logsRes.data
    } catch (logErr) {
      console.warn('執行日誌加載失敗:', logErr)
      executionLogs.value = []
    }
  } catch (e) {
    ElMessage.error('載入場景失敗：' + (e.response?.data?.error || e.message))
    console.error('onMounted error:', e)
  } finally {
    loading.value = false
  }
})

async function loadSections(deptId) {
  if (!deptId) return
  try {
    const r = await sectionsApi.list({ departmentId: deptId })
    sections.value = r.data
  } catch {}
}

async function loadDeptPersons(deptId) {
  if (!deptId) return
  try {
    const r = await deptPersonsApi.list({ departmentId: deptId })
    deptPersons.value = r.data
  } catch {}
}

async function loadActualSavings() {
  try {
    const r = await actualSavingsApi.list(route.params.id)
    actualSavingsList.value = r.data
    for (const row of r.data) {
      if (!savingsMap[row.year]) savingsMap[row.year] = reactive(Object.fromEntries(MONTH_KEYS.map(k => [k, null])))
      for (const k of MONTH_KEYS) savingsMap[row.year][k] = row[k] ?? null
    }
    visibleYears.value.forEach(ensureYearRow)
  } catch {}
}

async function autoSave(year) {
  const data = savingsMap[year]
  if (!data) return
  try {
    const r = await actualSavingsApi.upsert(route.params.id, year, data)
    const idx = actualSavingsList.value.findIndex(x => x.year === year)
    if (idx >= 0) actualSavingsList.value[idx] = r.data
    else actualSavingsList.value.push(r.data)
  } catch (e) {
    ElMessage.error('儲存失敗：' + (e.response?.data?.error || e.message))
  }
}

function fillForm(d) {
  Object.assign(form, {
    sceneName: d.sceneName,
    divisionId: d.department?.divisionId ?? null,
    departmentId: d.departmentId ?? null,
    sectionId: d.sectionId ?? null,
    maintainOrDevelop: d.maintainOrDevelop ?? null,
    developMethod: d.developMethod ?? null,
    developToolDesc: d.developToolDesc ?? null,
    agentCategory: d.agentCategory ?? null,
    itAssisted: d.itAssisted ?? null,
    // Tab2
    inputDesc: d.inputDesc ?? null,
    outputDesc: d.outputDesc ?? null,
    taskSteps: d.taskSteps ?? null,
    rawDataExample: d.rawDataExample ?? null,
    finalDataExample: d.finalDataExample ?? null,
    timePerExecution: d.timePerExecution ?? null,
    timePerExecutionVal: d.timePerExecution ? parseFloat(d.timePerExecution) : null,
    timePerExecutionUnit: d.timePerExecution ? (d.timePerExecution.includes('分鐘') ? '分鐘' : '小時') : '小時',
    monthlyFrequency: d.monthlyFrequency ?? null,
    monthlyFrequencyVal: d.monthlyFrequency ? parseFloat(d.monthlyFrequency) : null,
    monthlyFrequencyUnit: d.monthlyFrequency ? (d.monthlyFrequency.includes('週') ? '次/每週' : '次/每月') : '次/每月',
    demandCount: d.demandCount ?? null,
    // Tab3
    taskOwners: d.taskOwners ?? null,
    seedOwners: d.seedOwners ?? null,
    // Tab4
    priority: d.priority,
    status: d.status,
    progress: d.progress,
    establishDate: d.establishDate ? d.establishDate.substring(0, 10) : null,
    targetDate: d.targetDate ? d.targetDate.substring(0, 10) : null,
    goLiveDate: d.goLiveDate ? d.goLiveDate.substring(0, 19) : null,
    originalHours: d.originalHours ?? null,
    improvedHours: d.improvedHours ?? null,
    savingHoursMonthly: d.savingHoursMonthly ?? null,
    timeSavedHours: d.timeSavedHours ?? null,
    actualTimeSavedHours: d.actualTimeSavedHours ?? null,
    originalHeadcount: d.originalHeadcount ?? null,
    improvedHeadcount: d.improvedHeadcount ?? null,
    actualDemandCount: d.actualDemandCount ?? null,
    resultText: d.resultText ?? null,
    actualResultText: d.actualResultText ?? null,
    otherMetrics: d.otherMetrics ?? null,
    note: d.note ?? null,
  })
}

function onDivisionChange() {
  form.departmentId = null
  form.sectionId = null
  sections.value = []
}
async function onDepartmentChange() {
  form.sectionId = null
  if (form.departmentId) {
    await loadSections(form.departmentId)
  } else {
    sections.value = []
  }
}

function startEdit() {
  editing.value = true
}

function cancelEdit() {
  fillForm(scene.value)
  editing.value = false
}

async function handleSave() {
  if (!form.sceneName?.trim()) {
    ElMessage.warning('場景名稱為必填')
    return
  }
  saving.value = true
  try {
    const { divisionId, timePerExecutionVal, timePerExecutionUnit, monthlyFrequencyVal, monthlyFrequencyUnit, ...payload } = form
    // 組合數字＋單位成字串後送出
    payload.timePerExecution = timePerExecutionVal != null ? `${timePerExecutionVal} ${timePerExecutionUnit}` : null
    payload.monthlyFrequency = monthlyFrequencyVal != null ? `${monthlyFrequencyVal} ${monthlyFrequencyUnit}` : null
    // 原總作業時數自動帶入計算值
    if (autoOriginalHours.value != null) {
      payload.originalHours = autoOriginalHours.value
    }
    const res = await scenesApi.update(route.params.id, payload)
    scene.value = res.data
    editing.value = false
    ElMessage.success('儲存成功')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '儲存失敗')
  } finally {
    saving.value = false
  }
}

function formatDate(d) {
  if (!d) return '-'
  return d.substring(0, 10)
}

function statusType(s) {
  return { '已完成': 'success', '進行中': 'primary', '暫停': 'warning', '規劃中': 'info' }[s] || ''
}
function priorityType(p) {
  return { '高': 'danger', '中': 'warning', '低': 'info' }[p] || ''
}

// ── 執行日誌 ──────────────────────────────────
const executionLogs = ref([])
const logDialogVisible = ref(false)
const logSaving = ref(false)
const logForm = reactive({ id: null, logDate: '', executor: '', content: '', status: '完成', note: '' })

async function loadLogs() {
  try {
    const r = await executionLogsApi.list(route.params.id)
    executionLogs.value = r.data
  } catch {}
}

function openLogDialog(row) {
  if (row) {
    Object.assign(logForm, { id: row.id, logDate: row.logDate?.substring(0, 10), executor: row.executor || '', content: row.content, status: row.status, note: row.note || '' })
  } else {
    Object.assign(logForm, { id: null, logDate: new Date().toISOString().substring(0, 10), executor: '', content: '', status: '完成', note: '' })
  }
  logDialogVisible.value = true
}

async function saveLog() {
  if (!logForm.logDate || !logForm.content?.trim()) {
    ElMessage.warning('日期和執行內容為必填')
    return
  }
  logSaving.value = true
  try {
    if (logForm.id) {
      await executionLogsApi.update(route.params.id, logForm.id, logForm)
    } else {
      await executionLogsApi.create(route.params.id, logForm)
    }
    await loadLogs()
    logDialogVisible.value = false
    ElMessage.success('儲存成功')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '儲存失敗')
  } finally {
    logSaving.value = false
  }
}

async function deleteLog(id) {
  try {
    await ElMessageBox.confirm('確定刪除此日誌？', '確認', { type: 'warning' })
    await executionLogsApi.remove(route.params.id, id)
    await loadLogs()
    ElMessage.success('刪除成功')
  } catch {}
}

function logStatusType(s) {
  return { '完成': 'success', '進行中': 'primary', '暫停': 'warning', '待辦': 'info' }[s] || ''
}

// ── 進度歷程 ──────────────────────────────────
const progressHistory = ref([])

async function loadProgressHistory() {
  try {
    const { data } = await api.get(`/scenes/${route.params.id}/progress-history`)
    progressHistory.value = data
  } catch {}
}

const progressChartOption = computed(() => {
  const history = progressHistory.value
  const dates = history.map(h => h.changedAt?.substring(0, 10))
  const values = history.map(h => h.progressValue)
  return {
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].axisValue}<br>進度：${p[0].value}%` },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: dates, axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { color: '#409eff', width: 2 },
      itemStyle: { color: '#409eff' },
      areaStyle: { color: 'rgba(64,158,255,0.15)' },
      markLine: {
        silent: true,
        data: [{ yAxis: 100, lineStyle: { color: '#67c23a', type: 'dashed' }, label: { formatter: '完成線' } }],
      },
    }],
  }
})

watch(activeTab, (val) => {
  if (val === 'tab4') loadProgressHistory()
})
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }

/* 表單欄位美化 */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: #505266;
  white-space: nowrap;
}

.field-value {
  font-size: 14px;
  color: #303133;
  line-height: 1.6;
  padding: 4px 0;
}

.field-value-textarea {
  font-size: 13px;
  color: #303133;
  line-height: 1.7;
  padding: 8px;
  background-color: #fafafa;
  border-radius: 2px;
  min-height: 60px;
  white-space: pre-wrap;
  word-break: break-word;
}

.pre-text {
  white-space: pre-wrap;
  margin: 0;
  font-family: inherit;
  line-height: 1.5;
}
</style>
