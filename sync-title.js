#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname as pathDirname, join } from "node:path";

const herdr = process.env.HERDR_BIN_PATH || "herdr";
const stateDir = process.env.HERDR_PLUGIN_STATE_DIR || "/tmp";
const statePath = join(stateDir, "last-title");

function run(args) {
  const result = spawnSync(herdr, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(`${herdr} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

function json(args) {
  const output = run(args);
  return output ? JSON.parse(output) : null;
}

function cleanPart(value) {
  return String(value ?? "")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactTitle(value) {
  return cleanPart(value)
    .replace(/^<command-name>.*?<\/command-name>\s*/i, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/^>\s*/, "")
    .replace(/^›\s*/, "")
    .trim();
}

function homePath(...parts) {
  const home = process.env.HOME;
  return home ? join(home, ...parts) : "";
}

function findFirst(args) {
  const result = spawnSync("find", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return "";
  return result.stdout.split("\n").find(Boolean) || "";
}

function tabTitle(tab) {
  const number = tab?.number != null ? String(tab.number) : "";
  const label = cleanPart(tab?.label);

  if (!label) return number || "tab";
  if (label === number) return number;
  return number ? `${number}.${label}` : label;
}

function agentTitle(pane) {
  return cleanPart(pane?.display_agent || pane?.agent).toLowerCase();
}

function appTitle(pane) {
  const agent = agentTitle(pane);
  const title = cleanPart(pane?.title);
  if (title) return agent ? `${agent}: ${title}` : title;

  const status = cleanPart(pane?.custom_status);
  if (agent && status) return `${agent}: ${status}`;

  const sessionTitle = sessionFileTitle(pane);
  if (agent && sessionTitle) return `${agent}: ${sessionTitle}`;
  if (sessionTitle) return sessionTitle;
  if (agent) return agent;

  return "";
}

function sessionFileTitle(pane) {
  const session = pane?.agent_session;
  const agent = cleanPart(session?.agent || pane?.agent).toLowerCase();
  const id = cleanPart(session?.value);
  if (!agent || !id) return "";

  if (agent === "codex") return codexSessionTitle(id);
  if (agent === "claude") return claudeSessionTitle(id);
  return "";
}

function codexSessionTitle(id) {
  const root = homePath(".codex", "sessions");
  if (!root || !existsSync(root)) return "";

  const path = findFirst([root, "-type", "f", "-name", `*${id}.jsonl`]);
  if (!path) return "";

  let latest = "";
  for (const line of readLines(path)) {
    const entry = parseJson(line);
    if (entry?.type !== "event_msg") continue;
    const payload = entry.payload;
    if (payload?.type !== "user_message") continue;
    const message = compactTitle(payload.message);
    if (usableSessionTitle(message)) latest = message;
  }
  return latest;
}

function claudeSessionTitle(id) {
  const root = homePath(".claude", "projects");
  if (!root || !existsSync(root)) return "";

  const path = findFirst([root, "-type", "f", "-name", `${id}.jsonl`]);
  if (!path) return "";

  let latest = "";
  for (const line of readLines(path)) {
    const entry = parseJson(line);
    if (entry?.type !== "user" || entry.isMeta) continue;
    const message = entry.message?.content;
    const text = Array.isArray(message)
      ? message.map((part) => typeof part === "string" ? part : part?.text).filter(Boolean).join(" ")
      : message;
    const title = compactTitle(text);
    if (usableSessionTitle(title)) latest = title;
  }
  return latest;
}

function readLines(path) {
  try {
    return readFileSync(path, "utf8").split("\n");
  } catch {
    return [];
  }
}

function parseJson(line) {
  try {
    return line.trim() ? JSON.parse(line) : null;
  } catch {
    return null;
  }
}

function usableSessionTitle(title) {
  if (!title || title.length < 2) return false;
  if (title.startsWith("/clear")) return false;
  if (title.startsWith("<local-command")) return false;
  return true;
}

function buildTitle() {
  const pane = json(["pane", "current"])?.result?.pane;
  if (!pane) return "herdr";

  const tab = json(["tab", "get", pane.tab_id])?.result?.tab;

  const fallbackTitle = tabTitle(tab);
  const title = appTitle(pane);

  return (title || fallbackTitle).slice(0, 80);
}

function lastTitle() {
  try {
    return readFileSync(statePath, "utf8").trim();
  } catch {
    return "";
  }
}

function saveTitle(title) {
  mkdirSync(pathDirname(statePath), { recursive: true });
  writeFileSync(statePath, `${title}\n`);
}

try {
  const title = buildTitle();
  if (title !== lastTitle()) {
    run(["terminal", "title", "set", title]);
    saveTitle(title);
  }
  console.log(title);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
