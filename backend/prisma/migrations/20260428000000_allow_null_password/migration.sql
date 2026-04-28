-- AlterTable: 允許 password 為 null（AD 帳號不存 DB 密碼）
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
