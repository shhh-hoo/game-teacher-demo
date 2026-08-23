import { test, expect } from '@playwright/test';

const LIVE = process.env.DIFY_BROWSER_LIVE === '1';

test.skip(!LIVE, 'Set DIFY_BROWSER_LIVE=1 to run against the published Dify workflow.');

async function apiTurn(page, action) {
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/chat') && response.request().method() === 'POST',
    { timeout: 120_000 },
  );
  await action();
  const response = await responsePromise;
  const raw = await response.text();
  if (!response.ok()) {
    throw new Error(`API returned ${response.status()}: ${raw.slice(0, 4000)}`);
  }
  const payload = JSON.parse(raw);
  await expect(page.locator('.thinking')).toHaveCount(0, { timeout: 120_000 });
  return payload;
}

async function clickWorld(page, id) {
  return apiTurn(page, () => page.locator(`[data-world-object="${id}"]`).click());
}

async function send(page, text) {
  await page.locator('#studentInput').fill(text);
  return apiTurn(page, () => page.locator('#sendButton').click());
}

async function expectPosition(page, id, row, column) {
  await expect.poll(async () => page.locator(`[data-world-object="${id}"]`).evaluate(el => ({
    row: el.style.gridRow,
    column: el.style.gridColumn,
  })), { timeout: 10_000 }).toEqual({ row: String(row), column: String(column) });
}

async function visibleCellSymbol(page, id) {
  return page.locator(`[data-world-object="${id}"] .object-symbol`).innerText();
}

test('real lesson keeps language, visible actions, and ownership aligned', async ({ page }) => {
  await page.goto('/');

  let payload = await apiTurn(page, () => page.getByRole('button', { name: 'Start lesson' }).click());
  expect(payload.debug?.build_id || '').toContain('r15-');

  // Follow: complete the authored listener-perspective task.
  await clickWorld(page, 'follow_triangle');
  await clickWorld(page, 'follow_tr');
  await clickWorld(page, 'follow_triangle');
  await clickWorld(page, 'follow_tl');
  await clickWorld(page, 'follow_circle');
  await clickWorld(page, 'follow_tc');
  await clickWorld(page, 'follow_square');
  await clickWorld(page, 'follow_bc');
  await expect(page.locator('#continueStageButton')).toBeVisible();

  payload = await apiTurn(page, () => page.locator('#continueStageButton').click());
  expect(payload.phase).toBe('guide');

  // Guide: ordinary relational wording must execute rather than degrade into a clarification loop.
  await send(page, 'Put the triangle in the top center.');
  await expectPosition(page, 'guide_triangle', 1, 2);

  payload = await send(page, 'Put the square immediately to the left of the triangle.');
  await expectPosition(page, 'guide_square', 1, 1);
  expect(payload.ui_action?.type).toBe('action_sequence');

  payload = await send(page, 'Put the circle in the bottom left.');
  await expectPosition(page, 'guide_circle', 2, 1);
  await expect(page.locator('.game-choice')).toHaveCount(4);

  payload = await apiTurn(page, () => page.getByRole('button', { name: 'Tic-Tac-Toe', exact: true }).click());
  expect(payload.phase).toBe('student_teaching');

  // A structural grid must appear empty: no decorative identities and no positional answers printed into cells.
  payload = await send(page, 'We need a 3 by 3 grid. The goal is to get three X marks or three O marks in the same line.');
  expect(payload.debug?.build_id || '').toContain('r15-');
  const cells = page.locator('[data-world-object^="cell_"]');
  await expect(cells).toHaveCount(9, { timeout: 30_000 });

  const cellText = await cells.evaluateAll(nodes => nodes.map(node => node.innerText.trim()));
  for (const text of cellText) {
    expect(text, `empty structural cell leaked visible content: ${text}`).toBe('');
  }
  const added = payload.world_patch?.add_objects || [];
  expect(added.some(object => /[★●▲◆]/u.test(String(object.symbol || '')))).toBeFalsy();

  // A delegated Raku turn must create a visible X before Raku can narrate that it moved.
  payload = await send(page, 'You go first and put X in any empty square.');
  const rakuActions = payload.ui_action?.payload?.actions || [];
  expect(rakuActions.length, 'Raku narrated/accepted a turn without an executable action').toBeGreaterThan(0);
  const rakuMarkAction = rakuActions.find(action => action.patch?.symbol === 'X');
  expect(rakuMarkAction, 'no X action was produced for Raku’s delegated turn').toBeTruthy();
  expect(rakuMarkAction.patch?.owner).toBe('raku');

  await expect.poll(async () => cells.evaluateAll(nodes => nodes.map(node => node.querySelector('.object-symbol')?.textContent?.trim() || '')), {
    timeout: 10_000,
  }).toContain('X');

  const xCellId = rakuMarkAction.object_id;
  const candidates = [
    ['cell_1_1', 'top left'],
    ['cell_3_3', 'bottom right'],
    ['cell_1_3', 'top right'],
  ];
  const [learnerCellId, learnerPlace] = candidates.find(([id]) => id !== xCellId) || candidates[0];

  // Learner action remains learner-owned in both the board and Raku's narration.
  payload = await send(page, `I put O in the ${learnerPlace} square.`);
  const learnerActions = payload.ui_action?.payload?.actions || [];
  const learnerMarkAction = learnerActions.find(action => action.object_id === learnerCellId && action.patch?.symbol === 'O');
  expect(learnerMarkAction, 'learner O action was not grounded to the requested cell').toBeTruthy();
  expect(learnerMarkAction.patch?.owner).toBe('learner');
  await expect.poll(() => visibleCellSymbol(page, learnerCellId), { timeout: 10_000 }).toBe('O');
  expect(payload.reply || '').not.toMatch(/\bI\s+(?:put|placed|marked).*\bO\b|\bmy\s+O\b/i);

  await page.screenshot({ path: '.artifacts/browser-live-final.png', fullPage: true });
});
