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
 * 
 * Session Duration: π hours (3.14159... hours ≈ 3h 8m 30s)
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CI5_API = 'https://api.ci5.network';

// π hours in milliseconds
const PI_HOURS_MS = Math.PI * 60 * 60 * 1000;

const CONFIG = {
    clientId: 'Ov23liSwq6nuhqFog2xr',
    
    // GitHub repos for discussions
    repos: [
        { owner: 'dreamswag', repo: 'ci5.network', label: 'ci5.network' },
        { owner: 'dreamswag', repo: 'ci5', label: 'ci5' },
        { owner: 'dreamswag', repo: 'ci5.host', label: 'ci5.host' },
        { owner: 'dreamswag', repo: 'ci5.dev', label: 'ci5.dev' }
    ],
    
    // Category mappings - map to GitHub Discussion categories
    categories: {
        'metrics': { owner: 'dreamswag', repo: 'ci5.network', ghCategory: 'METRICS', title: 'RRUL Submissions' },
        'announcements': { owner: 'dreamswag', repo: 'ci5.network', ghCategory: 'Announcements', title: 'Announcements' },
        'intel_req': { owner: 'dreamswag', repo: 'ci5.network', ghCategory: 'INTEL_REQ', title: 'INTEL_REQ' },
        'armory': { owner: 'dreamswag', repo: 'ci5.network', ghCategory: 'ARMORY', title: 'ARMORY' },
        'cork-submissions': { owner: 'dreamswag', repo: 'ci5.dev', ghCategory: 'General', title: 'Cork Submissions' }
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
    verificationPollInterval: null,
    
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
    injectHardwareModal();
    initNavigation();
    checkAuth();
    checkHardwareVerification();
    loadForumStats();
});

// ═══════════════════════════════════════════════════════════════════════════
// HARDWARE VERIFICATION (π-hour sessions)
// ═══════════════════════════════════════════════════════════════════════════

async function checkHardwareVerification() {
    try {
        const res = await fetch(`${CI5_API}/v1/identity/check?session=${state.sessionId}`);
        const data = await res.json();
        
        if (data.verified) {
            state.hwVerified = true;
            state.hwid = data.hwid;
            updateHeaderUser();
            console.log(`🔒 Hardware verified: ${state.hwid.substring(0, 8)}...`);
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
        
        showHardwareModal(challenge);
        pollForVerification();
    } catch (e) {
        console.error('Verification init failed:', e);
        alert('Verification service unavailable. Try again later.');
    }
}

function showHardwareModal(challenge) {
    const modal = document.getElementById('hw-verify-modal');
    const cmdSpan = document.getElementById('hw-verify-command');
    
    if (modal && cmdSpan) {
        cmdSpan.textContent = `ci5 verify ${challenge}`;
        modal.classList.remove('hidden');
    }
}

function closeHardwareModal() {
    const modal = document.getElementById('hw-verify-modal');
    if (modal) modal.classList.add('hidden');
    
    if (state.verificationPollInterval) {
        clearInterval(state.verificationPollInterval);
        state.verificationPollInterval = null;
    }
    state.pendingAction = null;
}

function copyHardwareCommand() {
    const cmd = document.getElementById('hw-verify-command');
    if (cmd) {
        navigator.clipboard.writeText(cmd.textContent);
        cmd.style.color = '#fff';
        setTimeout(() => cmd.style.color = '#30d158', 1000);
    }
}

function pollForVerification() {
    if (state.verificationPollInterval) {
        clearInterval(state.verificationPollInterval);
    }
    
    state.verificationPollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${CI5_API}/v1/identity/check?session=${state.sessionId}`);
            const data = await res.json();
            
            if (data.verified) {
                clearInterval(state.verificationPollInterval);
                state.verificationPollInterval = null;
                
                state.hwVerified = true;
                state.hwid = data.hwid;
                
                closeHardwareModal();
                updateHeaderUser();
                
                if (state.pendingAction) {
                    const action = state.pendingAction;
                    state.pendingAction = null;
                    action();
                }
            }
        } catch (e) {
            console.warn('Poll error:', e);
        }
    }, 2000);
    
    setTimeout(() => {
        if (state.verificationPollInterval) {
            clearInterval(state.verificationPollInterval);
            state.verificationPollInterval = null;
        }
    }, 300000);
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

function injectHardwareModal() {
    if (document.getElementById('hw-verify-modal')) return;
    
    const div = document.createElement('div');
    div.id = 'hw-verify-modal';
    div.className = 'overlay hidden';
    div.onclick = (e) => { if (e.target.id === 'hw-verify-modal') closeHardwareModal(); };
    div.innerHTML = `
        <div class="vb-modal" style="text-align:center; max-width:420px;">
            <div class="cat-header">🔒 Hardware Verification Required</div>
            <div class="modal-body">
                <p>To post or vote, you must verify your Ci5 hardware.</p>
                <p style="color:#666; font-size:0.9em;">Run this command on your Pi:</p>
                <div class="code-display" style="cursor:pointer;" onclick="copyHardwareCommand()">
                    <span id="hw-verify-command">ci5 verify ...</span>
                </div>
                <p style="color:#555; font-size:0.8em;">Click to copy • Waiting for verification...</p>
                <p style="color:#444; font-size:0.75em; margin-top:10px;">Session valid for π hours (~3h 8m) after verification</p>
            </div>
            <div class="modal-btns">
                <button class="vb-btn" onclick="closeHardwareModal()">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

function initNavigation() {
    // Desktop nav links
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
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
        
        document.querySelectorAll('.mobile-nav-link[data-view]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                mobileDrawer.classList.add('hidden');
                mobileMenuBtn.classList.remove('active');
                const view = link.dataset.view;
                if (view) switchView(view);
            });
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!mobileDrawer.contains(e.target) && !mobileMenuBtn.contains(e.target) && !mobileDrawer.classList.contains('hidden')) {
                mobileDrawer.classList.add('hidden');
                mobileMenuBtn.classList.remove('active');
            }
        });
    }
}

function switchView(view) {
    document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
    
    const panel = document.getElementById(`view-${view}`);
    if (panel) panel.classList.remove('hidden');
    
    // Update nav active states
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.view === view);
    });
    document.querySelectorAll('.mobile-nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.view === view);
    });
    
    state.currentView = view;
    
    // Load view-specific data
    if (view === 'leaderboard') loadLeaderboard();
    if (view === 'blacklist') loadBlacklist();
    if (view === 'submit') initSubmitView();
}

function toggleCategory(btn) {
    const body = btn.closest('.cat-header').nextElementSibling;
    if (body) {
        if (body.classList.contains('collapsed')) {
            body.classList.remove('collapsed');
            btn.textContent = '[−]';
        } else {
            body.classList.add('collapsed');
            btn.textContent = '[+]';
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB OAUTH (Device Flow)
// ═══════════════════════════════════════════════════════════════════════════

function checkAuth() {
    if (state.accessToken) {
        fetchUserInfo();
    }
    updateHeaderUser();
}

async function fetchUserInfo() {
    try {
        const res = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${state.accessToken}` }
        });
        
        if (res.ok) {
            state.user = await res.json();
            updateHeaderUser();
        } else {
            logout(true);
        }
    } catch (e) {
        console.error('Auth check failed:', e);
    }
}

function updateHeaderUser() {
    const headerUser = document.getElementById('header-user');
    const mobileUserSection = document.getElementById('mobile-user-section');
    const replyBox = document.getElementById('reply-box');
    const submitGate = document.getElementById('submit-auth-gate');
    const submitForm = document.getElementById('submit-form-content');
    
    if (state.user) {
        // Desktop header
        if (headerUser) {
            const verifiedBadge = state.hwVerified 
                ? '<span class="hw-badge">🔒</span>' 
                : '';
            headerUser.innerHTML = `
                <img src="${state.user.avatar_url}" class="header-avatar" alt="">
                <span class="header-username">${state.user.login}</span>
                ${verifiedBadge}
                <a href="#" class="header-logout" onclick="logout(); return false;">Log Out</a>
            `;
        }
        
        // Mobile section
        if (mobileUserSection) {
            mobileUserSection.innerHTML = `
                <div class="mobile-nav-header">Account</div>
                <div class="mobile-user-info">
                    <img src="${state.user.avatar_url}" class="mobile-avatar" alt="">
                    <span>${state.user.login}</span>
                    ${state.hwVerified ? '<span class="hw-badge-small">🔒</span>' : ''}
                </div>
                <a href="#" class="mobile-nav-link" onclick="logout(); return false;">Log Out</a>
            `;
        }
        
        // Show reply box in thread view
        if (replyBox) replyBox.classList.remove('hidden');
        
        // Update submit view
        if (submitGate) submitGate.classList.add('hidden');
        if (submitForm) submitForm.classList.remove('hidden');
        
        // Update reply status
        updateReplyStatus();
    } else {
        // Desktop header - login button
        if (headerUser) {
            headerUser.innerHTML = `
                <button class="header-login-btn" onclick="startDeviceAuth()">Login</button>
            `;
        }
        
        // Mobile section
        if (mobileUserSection) {
            mobileUserSection.innerHTML = `
                <div class="mobile-nav-header">Account</div>
                <a href="#" class="mobile-nav-link" onclick="startDeviceAuth(); return false;">Login via GitHub</a>
            `;
        }
        
        // Hide reply box
        if (replyBox) replyBox.classList.add('hidden');
        
        // Update submit view
        if (submitGate) submitGate.classList.remove('hidden');
        if (submitForm) submitForm.classList.add('hidden');
    }
}

function updateReplyStatus() {
    const status = document.getElementById('reply-status');
    if (!status) return;
    
    if (!state.user) {
        status.innerHTML = '<span class="status-warn">Login required</span>';
    } else if (!state.hwVerified) {
        status.innerHTML = '<span class="status-warn">Hardware verification required</span>';
    } else {
        status.innerHTML = `<span class="status-ok">🔒 ${state.hwid?.substring(0, 8)}...</span>`;
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
        // Request device code - need write:discussion scope for posting
        const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://github.com/login/device/code'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ 
                client_id: CONFIG.clientId, 
                scope: 'public_repo write:discussion'  // Need this for posting
            })
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
                state.deviceFlowInterval = null;
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

function logout(silent = false) {
    if (!silent && !confirm('Log out of ci5.network?')) return;
    
    state.user = null;
    state.accessToken = null;
    state.hwVerified = false;
    state.hwid = null;
    
    localStorage.removeItem('gh_token');
    localStorage.removeItem('ci5_session');
    
    state.sessionId = crypto.randomUUID();
    localStorage.setItem('ci5_session', state.sessionId);
    
    updateHeaderUser();
    if (state.currentView === 'submit') {
        switchView('index');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FORUM DATA
// ═══════════════════════════════════════════════════════════════════════════

async function loadForumStats() {
    // Load stats for each category
    for (const [catId, cfg] of Object.entries(CONFIG.categories)) {
        try {
            const query = `query {
                repository(owner: "${cfg.owner}", name: "${cfg.repo}") {
                    discussions(first: 1, categoryId: null) {
                        totalCount
                    }
                }
            }`;
            
            // Just set placeholders for now - full implementation would query by category
            const threadsEl = document.getElementById(`${catId}-threads`);
            const postsEl = document.getElementById(`${catId}-posts`);
            const lastEl = document.getElementById(`${catId}-last`);
            
            if (threadsEl) threadsEl.textContent = '—';
            if (postsEl) postsEl.textContent = '—';
            if (lastEl) lastEl.textContent = 'Loading...';
        } catch (e) {
            console.warn(`Failed to load stats for ${catId}:`, e);
        }
    }
}

async function viewCategory(categoryId) {
    const cfg = CONFIG.categories[categoryId];
    if (!cfg) return;
    
    state.currentCategory = { id: categoryId, ...cfg };
    
    const titleEl = document.getElementById('category-title');
    const headerEl = document.getElementById('category-header');
    const listEl = document.getElementById('thread-list');
    
    if (titleEl) titleEl.textContent = cfg.title;
    if (headerEl) headerEl.textContent = `${cfg.title} Threads`;
    if (listEl) listEl.innerHTML = '<tr><td colspan="4" class="loading-row">Loading threads...</td></tr>';
    
    switchView('category');
    
    try {
        const discussions = await fetchDiscussions(cfg.owner, cfg.repo, 20);
        
        if (discussions.length === 0) {
            listEl.innerHTML = '<tr><td colspan="4" class="loading-row">No threads yet. Be the first!</td></tr>';
        } else {
            listEl.innerHTML = discussions.map(d => `
                <tr class="forum-row">
                    <td align="center"><div class="f-icon">💬</div></td>
                    <td>
                        <div class="thread-title">
                            <a href="#" onclick="viewThread('${d.id}'); return false;">${esc(d.title)}</a>
                        </div>
                        <div class="thread-meta">
                            by ${esc(d.author?.login || 'unknown')} · ${timeAgo(d.createdAt)}
                        </div>
                    </td>
                    <td class="hide-mobile last-post">${d.comments?.totalCount > 0 ? timeAgo(d.updatedAt) : '—'}</td>
                    <td align="center">${d.comments?.totalCount || 0}</td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Failed to load category:', e);
        listEl.innerHTML = '<tr><td colspan="4" class="loading-row">Failed to load threads</td></tr>';
    }
}

async function fetchDiscussions(owner, repo, limit = 10) {
    const query = `query {
        repository(owner: "${owner}", name: "${repo}") {
            discussions(first: ${limit}, orderBy: {field: UPDATED_AT, direction: DESC}) {
                nodes {
                    id
                    title
                    createdAt
                    updatedAt
                    author { login avatarUrl }
                    comments { totalCount }
                }
            }
        }
    }`;
    
    const headers = { 'Content-Type': 'application/json' };
    if (state.accessToken) {
        headers['Authorization'] = `Bearer ${state.accessToken}`;
    }
    
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query })
    });
    
    const data = await res.json();
    
    if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        throw new Error(data.errors[0].message);
    }
    
    return data.data?.repository?.discussions?.nodes || [];
}

async function viewThread(discussionId) {
    state.currentThread = discussionId;
    
    const titleBar = document.getElementById('thread-title-bar');
    const postList = document.getElementById('post-list');
    
    if (titleBar) titleBar.textContent = 'Loading...';
    if (postList) postList.innerHTML = '<div class="loading-row">Loading thread...</div>';
    
    switchView('thread');
    updateReplyStatus();
    
    try {
        const query = `query {
            node(id: "${discussionId}") {
                ... on Discussion {
                    id
                    title
                    body
                    createdAt
                    author { login avatarUrl }
                    comments(first: 100) {
                        nodes {
                            id
                            body
                            createdAt
                            author { login avatarUrl }
                        }
                    }
                }
            }
        }`;
        
        const headers = { 'Content-Type': 'application/json' };
        if (state.accessToken) {
            headers['Authorization'] = `Bearer ${state.accessToken}`;
        }
        
        const res = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers,
            body: JSON.stringify({ query })
        });
        
        const data = await res.json();
        const discussion = data.data?.node;
        
        if (!discussion) {
            throw new Error('Thread not found');
        }
        
        if (titleBar) titleBar.textContent = discussion.title;
        
        // Render OP
        let html = renderPost(discussion, true);
        
        // Render replies
        if (discussion.comments?.nodes) {
            html += discussion.comments.nodes.map(c => renderPost(c, false)).join('');
        }
        
        postList.innerHTML = html;
        
    } catch (e) {
        console.error('Failed to load thread:', e);
        postList.innerHTML = '<div class="loading-row">Failed to load thread</div>';
    }
}

function renderPost(post, isOP) {
    const avatar = post.author?.avatarUrl || 'https://github.com/ghost.png';
    const username = post.author?.login || 'unknown';
    
    return `
        <div class="post-container ${isOP ? 'op' : ''}">
            <div class="post-header">
                <span>${timeAgo(post.createdAt)}</span>
                <span>${isOP ? '#1' : ''}</span>
            </div>
            <div class="post-body">
                <div class="post-meta">
                    <img src="${avatar}" class="post-avatar" alt="">
                    <div class="post-username">${esc(username)}</div>
                    <div class="post-usertitle">${isOP ? 'Thread Starter' : 'Member'}</div>
                </div>
                <div class="post-content">${renderMarkdown(post.body || '')}</div>
            </div>
        </div>
    `;
}

function backToCategory() {
    if (state.currentCategory) {
        viewCategory(state.currentCategory.id);
    } else {
        switchView('index');
    }
}

/**
 * Post reply — REQUIRES HARDWARE VERIFICATION
 */
async function postReply() {
    requireHardware(async () => {
        const textarea = document.getElementById('reply-text');
        const text = textarea?.value?.trim();
        
        if (!text) {
            alert('Please enter a reply.');
            return;
        }
        
        if (!state.currentThread) {
            alert('No thread selected.');
            return;
        }
        
        // Show posting state
        const btn = document.querySelector('#reply-box .vb-btn.primary');
        const originalText = btn?.textContent;
        if (btn) {
            btn.textContent = 'Posting...';
            btn.disabled = true;
        }
        
        try {
            // Append hardware verification signature
            const signature = state.hwVerified 
                ? `\n\n---\n*Posted via Ci5 Verified Hardware: \`${state.hwid?.substring(0, 8)}...\`*`
                : '';
            
            const bodyText = text + signature;
            
            const mutation = `mutation AddComment($discussionId: ID!, $body: String!) {
                addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
                    comment { id }
                }
            }`;
            
            const res = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.accessToken}`
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        discussionId: state.currentThread,
                        body: bodyText
                    }
                })
            });
            
            const data = await res.json();
            
            if (data.errors) {
                throw new Error(data.errors[0].message);
            }
            
            // Success - clear and reload
            textarea.value = '';
            viewThread(state.currentThread);
            
        } catch (e) {
            console.error('Reply failed:', e);
            alert(`Failed to post reply: ${e.message}\n\nMake sure you have authorized the app with discussion permissions.`);
        } finally {
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD & BLACKLIST
// ═══════════════════════════════════════════════════════════════════════════

async function loadLeaderboard() {
    const topBody = document.getElementById('lb-top-body');
    
    if (topBody) {
        topBody.innerHTML = '<tr><td colspan="6" class="loading-row">Leaderboard coming soon...</td></tr>';
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
                            <td><span class="reason-badge reason-${h.reasonType}">${(h.reasonType || 'abuse').toUpperCase()}</span> ${esc(h.reason)}</td>
                            <td class="hide-mobile">${formatDate(h.bannedSince)}</td>
                            <td class="hide-mobile ${h.appeal === 'Denied' ? 'severity-critical' : ''}">${h.appeal || 'Pending'}</td>
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
                            <td><span class="reason-badge">${(c.reasonType || 'MALWARE').toUpperCase()}</span></td>
                            <td class="hide-mobile">${c.cve || 'N/A'}</td>
                            <td>${c.severity || 'HIGH'}</td>
                            <td class="hide-mobile">${formatDate(c.blockedSince)}</td>
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
    updateHeaderUser();
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
    return (text || '')
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
    if (!dateString) return '—';
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(dateString);
}

function formatDate(dateString) {
    if (!dateString) return '—';
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
        closeHardwareModal();
    }
});
