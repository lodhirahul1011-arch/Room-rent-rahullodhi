import { test, expect } from '@playwright/test';

test('login presents the role selector', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Sign in to RoomRent')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tenant' })).toBeVisible();
});
