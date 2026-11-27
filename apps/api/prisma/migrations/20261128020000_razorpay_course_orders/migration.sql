ALTER TYPE "DirectPaymentMethod" ADD VALUE IF NOT EXISTS 'RAZORPAY';
ALTER TABLE "CourseOrder"
  ADD COLUMN "razorpayOrderId" TEXT,
  ADD COLUMN "razorpayPaymentId" TEXT,
  ADD COLUMN "checkoutKey" TEXT;
CREATE UNIQUE INDEX "CourseOrder_razorpayOrderId_key" ON "CourseOrder"("razorpayOrderId");
CREATE UNIQUE INDEX "CourseOrder_razorpayPaymentId_key" ON "CourseOrder"("razorpayPaymentId");
CREATE UNIQUE INDEX "CourseOrder_checkoutKey_key" ON "CourseOrder"("checkoutKey");
