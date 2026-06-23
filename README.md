# Herdr Window Title Sync

Sync the outer terminal window/tab title to the focused Herdr workspace, tab, and agent session.

This is useful for terminals and clients that track the terminal title, similar to tmux `set-titles`.

I made this because I wanted Herdr sessions to show useful titles in [Moshi](https://getmoshi.app). Tmux already updates the terminal title, so resumed sessions are easy to recognize. Herdr did not do that in the same way, and `1` was not enough context.

## Install

```sh
herdr plugin install rjyo/herdr-window-title-sync
```

For local development:

```sh
herdr plugin link .
```

## What It Shows

The plugin chooses the first available title:

1. Herdr pane metadata title, when an integration reports one.
2. Herdr display agent and custom status.
3. Latest user prompt from local Codex or Claude Code session files.
4. Herdr's detected agent name.
5. The focused tab as a fallback.

Examples:

```text
codex: Implement title sync
claude
codex
```

## Manual Refresh

```sh
herdr plugin action invoke rjyo.window-title-sync.refresh
```

## Privacy

The plugin runs locally and does not send data over the network. As a fallback, it reads local Codex and Claude Code session JSONL files to find a useful title when Herdr does not expose one directly. That means prompt text may appear in your terminal window/tab title.

## Requirements

- Herdr `0.7.0` or newer
- Bun available on `PATH`
- macOS or Linux

## License

MIT
