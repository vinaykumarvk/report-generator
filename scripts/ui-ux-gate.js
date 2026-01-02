#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const axeCore = require("axe-core");

const gateConfig = {
  qa_gate_name: "enterprise_wealth_ui_ux_gate",
  version: "1.0",
  release_blocking: true,
  target_application_type: "wealth_management_enterprise",
  primary_device: "mobile",
  standards: {
    accessibility: "WCAG_2_1_AA",
    usability: "SUS",
    heuristics: "Nielsen_Enterprise",
    responsive: "Mobile_First",
  },
};

const BASE_URL = process.env.UI_UX_BASE_URL || "http://localhost:3000";
const PATHS = (process.env.UI_UX_PATHS || "/,/runs,/template-studio")
  .split(",")
  .map((p) => (p.startsWith("/") ? p : `/${p}`));
const CHROME_PATH =
  process.env.UI_UX_CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const mobileViewport = { width: 390, height: 844 };

function ensureChromePath() {
  if (fs.existsSync(CHROME_PATH)) {
    return CHROME_PATH;
  }
  return null;
}

function summarizeAxe(violations) {
  const ids = new Set();
  for (const violation of violations) {
    ids.add(violation.id);
  }
  return { count: violations.length, ruleIds: Array.from(ids) };
}

async function runAxe(page) {
  await page.addScriptTag({ content: axeCore.source });
  return page.evaluate(async () => {
    // @ts-ignore
    return await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa"],
      },
    });
  });
}

async function checkKeyboardNavigation(page) {
  const focusableCount = await page.evaluate(() => {
    const selectors = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ];
    return document.querySelectorAll(selectors.join(",")).length;
  });

  if (focusableCount === 0) {
    return { pass: false, detail: "No focusable elements found." };
  }

  const focusChanges = [];
  for (let i = 0; i < Math.min(10, focusableCount); i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = window.getComputedStyle(el);
      const hasOutline =
        style.outlineStyle !== "none" || style.boxShadow !== "none";
      const rect = el.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className || null,
        hasOutline,
        visible,
      };
    });
    if (info) {
      focusChanges.push(info);
    }
  }

  const uniqueTargets = new Set(
    focusChanges.map((item) => `${item.tag}:${item.id}:${item.className}`)
  );
  const allVisible = focusChanges.every((item) => item.visible);
  const anyFocusVisible = focusChanges.some((item) => item.hasOutline);

  return {
    pass: uniqueTargets.size > 1 && allVisible && anyFocusVisible,
    detail: `Focusable=${focusableCount}, tabbed=${uniqueTargets.size}, focusVisible=${anyFocusVisible}`,
  };
}

async function checkTouchTargets(page) {
  const tooSmall = await page.evaluate(() => {
    const selectors = [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      "[role='button']",
    ];
    const elements = Array.from(document.querySelectorAll(selectors.join(",")));
    return elements
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent || "").trim().slice(0, 40),
          width: rect.width,
          height: rect.height,
        };
      })
      .filter((el) => el.width > 0 && el.height > 0)
      .filter((el) => el.width < 44 || el.height < 44);
  });

  return {
    pass: tooSmall.length === 0,
    detail:
      tooSmall.length === 0
        ? "All targets >= 44px."
        : `${tooSmall.length} targets below 44px.`,
  };
}

async function checkHorizontalScroll(page) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    return { width, scrollWidth };
  });
  return {
    pass: result.scrollWidth <= result.width,
    detail: `clientWidth=${result.width}, scrollWidth=${result.scrollWidth}`,
  };
}

async function checkModalHeuristic(page) {
  const modalInfo = await page.evaluate(() => {
    const modal =
      document.querySelector("[role='dialog']") ||
      document.querySelector("[aria-modal='true']");
    if (!modal) return null;
    const rect = modal.getBoundingClientRect();
    return {
      top: rect.top,
      height: rect.height,
      viewportHeight: window.innerHeight,
    };
  });

  if (!modalInfo) {
    return { pass: true, detail: "No modal detected." };
  }

  const topRatio = modalInfo.top / modalInfo.viewportHeight;
  const bottomSheetPreferred = topRatio > 0.4;
  return {
    pass: bottomSheetPreferred,
    detail: `Modal top ratio ${topRatio.toFixed(2)} (bottom-sheet expected > 0.4).`,
  };
}

async function checkPrimaryCta(page) {
  const found = await page.evaluate(() => {
    const candidates = ["new report", "generate reports", "report studio"];
    const elements = Array.from(
      document.querySelectorAll("a,button,[role='button']")
    );
    return elements.some((el) =>
      candidates.some((label) =>
        (el.textContent || "").toLowerCase().includes(label)
      )
    );
  });
  return {
    pass: found,
    detail: found ? "Primary CTA found." : "Primary CTA not detected.",
  };
}

async function checkStatusVisibility(page) {
  const hasStatus = await page.evaluate(() => {
    return Boolean(
      document.querySelector("[aria-busy='true']") ||
        document.querySelector("[role='status']") ||
        document.querySelector("[role='alert']")
    );
  });
  return {
    pass: hasStatus,
    detail: hasStatus
      ? "Status/alert elements detected."
      : "No status/alert elements detected.",
  };
}

function computeSusScore(failures) {
  let score = 90;
  for (const failure of failures) {
    if (failure.severity === "high") score -= 5;
    if (failure.severity === "medium") score -= 2;
  }
  return Math.max(0, score);
}

async function runGate() {
  const chromePath = ensureChromePath();
  if (!chromePath) {
    console.error(
      "Chrome not found. Set UI_UX_CHROME_PATH to a local Chrome executable."
    );
    process.exit(2);
  }

  const browser = await chromium.launch({ executablePath: chromePath });
  const context = await browser.newContext({
    viewport: mobileViewport,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  const findings = [];
  const perPage = [];

  for (const pathSuffix of PATHS) {
    const url = new URL(pathSuffix, BASE_URL).toString();
    await page.goto(url, { waitUntil: "networkidle" });

    const axeResults = await runAxe(page);
    const contrastIssues = axeResults.violations.filter(
      (v) => v.id === "color-contrast"
    );
    const ariaIssues = axeResults.violations.filter((v) =>
      ["aria-allowed-attr", "aria-required-attr", "aria-required-parent", "landmark-one-main"].includes(
        v.id
      )
    );

    const keyboard = await checkKeyboardNavigation(page);
    const touchTargets = await checkTouchTargets(page);
    const scroll = await checkHorizontalScroll(page);
    const modal = await checkModalHeuristic(page);
    const cta = await checkPrimaryCta(page);
    const status = await checkStatusVisibility(page);

    perPage.push({
      url,
      axe: summarizeAxe(axeResults.violations),
      keyboard,
      touchTargets,
      scroll,
      modal,
      primaryCta: cta,
      status,
    });

    if (contrastIssues.length) {
      findings.push({
        gate: "accessibility_wcag",
        check: "wcag_contrast",
        severity: "high",
        detail: `${url} -> ${contrastIssues.length} contrast violations.`,
      });
    }
    if (ariaIssues.length) {
      findings.push({
        gate: "accessibility_wcag",
        check: "screen_reader_support",
        severity: "high",
        detail: `${url} -> ${ariaIssues.length} ARIA/landmark violations.`,
      });
    }
    if (!keyboard.pass) {
      findings.push({
        gate: "accessibility_wcag",
        check: "keyboard_navigation",
        severity: "high",
        detail: `${url} -> ${keyboard.detail}`,
      });
    }
    if (!touchTargets.pass) {
      findings.push({
        gate: "accessibility_wcag",
        check: "touch_targets",
        severity: "medium",
        detail: `${url} -> ${touchTargets.detail}`,
      });
    }
    if (!scroll.pass) {
      findings.push({
        gate: "mobile_responsive",
        check: "small_screen_support",
        severity: "high",
        detail: `${url} -> ${scroll.detail}`,
      });
    }
    if (!modal.pass) {
      findings.push({
        gate: "mobile_responsive",
        check: "mobile_modals",
        severity: "medium",
        detail: `${url} -> ${modal.detail}`,
      });
    }
    if (!cta.pass && pathSuffix === "/") {
      findings.push({
        gate: "usability_sus",
        check: "task_clarity",
        severity: "high",
        detail: `${url} -> ${cta.detail}`,
      });
    }
    if (!status.pass) {
      findings.push({
        gate: "enterprise_ux_heuristics",
        check: "system_status_visibility",
        severity: "high",
        detail: `${url} -> ${status.detail}`,
      });
    }
  }

  await browser.close();

  const susScore = computeSusScore(findings);
  const releaseDecision =
    findings.some((f) => f.severity === "high") && gateConfig.release_blocking
      ? "NO_GO"
      : "GO";

  const report = {
    gate: gateConfig,
    baseUrl: BASE_URL,
    paths: PATHS,
    pages: perPage,
    findings,
    summary: {
      wcag_status: findings.some((f) => f.gate === "accessibility_wcag")
        ? "fail"
        : "pass",
      sus_score: susScore,
      mobile_readiness: findings.some((f) => f.gate === "mobile_responsive")
        ? "fail"
        : "pass",
      release_decision: releaseDecision,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (releaseDecision === "NO_GO") {
    process.exit(1);
  }
}

runGate().catch((err) => {
  console.error(err);
  process.exit(1);
});
