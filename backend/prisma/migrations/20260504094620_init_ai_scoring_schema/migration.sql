-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ai_scoring";

-- CreateTable
CREATE TABLE "ai_scoring"."Division" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "divisionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."Section" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."DeptPerson" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "divisionId" INTEGER,
    "departmentId" INTEGER,
    "sectionId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeptPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "roles" TEXT NOT NULL,
    "divisionId" INTEGER,
    "departmentId" INTEGER,
    "sectionId" INTEGER,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."OrgChief" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgChief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."Scene" (
    "id" SERIAL NOT NULL,
    "itemNo" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "sectionId" INTEGER,
    "sceneName" TEXT NOT NULL,
    "maintainOrDevelop" TEXT,
    "itAssisted" BOOLEAN,
    "developMethod" TEXT,
    "developToolDesc" TEXT,
    "agentCategory" TEXT,
    "inputDesc" TEXT,
    "outputDesc" TEXT,
    "taskSteps" TEXT,
    "rawDataExample" TEXT,
    "finalDataExample" TEXT,
    "timePerExecution" TEXT,
    "monthlyFrequency" TEXT,
    "demandCount" INTEGER,
    "taskOwners" TEXT,
    "seedOwners" TEXT,
    "priority" TEXT NOT NULL DEFAULT '中',
    "status" TEXT NOT NULL DEFAULT '規劃中',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "establishDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "goLiveDate" TIMESTAMP(3),
    "originalHours" DOUBLE PRECISION,
    "improvedHours" DOUBLE PRECISION,
    "savingHoursMonthly" DOUBLE PRECISION,
    "originalHeadcount" INTEGER,
    "improvedHeadcount" INTEGER,
    "resultText" TEXT,
    "actualResultText" TEXT,
    "otherMetrics" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "importHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."SceneActualSavings" (
    "id" SERIAL NOT NULL,
    "sceneId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "jan" DOUBLE PRECISION,
    "feb" DOUBLE PRECISION,
    "mar" DOUBLE PRECISION,
    "apr" DOUBLE PRECISION,
    "may" DOUBLE PRECISION,
    "jun" DOUBLE PRECISION,
    "jul" DOUBLE PRECISION,
    "aug" DOUBLE PRECISION,
    "sep" DOUBLE PRECISION,
    "oct" DOUBLE PRECISION,
    "nov" DOUBLE PRECISION,
    "dec" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneActualSavings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."SceneExecutionLog" (
    "id" SERIAL NOT NULL,
    "sceneId" INTEGER NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "executor" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '完成',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."SceneBenefit" (
    "id" SERIAL NOT NULL,
    "sceneId" INTEGER NOT NULL,
    "benefitType" TEXT NOT NULL,
    "description" TEXT,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."RolePermission" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."SystemConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."ExcelImportLog" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedBy" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL,
    "failedRows" INTEGER NOT NULL,
    "errors" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcelImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."SceneProgressHistory" (
    "id" SERIAL NOT NULL,
    "sceneId" INTEGER NOT NULL,
    "progressValue" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "changedBy" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneProgressHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Division_name_key" ON "ai_scoring"."Division"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_divisionId_key" ON "ai_scoring"."Department"("name", "divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_name_departmentId_key" ON "ai_scoring"."Section"("name", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "ai_scoring"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_itemNo_key" ON "ai_scoring"."Scene"("itemNo");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_importHash_key" ON "ai_scoring"."Scene"("importHash");

-- CreateIndex
CREATE UNIQUE INDEX "SceneActualSavings_sceneId_year_key" ON "ai_scoring"."SceneActualSavings"("sceneId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_featureKey_key" ON "ai_scoring"."RolePermission"("role", "featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "ai_scoring"."SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SceneProgressHistory_sceneId_idx" ON "ai_scoring"."SceneProgressHistory"("sceneId");

-- CreateIndex
CREATE INDEX "SceneProgressHistory_changedAt_idx" ON "ai_scoring"."SceneProgressHistory"("changedAt");

-- AddForeignKey
ALTER TABLE "ai_scoring"."Department" ADD CONSTRAINT "Department_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "ai_scoring"."Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."Section" ADD CONSTRAINT "Section_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ai_scoring"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."DeptPerson" ADD CONSTRAINT "DeptPerson_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "ai_scoring"."Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."DeptPerson" ADD CONSTRAINT "DeptPerson_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ai_scoring"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."DeptPerson" ADD CONSTRAINT "DeptPerson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ai_scoring"."Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."User" ADD CONSTRAINT "User_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "ai_scoring"."Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ai_scoring"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."User" ADD CONSTRAINT "User_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ai_scoring"."Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."Scene" ADD CONSTRAINT "Scene_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ai_scoring"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."Scene" ADD CONSTRAINT "Scene_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ai_scoring"."Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."SceneActualSavings" ADD CONSTRAINT "SceneActualSavings_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ai_scoring"."Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."SceneExecutionLog" ADD CONSTRAINT "SceneExecutionLog_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ai_scoring"."Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."SceneBenefit" ADD CONSTRAINT "SceneBenefit_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ai_scoring"."Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."SceneProgressHistory" ADD CONSTRAINT "SceneProgressHistory_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ai_scoring"."Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
