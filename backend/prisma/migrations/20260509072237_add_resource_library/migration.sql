-- CreateTable
CREATE TABLE "ai_scoring"."ResourceCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."ResourceTool" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."ResourceItem" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "url" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring"."UserFavorite" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "toolId" INTEGER NOT NULL,
    "folderName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceCategory_name_key" ON "ai_scoring"."ResourceCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavorite_userId_toolId_key" ON "ai_scoring"."UserFavorite"("userId", "toolId");

-- AddForeignKey
ALTER TABLE "ai_scoring"."ResourceTool" ADD CONSTRAINT "ResourceTool_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ai_scoring"."ResourceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."ResourceTool" ADD CONSTRAINT "ResourceTool_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ai_scoring"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."ResourceItem" ADD CONSTRAINT "ResourceItem_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "ai_scoring"."ResourceTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring"."UserFavorite" ADD CONSTRAINT "UserFavorite_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "ai_scoring"."ResourceTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
