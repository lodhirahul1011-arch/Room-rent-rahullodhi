import { test, expect } from '@playwright/test';
import path from 'path';

const screenshotDir = 'C:/Users/rahul/.gemini/antigravity/brain/faba1095-9b6e-4eea-b398-d013aa8ca7d7/screenshots';

test.describe('RoomRent Complete Browser Journey E2E Suite', () => {

  test('1. Authentication Portal - Role Selection & Elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to RoomRent')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Owner' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tenant' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, '01-login-screen.png'), fullPage: true });
  });

  test('2. Owner Portal - Dashboard, Analytics & Key Metrics', async ({ page }) => {
    await page.goto('/owner/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: 'RoomRent' })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, '02-owner-dashboard.png'), fullPage: true });
  });

  test('3. Owner Portal - Property Management', async ({ page }) => {
    await page.goto('/owner/properties');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '03-owner-properties.png'), fullPage: true });
  });

  test('4. Owner Portal - Invoices & Billing Operations', async ({ page }) => {
    await page.goto('/owner/invoices');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '04-owner-invoices.png'), fullPage: true });
  });

  test('5. Owner Portal - Payment Verification Queue', async ({ page }) => {
    await page.goto('/owner/payments');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '05-owner-payments.png'), fullPage: true });
  });

  test('6. Owner Portal - Digital Khata Ledger', async ({ page }) => {
    await page.goto('/owner/ledger');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '06-owner-ledger.png'), fullPage: true });
  });

  test('7. Owner Portal - Maintenance Management', async ({ page }) => {
    await page.goto('/owner/maintenance');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '07-owner-maintenance.png'), fullPage: true });
  });

  test('8. Tenant Portal - Dashboard', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '08-tenant-dashboard.png'), fullPage: true });
  });

  test('9. Tenant Portal - Enrollment Application Form', async ({ page }) => {
    await page.goto('/tenant/enrollment');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '09-tenant-enrollment.png'), fullPage: true });
  });

  test('10. Tenant Portal - Invoices & Receipts', async ({ page }) => {
    await page.goto('/tenant/invoices');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '10-tenant-invoices.png'), fullPage: true });
  });

  test('11. Tenant Portal - Digital Ledger View', async ({ page }) => {
    await page.goto('/tenant/ledger');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '11-tenant-ledger.png'), fullPage: true });
  });

  test('12. Tenant Portal - Maintenance Complaint Issue Tracker', async ({ page }) => {
    await page.goto('/tenant/maintenance');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '12-tenant-maintenance.png'), fullPage: true });
  });

});
