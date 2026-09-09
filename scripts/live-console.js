const http = require('http');
const os = require('os');
const fs = require('fs');

const PORT = 8088;
const logsHistory = [];
const MAX_HISTORY = 1000;

// ANSI Colors for Windows PowerShell / CMD
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function formatLevel(level) {
  switch ((level || '').toUpperCase()) {
    case 'ERROR':
      return `${COLORS.bgRed}${COLORS.white} ERROR ${COLORS.reset}`;
    case 'WARN':
      return `${COLORS.yellow} WARN  ${COLORS.reset}`;
    case 'AUDIO':
      return `${COLORS.magenta}🎵 AUDIO${COLORS.reset}`;
    case 'DOWNLOAD':
      return `${COLORS.blue}⬇️ DOWN ${COLORS.reset}`;
    case 'SEARCH':
      return `${COLORS.cyan}🔍 SRCH ${COLORS.reset}`;
    default:
      return `${COLORS.green} INFO  ${COLORS.reset}`;
  }
}

function printLogToTerminal(entry) {
  const time = entry.timestamp
    ? new Date(entry.timestamp).toLocaleTimeString()
    : new Date().toLocaleTimeString();
  const levelBadge = formatLevel(entry.level);
  const tag = entry.tag ? `${COLORS.bright}[${entry.tag}]${COLORS.reset}` : '';
  const msg = entry.message || '';
  
  let out = `${COLORS.gray}${time}${COLORS.reset} ${levelBadge} ${tag} ${msg}`;
  if (entry.data !== undefined && entry.data !== null) {
    try {
      const dataStr = typeof entry.data === 'object' ? JSON.stringify(entry.data, null, 2) : String(entry.data);
      out += `\n${COLORS.dim}${dataStr}${COLORS.reset}`;
    } catch {
      out += ` ${entry.data}`;
    }
  }
  console.log(out);
}

// Simple HTML Web Dashboard
const HTML_DASHBOARD = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sonance iOS — Windows Live Console</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0B0E14; color: #E0E6ED; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; height: 100vh; display: flex; flex-direction: column; }
    header { background: #131A24; padding: 14px 20px; border-bottom: 1px solid #202B3B; display: flex; align-items: center; justify-content: space-between; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 17px; color: #00F2FE; }
    .status-badge { background: #10B98122; color: #10B981; border: 1px solid #10B98144; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 8px; height: 8px; background: #10B981; border-radius: 50%; box-shadow: 0 0 8px #10B981; }
    .controls { display: flex; gap: 10px; align-items: center; }
    input, select, button { background: #1A2332; color: #FFF; border: 1px solid #2B3A4F; padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; }
    input:focus { border-color: #00F2FE; }
    button { cursor: pointer; font-weight: 600; transition: background 0.15s; }
    button:hover { background: #26354A; }
    .btn-clear { background: #EF444422; color: #EF4444; border-color: #EF444444; }
    .btn-clear:hover { background: #EF444433; }
    #logs-container { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.5; }
    .log-row { display: flex; gap: 10px; padding: 8px 12px; background: #131A24; border-radius: 6px; border-left: 4px solid #10B981; word-break: break-word; }
    .log-row.ERROR { border-left-color: #EF4444; background: #241416; }
    .log-row.WARN { border-left-color: #F59E0B; background: #241D14; }
    .log-row.AUDIO { border-left-color: #EC4899; }
    .log-row.DOWNLOAD { border-left-color: #3B82F6; }
    .log-time { color: #64748B; font-size: 11px; white-space: nowrap; margin-top: 2px; }
    .log-badge { font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 4px; height: fit-content; text-transform: uppercase; }
    .log-badge.INFO { background: #10B98122; color: #10B981; }
    .log-badge.ERROR { background: #EF444422; color: #EF4444; }
    .log-badge.WARN { background: #F59E0B22; color: #F59E0B; }
    .log-badge.AUDIO { background: #EC489922; color: #EC4899; }
    .log-badge.DOWNLOAD { background: #3B82F622; color: #3B82F6; }
    .log-tag { font-weight: 700; color: #00F2FE; }
    .log-data { background: #0B0E14; padding: 6px 10px; border-radius: 4px; margin-top: 4px; font-size: 12px; color: #94A3B8; white-space: pre-wrap; }
    .empty-state { text-align: center; color: #475569; padding: 60px 0; font-size: 15px; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>⚡</span> Sonance iOS — Live Windows Console
    </div>
    <div class="status-badge">
      <div class="status-dot"></div>
      <span>Listening on Port ${PORT}</span>
    </div>
    <div class="controls">
      <input type="text" id="filter-input" placeholder="Filter logs..." oninput="renderLogs()" />
      <select id="level-select" onchange="renderLogs()">
        <option value="ALL">All Levels</option>
        <option value="ERROR">Errors Only</option>
        <option value="WARN">Warnings</option>
        <option value="AUDIO">Audio</option>
        <option value="DOWNLOAD">Downloads</option>
        <option value="INFO">Info</option>
      </select>
      <button onclick="downloadLogs()">💾 Export</button>
      <button class="btn-clear" onclick="clearLogs()">🗑️ Clear</button>
    </div>
  </header>
  <div id="logs-container">
    <div class="empty-state">Waiting for logs from your iPhone...</div>
  </div>

  <script>
    let logs = [];
    let autoScroll = true;

    const container = document.getElementById('logs-container');
    container.addEventListener('scroll', () => {
      autoScroll = (container.scrollHeight - container.scrollTop - container.clientHeight) < 40;
    });

    async function pollLogs() {
      try {
        const res = await fetch('/api/logs?since=' + (logs.length ? logs[logs.length - 1].id : 0));
        if (res.ok) {
          const newEntries = await res.json();
          if (newEntries.length > 0) {
            logs.push(...newEntries);
            renderLogs();
          }
        }
      } catch (err) {}
      setTimeout(pollLogs, 800);
    }

    function renderLogs() {
      const filterText = document.getElementById('filter-input').value.toLowerCase();
      const levelFilter = document.getElementById('level-select').value;

      const filtered = logs.filter(item => {
        if (levelFilter !== 'ALL' && (item.level || '').toUpperCase() !== levelFilter) return false;
        if (filterText) {
          const combined = (item.tag || '') + ' ' + (item.message || '') + ' ' + JSON.stringify(item.data || '');
          if (!combined.toLowerCase().includes(filterText)) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No matching logs</div>';
        return;
      }

      container.innerHTML = filtered.map(item => {
        const time = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '';
        const level = (item.level || 'INFO').toUpperCase();
        let dataHtml = '';
        if (item.data !== undefined && item.data !== null) {
          const str = typeof item.data === 'object' ? JSON.stringify(item.data, null, 2) : String(item.data);
          dataHtml = '<div class="log-data">' + escapeHtml(str) + '</div>';
        }
        return '<div class="log-row ' + level + '">' +
          '<span class="log-time">' + time + '</span>' +
          '<span class="log-badge ' + level + '">' + level + '</span>' +
          '<div>' +
            (item.tag ? '<span class="log-tag">[' + escapeHtml(item.tag) + ']</span> ' : '') +
            '<span>' + escapeHtml(item.message || '') + '</span>' +
            dataHtml +
          '</div>' +
        '</div>';
      }).join('');

      if (autoScroll) {
        container.scrollTop = container.scrollHeight;
      }
    }

    function escapeHtml(text) {
      return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function clearLogs() {
      logs = [];
      renderLogs();
    }

    function downloadLogs() {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sonance-logs-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
      a.click();
    }

    pollLogs();
  </script>
</body>
</html>
`;

let logIdCounter = 1;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/ping' || req.url === '/api/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: Date.now(), server: 'Sonance Windows Console' }));
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_DASHBOARD);
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/logs')) {
    const urlParams = new URL(req.url, `http://localhost:${PORT}`);
    const since = parseInt(urlParams.searchParams.get('since') || '0', 10);
    const results = logsHistory.filter(l => l.id > since);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
    return;
  }

  if (req.method === 'POST' && (req.url === '/logs' || req.url === '/api/logs')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const entries = Array.isArray(payload) ? payload : (payload.logs || [payload]);

        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue;
          const logItem = {
            id: logIdCounter++,
            level: entry.level || 'INFO',
            tag: entry.tag || 'APP',
            message: entry.message || '',
            data: entry.data !== undefined ? entry.data : null,
            timestamp: entry.timestamp || Date.now(),
          };

          logsHistory.push(logItem);
          if (logsHistory.length > MAX_HISTORY) {
            logsHistory.shift();
          }

          printLogToTerminal(logItem);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: entries.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log('\n' + '='.repeat(64));
  console.log(`${COLORS.bright}${COLORS.cyan}⚡ SONANCE iOS — LIVE WINDOWS CONSOLE${COLORS.reset}`);
  console.log('='.repeat(64));
  console.log(`${COLORS.green}✓ Server listening on Port ${PORT}${COLORS.reset}\n`);
  console.log(`${COLORS.bright}📱 To connect your iPhone:${COLORS.reset}`);
  console.log(`1. Ensure iPhone and PC are on the same Wi-Fi.`);
  console.log(`2. In the Sonance app, go to: ${COLORS.yellow}Settings → Diagnostics & Remote Console${COLORS.reset}`);
  console.log(`3. Enter your PC IP address:`);
  ips.forEach(ip => {
    console.log(`   👉 ${COLORS.bright}${COLORS.cyan}http://${ip}:${PORT}${COLORS.reset} (or simply ${COLORS.cyan}${ip}${COLORS.reset})`);
  });
  console.log(`\n${COLORS.bright}🖥️ Web Dashboard:${COLORS.reset} ${COLORS.blue}http://localhost:${PORT}${COLORS.reset}`);
  console.log('='.repeat(64));
  console.log(`${COLORS.gray}Live stream of logs will appear below in real-time...${COLORS.reset}\n`);
});
