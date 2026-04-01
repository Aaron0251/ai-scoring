DROP TABLE IF EXISTS "ExcelImportLog"    CASCADE;
DROP TABLE IF EXISTS "SystemConfig"      CASCADE;
DROP TABLE IF EXISTS "SceneBenefit"      CASCADE;
DROP TABLE IF EXISTS "SceneExecutionLog" CASCADE;
DROP TABLE IF EXISTS "SceneActualSavings" CASCADE;
DROP TABLE IF EXISTS "Scene"             CASCADE;
DROP TABLE IF EXISTS "OrgChief"          CASCADE;
DROP TABLE IF EXISTS "User"              CASCADE;
DROP TABLE IF EXISTS "DeptPerson"        CASCADE;
DROP TABLE IF EXISTS "Section"           CASCADE;
DROP TABLE IF EXISTS "Department"        CASCADE;
DROP TABLE IF EXISTS "Division"          CASCADE;

CREATE TABLE "Division" (
  "id"        SERIAL        PRIMARY KEY,
  "name"      VARCHAR(255)  NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE "Department" (
  "id"         SERIAL        PRIMARY KEY,
  "name"       VARCHAR(255)  NOT NULL,
  "divisionId" INTEGER       NOT NULL REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt"  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE ("name", "divisionId")
);

CREATE TABLE "Section" (
  "id"           SERIAL        PRIMARY KEY,
  "name"         VARCHAR(255)  NOT NULL,
  "departmentId" INTEGER       NOT NULL REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE ("name", "departmentId")
);

CREATE TABLE "DeptPerson" (
  "id"           SERIAL        PRIMARY KEY,
  "name"         VARCHAR(255)  NOT NULL,
  "title"        VARCHAR(255)  NOT NULL DEFAULT '',
  "divisionId"   INTEGER       REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "departmentId" INTEGER       REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "sectionId"    INTEGER       REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "active"       BOOLEAN       NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE "User" (
  "id"                 SERIAL        PRIMARY KEY,
  "username"           VARCHAR(255)  NOT NULL UNIQUE,
  "password"           VARCHAR(255)  NOT NULL,
  "name"               VARCHAR(255)  NOT NULL,
  "roles"              TEXT          NOT NULL,  
  "divisionId"         INTEGER       REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "departmentId"       INTEGER       REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "sectionId"          INTEGER       REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "mustChangePassword" BOOLEAN       NOT NULL DEFAULT FALSE,
  "active"             BOOLEAN       NOT NULL DEFAULT TRUE,
  "createdAt"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE "OrgChief" (
  "id"        SERIAL        PRIMARY KEY,
  "name"      VARCHAR(255)  NOT NULL,
  "role"      VARCHAR(255)  NOT NULL,
  "active"    BOOLEAN       NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE "Scene" (
  "id"                   SERIAL        PRIMARY KEY,
  "itemNo"               VARCHAR(255)  NOT NULL UNIQUE,
  "departmentId"         INTEGER       NOT NULL REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "sectionId"            INTEGER       REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE,

  "sceneName"            VARCHAR(255)  NOT NULL,
  "maintainOrDevelop"    VARCHAR(50),
  "itAssisted"           BOOLEAN,

  "developMethod"        TEXT,
  "developToolDesc"      TEXT,
  "agentCategory"        VARCHAR(255),

  "inputDesc"            TEXT,
  "outputDesc"           TEXT,
  "taskSteps"            TEXT,
  "rawDataExample"       TEXT,
  "finalDataExample"     TEXT,

  "timePerExecution"     VARCHAR(255),
  "monthlyFrequency"     VARCHAR(255),
  "demandCount"          INTEGER,

  "taskOwners"           TEXT,
  "seedOwners"           TEXT,
  "directSupervisor"     VARCHAR(255),

  "priority"             VARCHAR(20)   NOT NULL DEFAULT '中',
  "status"               VARCHAR(50)   NOT NULL DEFAULT '規劃中',
  "progress"             INTEGER       NOT NULL DEFAULT 0,

  "establishDate"        TIMESTAMPTZ,
  "targetDate"           TIMESTAMPTZ,
  "completedDate"        TIMESTAMPTZ,
  "goLiveDate"           TIMESTAMPTZ,

  "originalHours"        DOUBLE PRECISION,
  "improvedHours"        DOUBLE PRECISION,
  "timeSavedHours"       DOUBLE PRECISION,
  "actualTimeSavedHours" DOUBLE PRECISION,
  "originalHeadcount"    INTEGER,
  "improvedHeadcount"    INTEGER,
  "actualDemandCount"    INTEGER,

  "resultText"           TEXT,
  "actualResultText"     TEXT,
  "otherMetrics"         TEXT,

  "note"                 TEXT,
  "active"               BOOLEAN       NOT NULL DEFAULT TRUE,
  "importHash"           VARCHAR(255)  UNIQUE,
  "createdAt"            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE "SceneActualSavings" (
  "id"        SERIAL           PRIMARY KEY,
  "sceneId"   INTEGER          NOT NULL REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "year"      INTEGER          NOT NULL,
  "jan"       DOUBLE PRECISION,
  "feb"       DOUBLE PRECISION,
  "mar"       DOUBLE PRECISION,
  "apr"       DOUBLE PRECISION,
  "may"       DOUBLE PRECISION,
  "jun"       DOUBLE PRECISION,
  "jul"       DOUBLE PRECISION,
  "aug"       DOUBLE PRECISION,
  "sep"       DOUBLE PRECISION,
  "oct"       DOUBLE PRECISION,
  "nov"       DOUBLE PRECISION,
  "dec"       DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  UNIQUE ("sceneId", "year")
);

CREATE TABLE "SceneExecutionLog" (
  "id"        SERIAL        PRIMARY KEY,
  "sceneId"   INTEGER       NOT NULL REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "logDate"   TIMESTAMPTZ   NOT NULL,
  "executor"  VARCHAR(255),
  "content"   TEXT          NOT NULL,
  "status"    VARCHAR(50)   NOT NULL DEFAULT '完成',
  "note"      TEXT,
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE "SceneBenefit" (
  "id"          SERIAL        PRIMARY KEY,
  "sceneId"     INTEGER       NOT NULL REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "benefitType" VARCHAR(255)  NOT NULL,
  "description" TEXT,
  "value"       DOUBLE PRECISION,
  "unit"        VARCHAR(100),
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE "SystemConfig" (
  "id"        SERIAL        PRIMARY KEY,
  "key"       VARCHAR(255)  NOT NULL UNIQUE,
  "value"     TEXT          NOT NULL,
  "updatedAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE "ExcelImportLog" (
  "id"          SERIAL        PRIMARY KEY,
  "filename"    VARCHAR(255)  NOT NULL,
  "uploadedBy"  INTEGER       NOT NULL,
  "totalRows"   INTEGER       NOT NULL,
  "successRows" INTEGER       NOT NULL,
  "failedRows"  INTEGER       NOT NULL,
  "errors"      TEXT,
  "status"      VARCHAR(50)   NOT NULL,
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO "User" ("username", "password", "name", "roles") VALUES
  ('admin',
   '$2b$12$2FHk9xOtP7Wiu2AX3ThQQuNG6bD0nmH4ttDZXwu8YK8IhgXLiAm16',
   '系統管理員', '["admin"]');

INSERT INTO "SystemConfig" ("key", "value") VALUES
  ('target_hours',    '10000'),
  ('target_scenes',   '100'),
  ('auto_score_mode', 'draft');

SELECT setval(pg_get_serial_sequence('"User"',        'id'), MAX("id")) FROM "User";
SELECT setval(pg_get_serial_sequence('"SystemConfig"','id'), MAX("id")) FROM "SystemConfig";
