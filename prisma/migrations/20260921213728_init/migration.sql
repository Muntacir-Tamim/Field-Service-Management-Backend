/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `technicians` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `technicians` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `technicians` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "technicians" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "technicians_email_key" ON "technicians"("email");
