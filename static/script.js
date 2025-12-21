/* Ci5 vBulletin Logic Engine */

// --- CONTENT DATABASE ---
const DOCS = {
    'hardware': {
        title: "Sticky: Official Hardware Guide (The Golden Stack)",
        author: "dreamswag",
        date: "Yesterday, 14:02",
        content: `# The Golden Stack Architecture\n\nTo achieve the **1.74Gbps** throughput claim with 0ms bufferbloat, specific hardware is required.\n\n### 1. Compute: Raspberry Pi 5 (8GB)\nThe Cortex-A76 cores are mandatory for handling Suricata at line rate. The Pi 4 cannot keep up with the instruction set requirements for the new IDS engine.\n\n### 2. Interface: RTL8153 USB 3.0\nWhile many USB NICs exist, the RTL8153 (or AX88179) has been verified for driver stability in the Ci5 kernel tweaks.\n\n> **Note:** Do not use cheap "driverless" dongles. They will cause packet drops under load.`
    },
    'security': {
        title: "Sticky: Security Protocols & VLANs",
        author: "dreamswag",
        date: "Today, 09:00",
        content: `# Network Hardening\n\nDefault firewall zones are strict. \n\n* **LAN:** Trusted. Access to gateway.\n* **IoT:** Isolated. No WAN access unless whitelisted via Cork.\n* **GUEST:** Client isolation active.\n\n### SSH Keys\nPassword auth is disabled by default in the 'safe' installer. You must use the key provided during the 'bootstrap' phase.`
    },
    'maintenance': {
        title: "Sticky: Self-Healing & Maintenance",
        author: "dreamswag",
        date: "Today, 08:30",
        content: `Run \`sh bone_marrow.sh\` to generate a diagnostic report. The system auto-updates blocklists at 03:00 UTC.`
    }
};

const CHATS = [
    { id: 1, title: "Just hit 500Mbps on RRUL test!", user: "net_runner", replies: 14, views: 302, last: "Today 13:42" },
    { id: 2, title: "[Showcase] My Pi 5 Cluster Rack", user: "pi_guy", replies: 8, views: 155, last: "Today 12:00" },
    { id: 3, title: "Help: AdGuard container restarting?", user: "newbie_101", replies: 2, views: 40, last: "Today 10:15" },
    { id: 4, title: "Request: UniFi Controller Cork", user: "ubnt_fan", replies: 0, views: 12, last: "Yesterday 23:00" }
];

// --- RENDERERS ---

function loadIndex() {
    document.getElementById('nav-trail').innerText = "Ci5 Network > Forums > Index";
    const main = document.getElementById('main-content');
    
    main.innerHTML = `
        <div class="forum-table">
            <div class="cat-header">Sovereign Documentation (Read Only)</div>
            <table width="100%" cellpadding="0" cellspacing="1">
                <tr class="thead-row">
                    <th width="5%">&nbsp;</th>
                    <th width="50%">Forum</th>
                    <th width="10%">Threads</th>
                    <th width="10%">Posts</th>
                    <th width="25%">Last Post</th>
                </tr>
                <tr class="forum-row row-a">
                    <td align="center"><div class="f-icon new">🔒</div></td>
                    <td>
                        <div class="forum-title"><a href="#" onclick="viewThread('hardware')">Hardware Guide</a></div>
                        <div class="forum-desc">Reference architecture specifications and BOM.</div>
                    </td>
                    <td align="center">1</td>
                    <td align="center">1</td>
                    <td class="last-post">By dreamswag<br>Yesterday 14:02</td>
                </tr>
                <tr class="forum-row row-b">
                    <td align="center"><div class="f-icon new">🔒</div></td>
                    <td>
                        <div class="forum-title"><a href="#" onclick="viewThread('security')">Security Protocols</a></div>
                        <div class="forum-desc">VLANs, IDS tuning, and Firewall Zones.</div>
                    </td>
                    <td align="center">1</td>
                    <td align="center">1</td>
                    <td class="last-post">By dreamswag<br>Today 09:00</td>
                </tr>
            </table>
        </div>

        <div class="forum-table">
            <div class="cat-header">The Arena (Benchmarks)</div>
            <table width="100%" cellpadding="0" cellspacing="1">
                <tr class="thead-row">
                    <th width="5%">&nbsp;</th>
                    <th width="50%">Forum</th>
                    <th width="10%">Threads</th>
                    <th width="10%">Posts</th>
                    <th width="25%">Last Post</th>
                </tr>
                <tr class="forum-row row-a">
                    <td align="center"><div class="f-icon new">🏆</div></td>
                    <td>
                        <div class="forum-title"><a href="#" onclick="viewLeaderboard()">St. Guinea CiG Leaderboard</a></div>
                        <div class="forum-desc">Official 1.74Gbps Gauntlet submissions and verifications.</div>
                    </td>
                    <td align="center">142</td>
                    <td align="center">8,204</td>
                    <td class="last-post">By net_runner<br>Today 13:42</td>
                </tr>
            </table>
        </div>

        <div class="forum-table">
            <div class="cat-header">Community Signals (GitHub Relay)</div>
            <table width="100%" cellpadding="0" cellspacing="1">
                <tr class="thead-row">
                    <th width="5%">&nbsp;</th>
                    <th width="50%">Forum</th>
                    <th width="10%">Threads</th>
                    <th width="10%">Posts</th>
                    <th width="25%">Last Post</th>
                </tr>
                <tr class="forum-row row-a">
                    <td align="center"><div class="f-icon">💬</div></td>
                    <td>
                        <div class="forum-title"><a href="#" onclick="viewCommunity()">General Discussion</a></div>
                        <div class="forum-desc">Talk about setups, troubleshooting, and cork requests.</div>
                    </td>
                    <td align="center">1,203</td>
                    <td align="center">14,201</td>
                    <td class="last-post">By newbie_101<br>Today 10:15</td>
                </tr>
            </table>
        </div>
    `;
}

function viewThread(id) {
    const doc = DOCS[id];
    document.getElementById('nav-trail').innerText = `Ci5 Network > Forums > Docs > ${doc.title}`;
    const main = document.getElementById('main-content');
    
    main.innerHTML = `
        <div class="thread-header">${doc.title}</div>
        <div class="vb-btn" style="margin-bottom:10px;" onclick="loadIndex()">&lt; Back to Index</div>
        
        <table class="post-container">
            <tr>
                <td class="post-date">${doc.date}</td>
            </tr>
            <tr>
                <td class="post-meta">
                    <div style="font-size:14px; font-weight:bold; color:var(--highlight);">${doc.author}</div>
                    <div class="tiny">Architect</div>
                    <div style="margin-top:5px;"><img src="https://github.com/identicons/dreamswag.png" width="50"></div>
                    <div class="tiny" style="margin-top:5px;">
                        Join Date: Dec 2024<br>
                        Posts: 4,096
                    </div>
                </td>
                <td class="post-content">
                    ${parseMarkdown(doc.content)}
                </td>
            </tr>
        </table>
    `;
}

function viewLeaderboard() {
    document.getElementById('nav-trail').innerText = `Ci5 Network > Forums > Arena > Leaderboard`;
    const main = document.getElementById('main-content');
    
    main.innerHTML = `
        <div class="thread-header">Sticky: OFFICIAL LEADERBOARD</div>
        <div class="vb-btn" style="margin-bottom:10px;" onclick="loadIndex()">&lt; Back to Index</div>
        
        <table class="post-container">
            <tr>
                <td class="post-meta">
                    <div style="font-size:14px; font-weight:bold; color:red;">System_Bot</div>
                    <div class="tiny">Automated Referee</div>
                </td>
                <td class="post-content">
                    <h1>The 1.74Gbps Gauntlet</h1>
                    <p>Current verifiable throughput records.</p>
                    <table class="lb-table">
                        <tr>
                            <th>Rank</th><th>Pilot</th><th>Throughput</th><th>Latency</th>
                        </tr>
                        <tr style="color:#ffd700">
                            <td>0</td><td>[UNCLAIMED BOUNTY]</td><td>---</td><td>---</td>
                        </tr>
                        <tr>
                            <td>1</td><td>dreamswag</td><td>500 Mbps</td><td>+0ms</td>
                        </tr>
                        <tr>
                            <td>2</td><td>net_runner</td><td>480 Mbps</td><td>+1ms</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    `;
}

function viewCommunity() {
    document.getElementById('nav-trail').innerText = `Ci5 Network > Forums > Community > General`;
    const main = document.getElementById('main-content');
    
    let html = `
        <div class="cat-header">General Discussion</div>
        <div class="vb-btn" style="margin-bottom:10px;" onclick="loadIndex()">&lt; Back to Index</div>
        <table width="100%" cellpadding="0" cellspacing="1" class="forum-table">
            <tr class="thead-row">
                <th width="5%">&nbsp;</th>
                <th width="55%">Thread / Thread Starter</th>
                <th width="15%">Last Post</th>
                <th width="10%">Replies</th>
                <th width="10%">Views</th>
            </tr>
    `;
    
    CHATS.forEach(chat => {
        html += `
            <tr class="forum-row row-a">
                <td align="center">✉️</td>
                <td>
                    <div style="font-weight:bold; font-size:12px;"><a href="#" onclick="alert('Login to view thread')">${chat.title}</a></div>
                    <div class="tiny">${chat.user}</div>
                </td>
                <td class="tiny">${chat.last}</td>
                <td align="center">${chat.replies}</td>
                <td align="center">${chat.views}</td>
            </tr>
        `;
    });
    
    html += `</table>`;
    main.innerHTML = html;
}

// --- UTIL ---
function parseMarkdown(text) {
    return text
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\n/gim, '<br>');
}

// --- AUTH ---
function openAuth() { document.getElementById('auth-modal').classList.remove('hidden'); }
function closeAuth() { document.getElementById('auth-modal').classList.add('hidden'); }
function mockLogin() {
    closeAuth();
    document.querySelector('.welcome-text').innerHTML = `<strong>Welcome back, dreamswag_fan.</strong><br>You last visited: Today at 14:02.`;
    document.querySelector('.login-inputs').innerHTML = `<button class="vb-btn" onclick="location.reload()">Log Out</button>`;
}

// INIT
document.addEventListener('DOMContentLoaded', loadIndex);