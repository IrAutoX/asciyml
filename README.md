# @irautox/asciyml

[![npm](https://img.shields.io/npm/v/@irautox/asciyml)](https://www.npmjs.com/package/@irautox/asciyml)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

**ASCIYaml** is a lightweight, zero-dependency YAML task runner and process manager for Node.js.

- 🚀 Run shell commands
- 📂 Watch files & directories
- ⏰ Schedule repeated tasks
- 🔄 Retry failed commands
- 📋 Priority-based execution
- ⚡ Zero dependencies

---

## Installation

```bash
npm install -g @irautox/asciyml
```

or

```bash
npx @irautox/asciyml
```

---

## Quick Start

Initialize a configuration:

```bash
asciyml init
```

Example `asciyml.yml`:

```yaml
tasks:
  - name: build
    action: npm run build
    priority: 10

  - name: dev
    action: npm run dev
    watch: true
    path: .

  - name: cleanup
    action: rm -rf ./logs/*
    interval: 3600
```

Run all enabled tasks:

```bash
asciyml run
```

Watch for file changes:

```bash
asciyml watch
```

Run scheduled tasks:

```bash
asciyml daemon
```

---

## Commands

| Command | Description |
|---------|-------------|
| `init` | Create `asciyml.yml` |
| `add` | Add a task |
| `remove` | Remove a task |
| `list` | Show tasks |
| `enable` | Enable a task |
| `disable` | Disable a task |
| `run` | Execute tasks |
| `watch` | Watch filesystem changes |
| `daemon` | Run interval tasks |
| `validate` | Validate configuration |
| `-v` | Show version |

---

## Features

- Zero dependencies
- YAML configuration
- Task priorities
- Execution delay
- Retry support
- Timeouts
- File watching
- Interval scheduler
- Working directory support
- Environment variables
- CLI & ESM API

---

## Example

```bash
asciyml add \
  --name build \
  --action "npm run build" \
  --priority 10
```

Run it:

```bash
asciyml run --name build
```

---

## License

MIT © IrAutoX & DeathAmir