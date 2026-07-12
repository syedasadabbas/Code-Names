import { test, expect, type Browser, type Page } from "@playwright/test";
import type { GameVariant } from "@shared/protocol";

// End-to-end coverage of the real-time multiplayer flow for BOTH game variants:
// create/join a room, assign teams & roles, start the game, give a clue that
// propagates in real time to another client, then guess a team's agents to a win.

async function createRoom(page: Page, name: string, variant: GameVariant = "classic"): Promise<string> {
  await page.goto("/");
  await page.getByPlaceholder("e.g. Agent Nova").fill(name);
  await page.getByTestId(`create-${variant}`).click();
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  return page.url().split("/room/")[1];
}

async function joinRoom(page: Page, code: string, name: string): Promise<void> {
  await page.goto("/");
  await page.getByPlaceholder("e.g. Agent Nova").fill(name);
  const join = page.locator("section", { hasText: "Join a room" });
  await join.getByPlaceholder("ABCD").fill(code);
  await join.getByRole("button", { name: "Join", exact: true }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
}

async function joinTeam(page: Page, team: "red" | "blue", spymaster: boolean): Promise<void> {
  const testId = `join-${team}-${spymaster ? "spymaster" : "operative"}`;
  await page.getByTestId(testId).click();
}

async function readRoles(spymasterPage: Page): Promise<string[]> {
  const cards = spymasterPage.getByTestId("card");
  const n = await cards.count();
  const roles: string[] = [];
  for (let i = 0; i < n; i++) {
    roles.push((await cards.nth(i).getAttribute("data-role")) ?? "");
  }
  return roles;
}

test("landing page: creating a room shows the lobby with a room code", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const code = await createRoom(page, "Host");
  expect(code).toMatch(/^[A-Z0-9]{4}$/);
  await expect(page.getByText(code, { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("col-red")).toBeVisible();
  await ctx.close();
});

async function playFullGameToWin(browser: Browser, variant: GameVariant, expectedAgents: number) {
  const mk = async (b: Browser) => {
    const ctx = await b.newContext();
    return { ctx, page: await ctx.newPage() };
  };
  const p1 = await mk(browser); // red spymaster (host)
  const p2 = await mk(browser); // red operative
  const p3 = await mk(browser); // blue spymaster
  const p4 = await mk(browser); // blue operative

  const code = await createRoom(p1.page, "RedMaster", variant);
  await joinRoom(p2.page, code, "RedField");
  await joinRoom(p3.page, code, "BlueMaster");
  await joinRoom(p4.page, code, "BlueField");

  await joinTeam(p1.page, "red", true);
  await joinTeam(p2.page, "red", false);
  await joinTeam(p3.page, "blue", true);
  await joinTeam(p4.page, "blue", false);

  await p1.page.getByRole("button", { name: "Start game" }).click();

  // Board renders for everyone (real-time), and reflects the chosen variant.
  await expect(p1.page.getByTestId("card").first()).toBeVisible();
  await expect(p4.page.getByTestId("card").first()).toBeVisible();
  await expect(p4.page.getByTestId("game-state")).toHaveAttribute("data-variant", variant);

  // Determine the starting team from the (red) spymaster's key view.
  const roles = await readRoles(p1.page);
  const redCount = roles.filter((r) => r === "red").length;
  const startingTeam: "red" | "blue" = redCount === expectedAgents ? "red" : "blue";

  const spymaster = startingTeam === "red" ? p1.page : p3.page;
  const operative = startingTeam === "red" ? p2.page : p4.page;
  const otherClient = startingTeam === "red" ? p4.page : p2.page;

  const targets: number[] = [];
  roles.forEach((r, i) => {
    if (r === startingTeam) targets.push(i);
  });
  expect(targets.length).toBe(expectedAgents);

  // The starting spymaster gives a clue (number = agent count → enough guesses).
  await expect(spymaster.getByPlaceholder("CLUE")).toBeVisible();
  await spymaster.getByPlaceholder("CLUE").fill("QWXZVKJ");
  await spymaster.getByRole("combobox").selectOption(String(expectedAgents));
  await spymaster.getByRole("button", { name: "Give clue" }).click();

  // Real-time propagation: the clue appears on the operative's screen too.
  await expect(operative.getByText("QWXZVKJ", { exact: true })).toBeVisible();

  for (const idx of targets) {
    const card = operative.locator(`[data-testid="card"][data-index="${idx}"]`);
    await card.click();
    await expect(card).toHaveAttribute("data-revealed", "true");
  }

  await expect(operative.getByTestId("game-state")).toHaveAttribute("data-winner", startingTeam);
  await expect(otherClient.getByTestId("game-state")).toHaveAttribute("data-winner", startingTeam);
  await expect(operative.getByText(`${startingTeam.toUpperCase()} TEAM WINS!`)).toBeVisible();

  for (const p of [p1, p2, p3, p4]) await p.ctx.close();
}

test("classic (words): four players play a full game to a win, synced in real time", async ({ browser }) => {
  test.setTimeout(90_000);
  await playFullGameToWin(browser, "classic", 9);
});

test("pictures: four players play a full game to a win, synced in real time", async ({ browser }) => {
  test.setTimeout(90_000);
  await playFullGameToWin(browser, "pictures", 8);
});

test("coop: two players win by contacting all their agents", async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const spymaster = await ctx1.newPage();
  const operative = await ctx2.newPage();

  const code = await createRoom(spymaster, "Solo", "coop");
  await joinRoom(operative, code, "Buddy");

  // Single human team (blue). Assign roles explicitly.
  await joinTeam(spymaster, "blue", true);
  await joinTeam(operative, "blue", false);

  await spymaster.getByRole("button", { name: "Start game" }).click();
  await expect(operative.getByTestId("card").first()).toBeVisible();
  await expect(operative.getByTestId("game-state")).toHaveAttribute("data-variant", "coop");

  // Read the key from the spymaster and reveal all of the team's (blue) agents.
  const roles = await readRoles(spymaster);
  const targets: number[] = [];
  roles.forEach((r, i) => {
    if (r === "blue") targets.push(i);
  });
  expect(targets.length).toBe(9);

  await spymaster.getByPlaceholder("CLUE").fill("QWXZVKJ");
  await spymaster.getByRole("combobox").selectOption("9");
  await spymaster.getByRole("button", { name: "Give clue" }).click();
  await expect(operative.getByText("QWXZVKJ", { exact: true })).toBeVisible();

  for (const idx of targets) {
    const card = operative.locator(`[data-testid="card"][data-index="${idx}"]`);
    await card.click();
    await expect(card).toHaveAttribute("data-revealed", "true");
  }

  await expect(operative.getByTestId("game-state")).toHaveAttribute("data-winner", "blue");
  await expect(operative.getByText("MISSION ACCOMPLISHED!")).toBeVisible();

  await ctx1.close();
  await ctx2.close();
});

test("privacy: host can toggle a room between public and private", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await createRoom(page, "Host"); // public by default
  const toggle = page.getByTestId("privacy-toggle");
  await expect(toggle).toHaveText(/Make private/); // currently public
  await toggle.click();
  await expect(toggle).toHaveText(/Make public/); // now private
  await toggle.click();
  await expect(toggle).toHaveText(/Make private/); // public again
  await ctx.close();
});

test("quick match: second player lands in the first player's public room", async ({ browser }) => {
  test.setTimeout(60_000);
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();

  // Use the co-op filter so no leftover lobby from other tests interferes
  // (the co-op game test starts its game, so no open co-op lobby exists).
  const quickMatch = async (page: Page, name: string) => {
    await page.goto("/");
    await page.getByPlaceholder("e.g. Agent Nova").fill(name);
    await page.getByTestId("match-variant").selectOption("coop");
    await page.getByTestId("find-match").click();
    await page.waitForURL(/\/room\/[A-Z0-9]+/);
    return page.url().split("/room/")[1];
  };

  // First player: no open room yet, so a fresh public room is created.
  const code1 = await quickMatch(p1, "Q1");
  // Second player: should be matched into the first player's room.
  const code2 = await quickMatch(p2, "Q2");

  expect(code2).toBe(code1);
  // Both players are present in that room.
  await expect(p2.getByText("Q1", { exact: false }).first()).toBeVisible();
  await expect(p1.getByText("Q2", { exact: false }).first()).toBeVisible();

  await c1.close();
  await c2.close();
});
