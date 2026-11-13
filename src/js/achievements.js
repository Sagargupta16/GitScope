// Achievement badges. GitHub's own badges show the tier read from the profile
// page plus progress to the next tier where the API exposes the count. The
// GitScope badges are this extension's own, counted from public activity.

import definitions from "../../shared/achievements.json";

export const ACHIEVEMENTS = definitions;

const LOGIN = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const BOT_AUTHORS = ["app/renovate", "app/dependabot", "app/github-actions"];

// The login goes into search qualifiers, so anything else could add a qualifier.
export function assertLogin(login) {
  if (!LOGIN.test(login)) throw new Error("Invalid GitHub username");
  return login;
}

export function searchQueries(login) {
  assertLogin(login);
  const bots = BOT_AUTHORS.map(bot => `-author:${bot}`).join(" ");
  return {
    pullShark: `is:pr is:merged author:${login}`,
    openSourcerer: `is:pr is:merged author:${login} -user:${login}`,
    reviewer: `is:pr is:merged reviewed-by:${login} -author:${login}`,
    bugReporter: `is:issue is:closed reason:completed linked:pr author:${login}`,
    maintainer: `is:pr is:merged user:${login} -author:${login} ${bots}`,
    publisher: `"uses: ${login}/" path:.github/workflows -user:${login}`,
  };
}

// level 0 is locked, 1 is the base badge, 2 to 4 are the x2 to x4 tiers.
export function progress(definition, count) {
  const thresholds = definition.thresholds;
  if (!Number.isFinite(count)) return { level: 0, count: null, next: thresholds[0] };
  const level = thresholds.filter(threshold => count >= threshold).length;
  return { level, count, next: thresholds[level] ?? null };
}

export function tierLabel(level) {
  return level >= 2 ? `x${level}` : "";
}

// GitHub turned achievements off in community/community (#106536), and answering
// a discussion you opened yourself does not count either. Measured against a live
// profile: 55 accepted answers, 14 countable, Galaxy Brain x2.
export function countableAnswers(nodes, login) {
  const self = login.toLowerCase();
  return nodes.filter(node => {
    const repo = node?.discussion?.repository?.nameWithOwner;
    const author = node?.discussion?.author?.login?.toLowerCase();
    return repo && repo.toLowerCase() !== "community/community" && author !== self;
  }).length;
}

// Each person's first merged pull request in a repo is a first-time contribution,
// so distinct (person, repo) pairs count them. Bots are skipped by type.
export function firstTimeContributions(nodes) {
  const pairs = new Set();
  for (const node of nodes) {
    if (node?.author?.__typename !== "User" || !node.repository?.nameWithOwner) continue;
    pairs.add(`${node.author.login.toLowerCase()}@${node.repository.nameWithOwner.toLowerCase()}`);
  }
  return pairs.size;
}

export function accountYears(createdAt, now = new Date()) {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return null;
  return Math.floor((now.getTime() - created) / (365.25 * 86_400_000));
}

// The profile page already lists earned badges with their tier, so no request is
// needed: an <a href="?achievement=slug"> holding the badge image and, from x2
// up, an .achievement-tier-label reading "x2" to "x4".
export function readEarnedAchievements(root) {
  const earned = new Map();
  for (const link of root.querySelectorAll('a[href*="achievement="]')) {
    const image = link.querySelector("img.achievement-badge-sidebar, img[data-hovercard-type='achievement']");
    if (!image) continue;
    let slug;
    try { slug = new URL(link.getAttribute("href"), "https://github.com").searchParams.get("achievement"); } catch { continue; }
    if (!slug || earned.has(slug)) continue;
    const tier = /^x([2-4])$/.exec(link.querySelector(".achievement-tier-label")?.textContent?.trim() ?? "");
    earned.set(slug, { level: tier ? Number(tier[1]) : 1, image: image.getAttribute("src") });
  }
  return earned;
}

// For GitHub's badges the profile page is the authority when it lists any badge:
// absent there means not earned, whatever the count suggests. Pass earned as null
// when the page shows none (hidden in settings, or a page without the list), and
// the count decides. The count then measures the way to the next tier.
export function badgeState(definition, metrics, earned, official = false) {
  const count = definition.metric ? metrics?.[definition.metric] : null;
  const computed = progress(definition, count);
  const seen = earned?.get(definition.id);
  const level = official && earned ? seen?.level ?? 0 : computed.level;
  return {
    level,
    count: computed.count,
    next: definition.thresholds[level] ?? null,
    image: seen?.image ?? null,
    atLeast: Boolean(definition.metric && metrics?.atLeast?.[definition.metric]),
  };
}
