/**
 * CI5.NETWORK — Forums Frontend
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Features:
 * - Browse forums (public, no auth required)
 * - Post replies (requires hardware verification)
 * - Submit RRUL results (requires hardware verification)
 * - GitHub OAuth Device Flow
 * - Hardware challenge-response verification
 * - GitHub Discussions API integration
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CI5_API = 'https://api.ci5.network';

const CONFIG = {
    clientId: 'Ov23liSwq6nuhqFog2xr', 
    
    // GitHub repos for discussions
    repos: [
        { owner: 'dreamswag', repo: 'ci5.network', label: 'ci5.network' },
        { owner: 'dreamswag', repo: 'ci5', label: 'ci5' },
        { owner: 'dreamswag', repo: 'ci5.host', label: 'ci5.host' },
        { owner: 'dreamswag', repo: 'ci5.dev', label: 'ci5.dev' }
    ],
    
    // Category mappings
    categories: {
        'metrics': { repo: 'ci5.network', ghCategory: 'METRICS', title: 'RRUL Submissions' },
        'announcements': { repo: 'ci5.network', ghCategory: 'Announcements', title: 'Announcements' },
        'intel_req': { repo: 'ci5.network', ghCategory: 'INTEL_REQ', title: 'INTEL_REQ' },
        'armory': { repo: 'ci5.network', ghCategory: 'ARMORY', title: 'ARMORY' },
        'cork-submissions': { repo: 'ci5.dev', ghCategory: 'General', title: 'Cork Submissions' }
    },
    
    // API endpoints
    api: {
        leaderboard: '/api/leaderboard',
        blacklist: '/api/blacklist',
        submit: '/api/submit'
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

const state = {
    user: null,
    accessToken: localStorage.getItem('gh_token'),
    currentView: 'index',
    currentCategory: null,
    currentThread: null,
    currentRepo: 'all',
    deviceFlowInterval: null,
    
    // Hardware verification
    sessionId: localStorage.getItem('ci5_session') || crypto.randomUUID(),
    hwVerified: false,
    hwid: null,
    pendingAction: null
};

// Persist session ID
localStorage.setItem('ci5_session', state.sessionId);

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    injectModalHTML();
    initNavigation();
    initRepoTabs();
    checkAuth();
    checkHardwareVerification();
    loadForumData();
});

// ═══════════════════════════════════════════════════════════════════════════
// HARDWARE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

async function checkHardwareVerification() {
    try {
        const res = await fetch(`${CI5_API}/v1/identity/check?session=${state.sessionId}`);
        const data = await res.json();
        
        if (data.verified) {
            state.hwVerified = true;
            state.hwid = data.hwid;
            updateVerificationUI();
        }
    } catch (e) {
        console.warn('Hardware verification check failed:', e);
    }
}

async function requestHardwareVerification() {
    const challenge = 'ci5_' + Math.random().toString(36).substring(2, 8);
    
    try {
        const res = await fetch(`${CI5_API}/v1/challenge/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challenge,
                session_id: state.sessionId,
                expires: Date.now() + 300000
            })
        });
        
        if (!res.ok) throw new Error('Failed to create challenge');
        
        showVerificationModal(challenge);
        pollForVerification();
    } catch (e) {
        console.error('Verification init failed:', e);
        alert('Verification service unavailable. Try again later.');
    }
}

function showVerificationModal(challenge) {
    const modal = document.getElementById('hw-verify-modal');
    const cmdSpan = document.getElementById('verify-command');
    
    if (modal && cmdSpan) {
        cmdSpan.textContent = `ci5 verify ${challenge}`;
        modal.classList.remove('hidden');
    }
}

function pollForVerification() {
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${CI5_API}/v1/identity/check?session=${state.sessionId}`);
            const data = await res.json();
            
            if (data.verified) {
                clearInterval(interval);
                state.hwVerified = true;
                state.hwid = data.hwid;
                
                const modal = document.getElementById('hw-verify-modal');
                if (modal) modal.classList.add('hidden');
                
                updateVerificationUI();
                
                if (state.pendingAction) {
                    state.pendingAction();
                    state.pendingAction = null;
                }
            }
        } catch (e) {
            console.warn('Poll error:', e);
        }
    }, 2000);
    
    setTimeout(() => clearInterval(interval), 300000);
}

function updateVerificationUI() {
    const userNameEl = document.getElementById('user-name');
    if (userNameEl && state.hwVerified && !userNameEl.innerHTML.includes('[VERIFIED]')) {
        userNameEl.innerHTML += ` <span style="font-size:0.8em; color:#30d158;">[🔒 VERIFIED]</span>`;
    }
    
    // Enable reply box if on thread view
    const replyBox = document.getElementById('reply-box');
    if (replyBox && state.hwVerified) {
        replyBox.classList.remove('hw-locked');
    }
}

function requireHardware(action) {
    if (!state.user) {
        startDeviceAuth();
        return;
    }
    
    if (state.hwVerified) {
        action();
        return;
    }
    
    state.pendingAction = action;
    requestHardwareVerification();
}

function injectModalHTML() {
    if (document.getElementById('hw-verify-modal')) return;
    
    const div = document.createElement('div');
    div.id = 'hw-verify-modal';
    div.className = 'overlay hidden';
    div.innerHTML = `
        <div class="vb-modal" style="text-align:center;">
            <div class="cat-header">🔒 Hardware Verification Required</div>
            <div class="modal-body">
                <p>To post or vote, you must verify your Ci5 hardware.</p>
                <p style="color:#888; font-size:0.9em;">Run this command on your Pi:</p>
                <div style="background:#000; padding:15px; margin:20px 0; border-radius:8px; font-family:monospace; color:#30d158; font-size:1.1em; cursor:pointer;" onclick="copyVerifyCommand()">
                    <span id="verify-command">Loading...</span>
                </div>
                <p style="color:#666; font-size:0.8em;">Click to copy • Waiting for verification...</p>
            </div>
            <div class="modal-btns">
                <button class="vb-btn" onclick="closeVerifyModal()">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

function copyVerifyCommand() {
    const cmd = document.getElementById('verify-command');
    if (cmd) {
        navigator.clipboard.writeText(cmd.textContent);
        cmd.style.color = '#fff';
        setTimeout(() => cmd.style.color = '#30d158', 1000);
    }
}

function closeVerifyModal() {
    const modal = document.getElementById('hw-verify-modal');
    if (modal) modal.classList.add('hidden');
    state.pendingAction = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION & VIEW MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            if (view) switchView(view);
        });
    });
    
    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileDrawer = document.getElementById('mobileNavDrawer');
    
    if (mobileMenuBtn && mobileDrawer) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileDrawer.classList.toggle('hidden');
            mobileMenuBtn.classList.toggle('active');
        });
        
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                mobileDrawer.classList.add('hidden');
                mobileMenuBtn.classList.remove('active');
                const view = link.dataset.view;
                if (view) switchView(view);
            });
        });
    }
}

function initRepoTabs() {
    document.querySelectorAll('.repo-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const repo = tab.dataset.repo;
            filterByRepo(repo);
            document.querySelectorAll('.repo-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
}

function switchView(view) {
    document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
    
    const panel = document.getElementById(`view-${view}`);
    if (panel) panel.classList.remove('hidden');
    
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.view === view);
    });
    
    state.currentView = view;
    
    if (view === 'leaderboard') loadLeaderboard();
    if (view === 'blacklist') loadBlacklist();
    if (view === 'submit') initSubmitView();
}

function filterByRepo(repo) {
    state.currentRepo = repo;
    document.querySelectorAll('.forum-table[data-repos]').forEach(table => {
        const repos = table.dataset.repos.split(',');
        if (repo === 'all' || repos.includes(repo)) {
            table.classList.remove('hidden-by-filter');
        } else {
            table.classList.add('hidden-by-filter');
        }
    });
}

function toggleCategory(btn) {
    const body = btn.closest('.cat-header').nextElementSibling;
    if (body.classList.contains('collapsed')) {
        body.classList.remove('collapsed');
        btn.textContent = '[−]';
    } else {
        body.classList.add('collapsed');
        btn.textContent = '[+]';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB OAUTH (Device Flow)
// ═══════════════════════════════════════════════════════════════════════════

function checkAuth() {
    if (state.accessToken) {
        fetchUserInfo();
    }
    updateAuthUI();
}

async function fetchUserInfo() {
    try {
        const res = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${state.accessToken}` }
        });
        
        if (res.ok) {
            state.user = await res.json();
            updateAuthUI();
        } else {
            logout();
        }
    } catch (e) {
        console.error('Auth check failed:', e);
    }
}

function updateAuthUI() {
    const guest = document.getElementById('welcome-guest');
    const user = document.getElementById('welcome-user');
    const replyBox = document.getElementById('reply-box');
    
    if (state.user) {
        if (guest) guest.classList.add('hidden');
        if (user) user.classList.remove('hidden');
        
        const avatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        
        if (avatar) avatar.src = state.user.avatar_url;
        if (userName) userName.textContent = state.user.login;
        if (replyBox) replyBox.classList.remove('hidden');
        
        updateVerificationUI();
    } else {
        if (guest) guest.classList.remove('hidden');
        if (user) user.classList.add('hidden');
        if (replyBox) replyBox.classList.add('hidden');
    }
}

async function startDeviceAuth() {
    const modal = document.getElementById('device-modal');
    const loading = document.getElementById('device-loading');
    const codeSection = document.getElementById('device-code-section');
    
    if (modal) modal.classList.remove('hidden');
    if (loading) loading.classList.remove('hidden');
    if (codeSection) codeSection.classList.add('hidden');
    
    try {
        // Use CORS proxy for static site
        const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://github.com/login/device/code'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ client_id: CONFIG.clientId, scope: 'public_repo' })
        });
        
        const data = await res.json();
        
        if (data.device_code) {
            if (loading) loading.classList.add('hidden');
            if (codeSection) codeSection.classList.remove('hidden');
            
            const codeDisplay = document.getElementById('user-code');
            if (codeDisplay) codeDisplay.textContent = data.user_code;
            
            pollForToken(data.device_code, data.interval || 5);
        } else {
            throw new Error('No device code');
        }
    } catch (e) {
        console.error('Device auth failed:', e);
        alert('Authentication failed. Please try again.');
        closeDeviceModal();
    }
}

function pollForToken(deviceCode, interval) {
    if (state.deviceFlowInterval) clearInterval(state.deviceFlowInterval);
    
    state.deviceFlowInterval = setInterval(async () => {
        try {
            const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://github.com/login/oauth/access_token'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    client_id: CONFIG.clientId,
                    device_code: deviceCode,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                })
            });
            
            const data = await res.json();
            
            if (data.access_token) {
                clearInterval(state.deviceFlowInterval);
                state.accessToken = data.access_token;
                localStorage.setItem('gh_token', data.access_token);
                closeDeviceModal();
                fetchUserInfo();
            } else if (data.error === 'slow_down') {
                clearInterval(state.deviceFlowInterval);
                pollForToken(deviceCode, interval + 5);
            }
        } catch (e) {
            console.error('Token poll error:', e);
        }
    }, (interval + 1) * 1000);
}

function closeDeviceModal() {
    const modal = document.getElementById('device-modal');
    if (modal) modal.classList.add('hidden');
    if (state.deviceFlowInterval) {
        clearInterval(state.deviceFlowInterval);
        state.deviceFlowInterval = null;
    }
}

function logout() {
    state.user = null;
    state.accessToken = null;
    state.hwVerified = false;
    state.hwid = null;
    
    localStorage.removeItem('gh_token');
    localStorage.removeItem('ci5_session');
    
    state.sessionId = crypto.randomUUID();
    localStorage.setItem('ci5_session', state.sessionId);
    
    updateAuthUI();
}

// ═══════════════════════════════════════════════════════════════════════════
// FORUM DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════

async function loadForumData() {
    loadActivityFeed();
    loadCategoryStats();
}

async function loadActivityFeed() {
    const list = document.getElementById('activity-list');
    if (!list) return;
    
    try {
        const activities = [];
        
        for (const repo of CONFIG.repos) {
            try {
                const discussions = await fetchRecentDiscussions(repo.owner, repo.repo, 3);
                activities.push(...discussions.map(d => ({ ...d, repoLabel: repo.label })));
            } catch (e) {
                console.warn(`Failed to load ${repo.label}:`, e);
            }
        }
        
        activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        if (activities.length === 0) {
            list.innerHTML = '<div class="loading-row">No recent activity</div>';
        } else {
            list.innerHTML = activities.slice(0, 10).map(a => `
                <div class="activity-item">
                    <span class="activity-icon">💬</span>
                    <div class="activity-content">
                        <a href="#" class="activity-title" onclick="viewThread('${a.id}'); return false;">${esc(a.title)}</a>
                        <div class="activity-meta">
                            by ${esc(a.author?.login || 'unknown')} in ${a.repoLabel} · ${timeAgo(a.createdAt)}
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error('Activity load failed:', e);
        list.innerHTML = '<div class="loading-row">Failed to load activity</div>';
    }
}

async function fetchRecentDiscussions(owner, repo, limit = 10) {
    const query = `query {
        repository(owner: "${owner}", name: "${repo}") {
            discussions(first: ${limit}, orderBy: {field: CREATED_AT, direction: DESC}) {
                nodes { id title createdAt author { login avatarUrl } category { name } comments { totalCount } }
            }
        }
    }`;
    
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(state.accessToken ? { 'Authorization': `Bearer ${state.accessToken}` } : {})
        },
        body: JSON.stringify({ query })
    });
    
    const data = await res.json();
    return data.data?.repository?.discussions?.nodes || [];
}

async function loadCategoryStats() {
    for (const [id, cfg] of Object.entries(CONFIG.categories)) {
        try {
            const repo = CONFIG.repos.find(r => r.label === cfg.repo);
            if (!repo) continue;
            
            const threads = document.getElementById(`${id}-threads`);
            const posts = document.getElementById(`${id}-posts`);
            
            // Set placeholder values
            if (threads) threads.textContent = '—';
            if (posts) posts.textContent = '—';
        } catch (e) {
            console.warn(`Stats failed for ${id}:`, e);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// THREAD VIEWING & POSTING
// ═══════════════════════════════════════════════════════════════════════════

async function viewCategory(categoryId) {
    const cfg = CONFIG.categories[categoryId];
    if (!cfg) return;
    
    state.currentCategory = { id: categoryId, ...cfg };
    switchView('category');
}

async function viewThread(discussionId) {
    state.currentThread = discussionId;
    switchView('thread');
    
    const postList = document.getElementById('post-list');
    if (!postList) return;
    
    postList.innerHTML = '<div class="loading-row">Loading thread...</div>';
    
    try {
        const discussion = await fetchDiscussion(discussionId);
        
        if (!discussion) {
            postList.innerHTML = '<div class="loading-row">Thread not found</div>';
            return;
        }
        
        const titleBar = document.getElementById('thread-title-bar');
        if (titleBar) titleBar.textContent = discussion.title;
        
        let html = renderPost(discussion, true);
        if (discussion.comments?.nodes) {
            html += discussion.comments.nodes.map(c => renderPost(c, false)).join('');
        }
        
        postList.innerHTML = html;
        updateAuthUI();
    } catch (e) {
        console.error('Thread load failed:', e);
        postList.innerHTML = '<div class="loading-row">Failed to load thread</div>';
    }
}

async function fetchDiscussion(discussionId) {
    const query = `query {
        node(id: "${discussionId}") {
            ... on Discussion {
                id title body createdAt author { login avatarUrl }
                comments(first: 100) { nodes { id body createdAt author { login avatarUrl } } }
            }
        }
    }`;
    
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(state.accessToken ? { 'Authorization': `Bearer ${state.accessToken}` } : {})
        },
        body: JSON.stringify({ query })
    });
    
    const data = await res.json();
    return data.data?.node;
}

function renderPost(post, isOP) {
    const avatar = post.author?.avatarUrl || 'https://github.com/ghost.png';
    const username = post.author?.login || 'unknown';
    
    return `
        <div class="post-container">
            <div class="post-header">
                <span>${timeAgo(post.createdAt)}</span>
                <span>#${isOP ? '1' : ''}</span>
            </div>
            <div class="post-body">
                <div class="post-meta">
                    <img src="${avatar}" class="post-avatar">
                    <div class="post-username">${esc(username)}</div>
                    <div class="post-usertitle">${isOP ? 'Thread Starter' : 'Member'}</div>
                </div>
                <div class="post-content">${renderMarkdown(post.body || '')}</div>
            </div>
        </div>
    `;
}

/**
 * Post reply — REQUIRES HARDWARE VERIFICATION
 */
async function postReply() {
    requireHardware(async () => {
        const text = document.getElementById('reply-text')?.value?.trim();
        if (!text) {
            alert('Please enter a reply.');
            return;
        }
        
        if (!state.currentThread) {
            alert('No thread selected.');
            return;
        }
        
        try {
            // Append hardware verification signature
            const signature = state.hwVerified 
                ? `\n\n---\n*Posted via Ci5 Verified Hardware: ${state.hwid?.substring(0, 8)}...*`
                : '';
            
            const mutation = `mutation {
                addDiscussionComment(input: {
                    discussionId: "${state.currentThread}",
                    body: "${(text + signature).replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
                }) { comment { id } }
            }`;
            
            const res = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.accessToken}`
                },
                body: JSON.stringify({ query: mutation })
            });
            
            const data = await res.json();
            if (data.errors) throw new Error(data.errors[0].message);
            
            document.getElementById('reply-text').value = '';
            viewThread(state.currentThread);
        } catch (e) {
            console.error('Reply failed:', e);
            alert(`Failed to post reply: ${e.message}`);
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD & BLACKLIST
// ═══════════════════════════════════════════════════════════════════════════

async function loadLeaderboard() {
    const topBody = document.getElementById('lb-top-body');
    const recentBody = document.getElementById('lb-recent-body');
    
    // Placeholder data - replace with actual API call
    if (topBody) {
        topBody.innerHTML = '<tr><td colspan="6" class="loading-row">Leaderboard coming soon...</td></tr>';
    }
    if (recentBody) {
        recentBody.innerHTML = '<tr><td colspan="6" class="loading-row">Recent submissions coming soon...</td></tr>';
    }
}

async function loadBlacklist() {
    const corksBody = document.getElementById('bl-corks-body');
    const hwidBody = document.getElementById('bl-hwid-body');
    
    try {
        const res = await fetch(`${CI5_API}/v1/blacklist`);
        
        if (res.ok) {
            const data = await res.json();
            
            if (hwidBody) {
                if (data.hwids?.length > 0) {
                    hwidBody.innerHTML = data.hwids.map(h => `
                        <tr>
                            <td><code>${esc(h.partial)}</code></td>
                            <td><span class="reason-badge reason-${h.reasonType}">${h.reasonType.toUpperCase()}</span> ${esc(h.reason)}</td>
                            <td>${formatDate(h.bannedSince)}</td>
                            <td class="${h.appeal === 'Denied' ? 'severity-critical' : ''}">${h.appeal}</td>
                        </tr>
                    `).join('');
                } else {
                    hwidBody.innerHTML = '<tr><td colspan="4" class="loading-row">No blacklisted HWIDs</td></tr>';
                }
            }
            
            if (corksBody) {
                if (data.corks?.length > 0) {
                    corksBody.innerHTML = data.corks.map(c => `
                        <tr>
                            <td>${esc(c.id)}</td>
                            <td><span class="reason-badge">${c.reasonType?.toUpperCase() || 'MALWARE'}</span></td>
                            <td>${c.cve || 'N/A'}</td>
                            <td>${c.severity || 'HIGH'}</td>
                            <td>${formatDate(c.blockedSince)}</td>
                        </tr>
                    `).join('');
                } else {
                    corksBody.innerHTML = '<tr><td colspan="5" class="loading-row">No compromised corks</td></tr>';
                }
            }
        }
    } catch (e) {
        console.warn('Blacklist fetch failed:', e);
        if (corksBody) corksBody.innerHTML = '<tr><td colspan="5" class="loading-row">Blacklist unavailable</td></tr>';
        if (hwidBody) hwidBody.innerHTML = '<tr><td colspan="4" class="loading-row">Blacklist unavailable</td></tr>';
    }
}

function initSubmitView() {
    updateAuthUI();
    
    if (state.user && !state.hwVerified) {
        // Prompt for hardware verification
        requireHardware(() => {});
    }
}

/**
 * Submit RRUL results — REQUIRES HARDWARE VERIFICATION
 */
async function submitRRUL() {
    requireHardware(async () => {
        const jsonInput = document.getElementById('rrul-json')?.value;
        const cork = document.getElementById('cork-select')?.value;
        const hardware = document.getElementById('hardware-input')?.value;
        const notes = document.getElementById('notes-input')?.value;
        
        let rrul;
        try {
            rrul = JSON.parse(jsonInput);
            if (!rrul.download || !rrul.upload) throw new Error('Missing fields');
        } catch (e) {
            alert('Invalid RRUL JSON. Please paste valid flent output.');
            return;
        }
        
        if (!cork) { alert('Please select a Cork.'); return; }
        if (!hardware) { alert('Please enter your hardware.'); return; }
        
        // In real implementation, POST to your API
        console.log('RRUL Submission:', {
            rrul,
            cork,
            hardware,
            notes,
            github: state.user.login,
            hwid: state.hwid
        });
        
        alert(`RRUL results submitted!\n\nDownload: ${rrul.download} Mbps\nUpload: ${rrul.upload} Mbps\nHWID: ${state.hwid?.substring(0, 8)}...`);
        
        document.getElementById('rrul-json').value = '';
        document.getElementById('notes-input').value = '';
        switchView('leaderboard');
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function esc(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function renderMarkdown(text) {
    return text
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre>$2</pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/\n/g, '<br>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return formatDate(dateString);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function doSearch() {
    const query = document.getElementById('search-input')?.value?.trim();
    if (!query) return;
    window.open(`https://github.com/search?q=org%3Adreamswag+${encodeURIComponent(query)}&type=discussions`, '_blank');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
    }
    if (e.key === 'Escape') {
        closeDeviceModal();
        closeVerifyModal();
    }
});
