/* CI5BUNTU LOGIC */

// MOCKED CONTENT
const FILES = {
    'HG.md': `# HARDWARE GUIDE\n\n**The Golden Stack**\n\n1. Raspberry Pi 5 (8GB)\n2. RTL8153 USB 3.0 NIC\n3. Netgear R7800 (AP)\n\nThis configuration is mathematically proven to support 1.74Gbps throughput with Suricata active.`,
    'SEC.md': `# SECURITY PROTOCOLS\n\n**VLAN Segmentation**\n\n- VLAN 10: Trusted (LAN)\n- VLAN 20: Guest\n- VLAN 30: IoT (Isolated)\n\n**IDS Rulesets**\n- ET Open\n- CrowdSec Community\n- Ci5 Custom Corks`,
    'MNT.md': `# MAINTENANCE\n\nRun 'sh bone_marrow.sh' for diagnostics.\nRun 'curl ci5.run/ward | sh' to update blocklists.\n\nAutomated updates occur at 03:00 UTC.`,
    'SUP.md': `# SUPPORT FAQ\n\nQ: My internet is slow.\nA: Run 'rrul' and check bufferbloat.\n\nQ: I forgot my password.\nA: You have physical access. Mount SD card and edit shadow file.`
};

const CHATS = {
    'general': [
        { u: 'net_runner', t: '13:42', m: 'Just hit 500Mbps on the RRUL test. The Pi 5 is a beast.' },
        { u: 'dreamswag', t: '13:45', m: 'Nice. @net_runner did you use the CAKE script or manual tuning?' },
        { u: 'net_runner', t: '13:46', m: 'Used the default ci5.run/fast script. Worked out of the box.' },
        { u: 'anon_192', t: '13:50', m: 'Anyone tried the Minecraft cork yet? Need to know if it lags with IDS on.' }
    ],
    'builds': [
        { u: 'pi_guy_5', t: '12:00', m: 'Posted my rack setup. 4 Pi 5s in a cluster.' },
        { u: 'dreamswag', t: '12:05', m: 'That 3D printed mount is clean. Upload the STL to the repo?' }
    ],
    'help': [
        { u: 'noob_101', t: '10:00', m: 'Error: "Interface eth1 not found". Help?' },
        { u: 'dreamswag', t: '10:15', m: 'Check your USB NIC. Is it Realtek based? Run lsusb.' }
    ]
};

// WINDOW MANAGER
let zIndex = 100;

function openWindow(appId) {
    const win = document.getElementById(`win-${appId}`);
    const dot = document.getElementById(`dot-${appId}`);
    
    if (win) {
        win.classList.remove('hidden');
        win.style.zIndex = ++zIndex;
        
        // Center randomly a bit for "organic" feel
        const rTop = 40 + Math.random() * 10;
        const rLeft = 40 + Math.random() * 10;
        win.style.top = rTop + '%';
        win.style.left = rLeft + '%';
        
        if (dot) dot.classList.remove('hidden');
        document.getElementById('activeApp').textContent = appId === 'files' ? 'File Manager' : 'Community';
    }
}

function closeWindow(appId) {
    document.getElementById(`win-${appId}`).classList.add('hidden');
    const dot = document.getElementById(`dot-${appId}`);
    if (dot) dot.classList.add('hidden');
    document.getElementById('activeApp').textContent = 'Desktop';
}

// DRAGGABLE LOGIC (Cannibalized from ci5 old)
function makeDraggable(elId, handleId) {
    const el = document.getElementById(elId);
    const handle = document.getElementById(handleId);
    let isDragging = false, startX, startY, initLeft, initTop;

    handle.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('win-btn')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initLeft = el.offsetLeft;
        initTop = el.offsetTop;
        el.style.zIndex = ++zIndex;
        document.getElementById('activeApp').textContent = elId.replace('win-', '').toUpperCase();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = `${initLeft + dx}px`;
        el.style.top = `${initTop + dy}px`;
    });

    document.addEventListener('mouseup', () => isDragging = false);
}

// APP SPECIFIC LOGIC
function switchChannel(ch) {
    // UI Update
    document.querySelectorAll('.channel').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('chat-title').textContent = ch;
    
    // Load Content
    const feed = document.getElementById('chat-feed');
    feed.innerHTML = '';
    
    if (CHATS[ch]) {
        CHATS[ch].forEach(msg => {
            const div = document.createElement('div');
            div.className = 'msg';
            div.innerHTML = `
                <div class="avatar"></div>
                <div class="msg-content">
                    <div>
                        <span class="msg-user ${msg.u === 'dreamswag' ? 'owner' : ''}">${msg.u}</span>
                        <span class="msg-time">Today at ${msg.t}</span>
                    </div>
                    <div>${msg.m}</div>
                </div>
            `;
            feed.appendChild(div);
        });
    }
}

function openFile(filename) {
    openWindow('viewer');
    const content = FILES[filename] || "Error: File corrupted or encrypted.";
    document.getElementById('file-content').innerHTML = parseMarkdown(content);
    document.getElementById('viewer-title').textContent = `nano ${filename}`;
}

// BASIC MD PARSER FOR TERMINAL READER
function parseMarkdown(text) {
    return text
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\*\* (.*$)/gim, '<h2>$1</h2>')
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/\n/gim, '<br>');
}

// INIT
document.addEventListener('DOMContentLoaded', () => {
    makeDraggable('win-community', 'drag-comm');
    makeDraggable('win-files', 'drag-files');
    makeDraggable('win-viewer', 'drag-viewer');
    
    // Default State
    switchChannel('general');
});