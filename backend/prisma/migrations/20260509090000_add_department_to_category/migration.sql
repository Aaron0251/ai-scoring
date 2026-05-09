-- AlterTable: ResourceCategory - add departmentId, drop global unique, add composite unique
ALTER TABLE ai_scoring."ResourceCategory" DROP CONSTRAINT IF EXISTS "ResourceCategory_name_key";
ALTER TABLE ai_scoring."ResourceCategory" ADD COLUMN IF NOT EXISTS "departmentId" INTEGER;
ALTER TABLE ai_scoring."ResourceCategory" ADD CONSTRAINT "ResourceCategory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES ai_scoring."Department"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE ai_scoring."ResourceCategory" ADD CONSTRAINT "ResourceCategory_name_departmentId_key" UNIQUE ("name", "departmentId");
