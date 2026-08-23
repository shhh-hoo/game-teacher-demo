import { test, expect } from '@playwright/test';

function guideWorld() {
  const zones = [];
  for (let row = 1; row <= 2; row += 1) {
    for (let column = 1; column <= 3; column += 1) {
      const id = `mock_${row}_${column}`;
      const labels = {
        '1_1': 'Top-Left', '1_2': 'Top-Center', '1_3': 'Top-Right',
        '2_1': 'Bottom-Left', '2_2': 'Bottom-Center', '2_3': 'Bottom-Right',
      };
      zones.push({
        id,
        kind: 'zone',
        label: labels[`${row}_${column}`],
        symbol: '·',
        caption: labels[`${row}_${column}`].toLowerCase(),
        state: 'available',
        row,
        column,
        owner: null,
        interactive: false,
      });
    }
  }
  return {
    name: 'This Time You Lead',
    surface: { type: 'grid', rows: 3, columns: 3 },
    objects: zones,
    counters: [],
    turn: 'You',
    status: '',
    ready: true,
  };
}

test('chat owns its scroll and positional labels stay visually hidden', async ({ page }) => {
  let turn = 0;
  await page.route('**/api/chat', async route => {
    turn += 1;
    const request = route.request();
    const body = request.postDataJSON();
    const initial = body?.event?.type === 'lesson_start';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: initial
          ? 'Tell me what to move.'
          : `Reply ${turn}: I am following the words you gave me, and this deliberately long reply gives the chat enough content to exercise its own scroll container.`,
        phase: 'guide',
        world_patch: initial ? { replace: guideWorld() } : {},
        ui_action: { type: 'none', payload: {} },
        support: initial ? {
          type: 'reconstruction_task',
          target_preview: [
            { shape: 'square', row: 1, column: 1 },
            { shape: 'triangle', row: 1, column: 2 },
            { shape: 'circle', row: 2, column: 1 },
          ],
        } : null,
        conversationId: 'browser-mock',
        messageId: `mock-${turn}`,
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.locator('#studentInput')).toBeVisible();

  // The spatial task must not print the answer vocabulary onto the board.
  await expect(page.locator('.dual-board .world-object small')).toHaveCount(0);
  const hiddenZoneSymbol = page.locator('.dual-board .kind-zone .object-symbol').first();
  await expect(hiddenZoneSymbol).toBeHidden();

  for (let i = 1; i <= 14; i += 1) {
    await page.locator('#studentInput').fill(`Message ${i}`);
    await page.locator('#sendButton').click();
    await expect(page.locator('.thinking')).toHaveCount(0);
  }

  const metrics = await page.locator('#chatLog').evaluate(el => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    scrollTop: el.scrollTop,
    overflowY: getComputedStyle(el).overflowY,
  }));

  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(['auto', 'scroll']).toContain(metrics.overflowY);
  expect(metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight).toBeLessThan(48);

  // World and composer remain in the viewport while chat history grows.
  await expect(page.locator('.world-shell')).toBeVisible();
  await expect(page.locator('#studentInput')).toBeVisible();
});
