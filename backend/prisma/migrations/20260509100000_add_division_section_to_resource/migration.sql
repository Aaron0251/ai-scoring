-- Add divisionId and sectionId to ResourceCategory and ResourceTool
ALTER TABLE ai_scoring."ResourceCategory" ADD COLUMN IF NOT EXISTS "divisionId" INTEGER;
ALTER TABLE ai_scoring."ResourceCategory" ADD COLUMN IF NOT EXISTS "sectionId" INTEGER;
ALTER TABLE ai_scoring."ResourceCategory" ADD CONSTRAINT "ResourceCategory_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES ai_scoring."Division"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE ai_scoring."ResourceCategory" ADD CONSTRAINT "ResourceCategory_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES ai_scoring."Section"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE ai_scoring."ResourceTool" ADD COLUMN IF NOT EXISTS "divisionId" INTEGER;
ALTER TABLE ai_scoring."ResourceTool" ADD COLUMN IF NOT EXISTS "sectionId" INTEGER;
ALTER TABLE ai_scoring."ResourceTool" ADD CONSTRAINT "ResourceTool_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES ai_scoring."Division"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE ai_scoring."ResourceTool" ADD CONSTRAINT "ResourceTool_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES ai_scoring."Section"(id) ON DELETE SET NULL ON UPDATE CASCADE;
