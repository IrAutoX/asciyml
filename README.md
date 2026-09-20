# @irautox/asciyml

[![npm](https://img.shields.io/npm/v/@irautox/asciyml)](https://www.npmjs.com/package/@irautox/asciyml)
[![CI](https://github.com/IrAutoX/asciyml/actions/workflows/ci.yml/badge.svg)](https://github.com/IrAutoX/asciyml/actions/workflows/ci.yml)

**ASCIYaml 3** is a zero-dependency YAML automation engine for Node.js.

## What's new in 3.0
- Rebuilt nested YAML parser
- Cross-platform native process execution
- Task dependencies
- Parallel execution with concurrency limits
- Fail-fast mode
- Environment expansion
- Output capture and JSON results
- Timeouts and retries
- Priority scheduling
- File watching
- Interval daemon
- doctor/info diagnostics
- Built-in tests and build validation
- Node.js 18+ support

## Install
```bash
npm install -g @irautox/asciyml
```

## Quick start
```bash
asciyml init
asciyml validate
asciyml run
```

Example:
```yaml
version: 1
tasks:
  - name: prepare
    action: echo Preparing
    priority: 20
  - name: build
    action: npm run build
    dependsOn:
      - prepare
    env:
      NODE_ENV: production
    retry: 2
    retryDelay: 1000
    timeout: 120000
  - name: test
    action: npm test
    dependsOn:
      - build
```

Parallel:
```bash
asciyml run --parallel --concurrency 4
```

Diagnostics:
```bash
asciyml doctor
asciyml info
```

## Development
```bash
npm test
npm run build
```

MIT © IrAutoX & DeathAmir
