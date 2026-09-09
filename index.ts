/**
 * pi-lazygit - open lazygit from inside pi.
 *
 * `/lazygit` (or shortcut) suspends pi's TUI, hands lazygit the whole
 * terminal, and restores pi when lazygit exits.
 *
 * When pi-vim is installed, the shortcut is restricted to normal mode.
 * Without pi-vim the shortcut stays unconditional.
 */

import { spawnSync } from "node:child_process";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const COMMAND = "lazygit";
const SHORTCUT = "space+g";
const VIM_MODE_CHANGE_EVENT = "pi-vim:mode-change";

/** pi-vim's `Mode`; `null` means pi-vim never announced a mode (not installed). */
type VimMode = "normal" | "insert" | "visual" | "visual-line" | null;

function readVimMode(data: unknown): VimMode {
  if (typeof data !== "object" || data === null) return null;
  const mode = (data as { mode?: unknown }).mode;
  return mode === "normal" ||
    mode === "insert" ||
    mode === "visual" ||
    mode === "visual-line"
    ? mode
    : null;
}

/** Suspend the TUI, run lazygit inheriting stdio, then restore the TUI. */
function runLazygit(ctx: ExtensionContext): Promise<number | null> {
  return ctx.ui.custom<number | null>((tui, _theme, _keybindings, done) => {
    tui.stop();
    process.stdout.write("\x1b[2J\x1b[H");

    const result = spawnSync(COMMAND, {
      stdio: "inherit",
      env: process.env,
      cwd: ctx.cwd,
    });

    tui.start();
    tui.requestRender(true);
    done(result.error ? null : result.status);
    return { render: () => [], invalidate: () => {} };
  });
}

async function open(ctx: ExtensionContext): Promise<void> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify("lazygit needs an interactive terminal", "error");
    return;
  }
  const status = await runLazygit(ctx);
  if (status === null) {
    ctx.ui.notify("Could not start lazygit - is it on your PATH?", "error");
  }
}

export default function (pi: ExtensionAPI) {
  let vimMode: VimMode = null;
  pi.events.on(VIM_MODE_CHANGE_EVENT, (data) => {
    const mode = readVimMode(data);
    if (mode) vimMode = mode;
  });

  pi.registerCommand(COMMAND, {
    description: "Open lazygit",
    handler: async (_args, ctx) => {
      await open(ctx);
    },
  });

  pi.registerShortcut(SHORTCUT, {
    description: "Open lazygit",
    handler: async (ctx) => {
      if (vimMode !== null && vimMode !== "normal") return;
      await open(ctx);
    },
  });
}
