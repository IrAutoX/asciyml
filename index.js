#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { exec } from 'node:child_process';

const CONFIG_FILE = path.join(process.cwd(), 'asciyml.yml');

function parseValue(raw) {
  raw = raw.trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+\.?\d*$/.test(raw)) return Number(raw);
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }
  return raw;
}

export function parseYaml(content) {
  const lines = content.split('\n');
  const tasks = [];
  let current = null;
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { i++; continue; }
    if (trimmed.startsWith('-')) {
      if (current) tasks.push(current);
      current = {};
      trimmed = trimmed.substring(1).trim();
      i++;
      const subLines = [];
      let baseIndent = line.indexOf('-');
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();
        if (!nextTrimmed || nextTrimmed.startsWith('#')) { i++; continue; }
        const indent = nextLine.search(/\S/);
        if (indent <= baseIndent) break;
        subLines.push(nextLine);
        i++;
      }
      for (const sl of subLines) {
        const st = sl.trim();
        if (st.includes(':')) {
          const colonIdx = st.indexOf(':');
          const key = st.substring(0, colonIdx).trim();
          const valPart = st.substring(colonIdx + 1).trim();
          if (valPart === '') {
            const nestedLines = [];
            i++;
            if (i < lines.length) {
              const keyIndent = sl.search(/\S/);
              while (i < lines.length) {
                const nl = lines[i];
                const nlTrimmed = nl.trim();
                if (!nlTrimmed || nlTrimmed.startsWith('#')) { i++; continue; }
                const nlIndent = nl.search(/\S/);
                if (nlIndent <= keyIndent) break;
                nestedLines.push(nl);
                i++;
              }
            }
            let nestedMap = {};
            for (const nl of nestedLines) {
              const nt = nl.trim();
              if (nt.includes(':')) {
                const [nk, ...nvParts] = nt.split(':');
                const nv = nvParts.join(':').trim();
                nestedMap[nk.trim()] = parseValue(nv);
              }
            }
            current[key] = nestedMap;
          } else {
            current[key] = parseValue(valPart);
          }
        }
      }
      continue;
    }
    i++;
  }
  if (current) tasks.push(current);
  return { tasks };
}

export function stringifyYaml(data) {
  let out = 'tasks:\n';
  for (const t of data.tasks) {
    out += `  - name: ${JSON.stringify(t.name || '')}\n`;
    out += `    description: ${JSON.stringify(t.description || '')}\n`;
    out += `    enabled: ${t.enabled !== undefined ? t.enabled : true}\n`;
    out += `    path: ${JSON.stringify(t.path || '')}\n`;
    out += `    action: ${JSON.stringify(t.action || '')}\n`;
    out += `    priority: ${t.priority || 0}\n`;
    out += `    delay: ${t.delay || 0}\n`;
    out += `    timeout: ${t.timeout || 0}\n`;
    out += `    retry: ${t.retry || 0}\n`;
    out += `    retryDelay: ${t.retryDelay || 0}\n`;
    out += `    interval: ${t.interval || 0}\n`;
    out += `    watch: ${t.watch || false}\n`;
    out += `    cwd: ${JSON.stringify(t.cwd || '')}\n`;
    if (typeof t.env === 'object' && t.env !== null) {
      out += `    env: ${JSON.stringify(JSON.stringify(t.env))}\n`;
    } else {
      out += `    env: ${JSON.stringify(t.env || '')}\n`;
    }
  }
  return out;
}

export function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return { tasks: [] };
  try {
    return parseYaml(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    console.error(`[-] Error reading config file: ${err.message}`);
    return { tasks: [] };
  }
}

export function saveConfig(data) {
  try {
    fs.writeFileSync(CONFIG_FILE, stringifyYaml(data), 'utf8');
    console.log(`[+] Successfully wrote config to ${CONFIG_FILE}`);
  } catch (err) {
    console.error(`[-] Failed to write config file: ${err.message}`);
    process.exit(1);
  }
}

export function execPromise(command, options = {}) {
  return new Promise((resolve) => {
    exec(command, options, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

export function expandEnvVars(str) {
  return str.replace(/\$\{(\w+)\}/g, (_, varName) => process.env[varName] || '');
}

export async function runTask(task, logStream = null) {
  const cwd = task.cwd || process.cwd();
  const timeout = task.timeout || 0;
  let envPrefix = '';
  if (task.env) {
    if (typeof task.env === 'object') {
      envPrefix = Object.entries(task.env).map(([k, v]) => `${k}=${v}`).join(' ') + ' ';
    } else if (typeof task.env === 'string') {
      envPrefix = task.env + ' ';
    }
  }
  let action = expandEnvVars(task.action);
  const fullCmd = envPrefix + action;
  let attempt = 0;
  const maxRetries = task.retry || 0;
  const retryDelay = task.retryDelay || 0;
  let lastError = null;
  while (attempt <= maxRetries) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, retryDelay));
    }
    const { error, stdout, stderr } = await execPromise(fullCmd, { cwd, timeout: timeout > 0 ? timeout : undefined });
    if (logStream) {
      if (stdout) logStream.write(`[+] [${new Date().toISOString()}] [${task.name}] stdout: ${stdout}\n`);
      if (stderr) logStream.write(`[-] [${new Date().toISOString()}] [${task.name}] stderr: ${stderr}\n`);
    }
    if (!error) {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      return true;
    }
    lastError = error;
    if (logStream) logStream.write(`[-] [${new Date().toISOString()}] [${task.name}] error: ${error.message}\n`);
    attempt++;
  }
  console.error(`[-] Task "${task.name}" failed after ${maxRetries} retries: ${lastError.message}`);
  return false;
}

export function findTask(config, nameOrIndex) {
  if (nameOrIndex === undefined) return null;
  if (/^\d+$/.test(nameOrIndex)) {
    const idx = parseInt(nameOrIndex) - 1;
    if (idx >= 0 && idx < config.tasks.length) return config.tasks[idx];
    return null;
  }
  return config.tasks.find(t => t.name === nameOrIndex) || null;
}

const __filename = url.fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'init') {
    const defaultConfig = {
      tasks: [
        {
          name: 'example-task',
          description: 'An example task',
          enabled: true,
          path: '.',
          action: 'echo "Hello from ASCIYaml!"',
          priority: 0,
          delay: 0,
          timeout: 0,
          retry: 0,
          retryDelay: 0,
          interval: 0,
          watch: false,
          cwd: '',
          env: ''
        }
      ]
    };
    if (fs.existsSync(CONFIG_FILE)) {
      console.error(`[-] asciyml.yml already exists at ${CONFIG_FILE}`);
      process.exit(1);
    }
    saveConfig(defaultConfig);
    console.log('[+] Created asciyml.yml with an example task.');
  } else if (cmd === 'add') {
    const newTask = {};
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--name') newTask.name = args[++i];
      else if (args[i] === '--path') newTask.path = args[++i];
      else if (args[i] === '--action') newTask.action = args[++i];
      else if (args[i] === '--priority') newTask.priority = Number(args[++i]) || 0;
      else if (args[i] === '--delay') newTask.delay = Number(args[++i]) || 0;
      else if (args[i] === '--timeout') newTask.timeout = Number(args[++i]) || 0;
      else if (args[i] === '--retry') newTask.retry = Number(args[++i]) || 0;
      else if (args[i] === '--retry-delay') newTask.retryDelay = Number(args[++i]) || 0;
      else if (args[i] === '--interval') newTask.interval = Number(args[++i]) || 0;
      else if (args[i] === '--watch') newTask.watch = true;
      else if (args[i] === '--cwd') newTask.cwd = args[++i];
      else if (args[i] === '--env') {
        const val = args[++i];
        try { newTask.env = JSON.parse(val); } catch (_) { newTask.env = val; }
      }
      else if (args[i] === '--enabled') newTask.enabled = args[++i] === 'true';
      else if (args[i] === '--description') newTask.description = args[++i];
    }
    if (!newTask.action) {
      console.error('[-] Error: --action is required.');
      process.exit(1);
    }
    const config = loadConfig();
    config.tasks.push(newTask);
    saveConfig(config);
    console.log('[+] Task added successfully.');
  } else if (cmd === 'remove') {
    let target = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--name') target = args[++i];
      else if (args[i] === '--index') target = args[++i];
    }
    const config = loadConfig();
    const task = findTask(config, target);
    if (!task) {
      console.error('[-] Task not found.');
      process.exit(1);
    }
    config.tasks = config.tasks.filter(t => t !== task);
    saveConfig(config);
    console.log('[+] Task removed.');
  } else if (cmd === 'list') {
    const config = loadConfig();
    if (config.tasks.length === 0) {
      console.log('[-] No tasks defined.');
      process.exit(0);
    }
    config.tasks.forEach((t, idx) => {
      console.log(`[+] [${idx + 1}] ${t.name || 'unnamed'} (${t.enabled ? 'enabled' : 'disabled'})`);
      if (t.description) console.log(`    desc: ${t.description}`);
      console.log(`    action: ${t.action}`);
      console.log(`    priority: ${t.priority}, delay: ${t.delay}ms`);
      if (t.interval) console.log(`    interval: ${t.interval}s`);
      if (t.watch) console.log(`    watch: true, path: ${t.path}`);
    });
  } else if (cmd === 'enable' || cmd === 'disable') {
    let target = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--name') target = args[++i];
      else if (args[i] === '--index') target = args[++i];
    }
    const config = loadConfig();
    const task = findTask(config, target);
    if (!task) {
      console.error('[-] Task not found.');
      process.exit(1);
    }
    task.enabled = cmd === 'enable';
    saveConfig(config);
    console.log(`[+] Task "${task.name}" ${cmd === 'enable' ? 'enabled' : 'disabled'}.`);
  } else if (cmd === 'run') {
    const config = loadConfig();
    const flags = {};
    let logFile = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--name') flags.name = args[++i];
      else if (args[i] === '--index') flags.index = args[++i];
      else if (args[i] === '--dry-run') flags.dryRun = true;
      else if (args[i] === '--log') logFile = args[++i];
    }
    let tasksToRun = config.tasks.filter(t => t.enabled !== false);
    if (flags.name) {
      tasksToRun = tasksToRun.filter(t => t.name === flags.name);
    } else if (flags.index) {
      const idx = parseInt(flags.index) - 1;
      tasksToRun = idx >= 0 && idx < tasksToRun.length ? [tasksToRun[idx]] : [];
    }
    tasksToRun.sort((a, b) => b.priority - a.priority);
    if (flags.dryRun) {
      console.log('[+] Would run the following tasks:');
      tasksToRun.forEach((t, i) => console.log(`  ${i+1}. ${t.name || 'unnamed'} -> ${t.action}`));
      process.exit(0);
    }
    let logStream = null;
    if (logFile) {
      logStream = fs.createWriteStream(logFile, { flags: 'a' });
    }
    for (const task of tasksToRun) {
      await new Promise(resolve => {
        setTimeout(() => {
          runTask(task, logStream).then(() => resolve());
        }, task.delay || 0);
      });
    }
    if (logStream) logStream.end();
  } else if (cmd === 'watch') {
    const config = loadConfig();
    const watchTasks = config.tasks.filter(t => t.watch && t.enabled !== false);
    if (watchTasks.length === 0) {
      console.log('[-] No tasks with watch enabled.');
      process.exit(0);
    }
    const watchers = [];
    for (const task of watchTasks) {
      const watchPath = task.path || '.';
      if (!fs.existsSync(watchPath)) {
        console.error(`[-] Watch path does not exist: ${watchPath}`);
        continue;
      }
      const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        console.log(`[+] Change detected in ${watchPath} (${eventType} ${filename}), running task "${task.name}"`);
        runTask(task);
      });
      watchers.push(watcher);
      console.log(`[+] Watching: ${watchPath} for task "${task.name}"`);
    }
    process.on('SIGINT', () => {
      watchers.forEach(w => w.close());
      process.exit(0);
    });
    console.log('[+] Press Ctrl+C to stop watching.');
  } else if (cmd === 'daemon') {
    const config = loadConfig();
    const daemonTasks = config.tasks.filter(t => t.interval > 0 && t.enabled !== false);
    if (daemonTasks.length === 0) {
      console.log('[-] No tasks with interval > 0.');
      process.exit(0);
    }
    let logStream = null;
    const logIdx = args.indexOf('--log');
    if (logIdx !== -1 && args[logIdx+1]) {
      logStream = fs.createWriteStream(args[logIdx+1], { flags: 'a' });
    }
    const intervals = daemonTasks.map(task => {
      console.log(`[+] Starting daemon for "${task.name}" every ${task.interval}s`);
      return setInterval(() => {
        runTask(task, logStream);
      }, task.interval * 1000);
    });
    process.on('SIGINT', () => {
      intervals.forEach(clearInterval);
      if (logStream) logStream.end();
      process.exit(0);
    });
  } else if (cmd === 'validate') {
    const config = loadConfig();
    let valid = true;
    config.tasks.forEach((t, i) => {
      if (!t.action) {
        console.error(`[-] Task ${i+1} (${t.name || 'unnamed'}): missing action`);
        valid = false;
      }
    });
    if (valid) console.log('[+] Configuration is valid.');
  } else if (cmd === '--version' || cmd === '-v') {
    console.log('v2.0.0');
  } else {
    console.log(`ASCIYaml - Auto Starter Configed In Yaml
Usage:
  asciyml init
  asciyml add --name <name> --path <path> --action <action> [options]
  asciyml remove --name <name>|--index <idx>
  asciyml list
  asciyml enable --name <name>|--index <idx>
  asciyml disable --name <name>|--index <idx>
  asciyml run [--name <name>|--index <idx>] [--dry-run] [--log <file>]
  asciyml watch
  asciyml daemon [--log <file>]
  asciyml validate
  asciyml --version`);
  }
}
