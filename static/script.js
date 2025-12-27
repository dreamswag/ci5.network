/* ============================================
   ci5.network Forums — Core Logic
   GitHub Discussions API + Device Flow Auth
   ============================================ */

// ===== CONFIGURATION =====
const CONFIG = {
    // GitHub OAuth App Client ID (Shared Ecosystem ID)
    // Same ID used for ci5.dev and ci5 CLI
    clientId: 'Ov23liSwq6nuhqFog2xr',
    
    // Repos to aggregate
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
    
    // API endpoints (Mocked/Placeholder for static site)
    api: {
        leaderboard: '/api/leaderboard',
        blacklist: '/api/blacklist',
        submit: '/api/submit',
        submitVerified: '/api/submit/verified',
        getChallenge: '/api/challenge/new',
        checkChallenge: '/api/challenge/status',
        deviceCode: '/api/auth/device-code',
        pollToken: '/api/auth/poll-token'
    }
};

// ===== STATE =====
const state = {
    user: null,
    accessToken: localStorage.getItem('gh_token'),
    currentView: 'index',
    currentCategory: null,
    currentThread: null,
    currentRepo: 'all',
    deviceFlowInterval: null,
    challengeInterval: null,
    activeChallenge: null
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initRepoTabs();
    checkAuth();
    loadForumData();
});

function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            if (view) switchView(view);
        });
    });
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

// ===== VIEW MANAGEMENT =====
function switchView(view) {
    document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`view-${view}`);
    if (panel) panel.classList.remove('hidden');
    
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.view === view);
    });
    
    updateBreadcrumb(view);
    state.currentView = view;
    
    // Cleanup intervals
    if (state.challengeInterval) {
        clearInterval(state.challengeInterval);
        state.challengeInterval = null;
    }

    if (view === 'leaderboard') loadLeaderboard();
    if (view === 'blacklist') loadBlacklist();
    if (view === 'submit') initSubmitView();
}

function updateBreadcrumb(view) {
    const crumbs = {
        'index': 'ci5.network › Forums › Index',
        'leaderboard': 'ci5.network › Forums › Leaderboard',
        'submit': 'ci5.network › Forums › Submit RRUL',
        'blacklist': 'ci5.network › Forums › Hall of .shAME',
        'category': `ci5.network › Forums › ${state.currentCategory?.title || 'Category'}`,
        'thread': `ci5.network › Forums › Thread`
    };
    const nav = document.getElementById('nav-trail');
    if (nav) nav.textContent = crumbs[view] || crumbs['index'];
}

// ===== REPO FILTERING =====
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

// ===== AUTH =====
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
    const submitAuth = document.getElementById('submit-auth-required');
    const submitContent = document.getElementById('submit-content');
    const replyBox = document.getElementById('reply-box');
    
    if (state.user) {
        guest.classList.add('hidden');
        user.classList.remove('hidden');
        document.getElementById('user-avatar').src = state.user.avatar_url;
        document.getElementById('user-name').textContent = state.user.login;
        if (submitAuth) submitAuth.classList.add('hidden');
        if (submitContent) submitContent.classList.remove('hidden');
        if (replyBox) replyBox.classList.remove('hidden');
    } else {
        guest.classList.remove('hidden');
        user.classList.add('hidden');
        if (submitAuth) submitAuth.classList.remove('hidden');
        if (submitContent) submitContent.classList.add('hidden');
        if (replyBox) replyBox.classList.add('hidden');
    }
}

// ===== DEVICE FLOW AUTH =====
async function startDeviceAuth() {
    const modal = document.getElementById('device-modal');
    const loading = document.getElementById('device-loading');
    const codeSection = document.getElementById('device-code-section');
    
    modal.classList.remove('hidden');
    loading.classList.remove('hidden');
    codeSection.classList.add('hidden');
    
    try {
        const res = await fetch(CONFIG.api.deviceCode, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: CONFIG.clientId })
        });
        
        if (!res.ok) throw new Error('Failed to get device code');
        
        const data = await res.json();
        
        loading.classList.add('hidden');
        codeSection.classList.remove('hidden');
        document.getElementById('user-code').textContent = data.user_code;
        
        pollForToken(data.device_code, data.interval || 5);
    } catch (e) {
        console.error('Device auth failed:', e);
        // Fallback for static demo
        alert('Authentication failed (Backend Offline). Use console to debug.');
        closeDeviceModal();
    }
}

async function pollForToken(deviceCode, interval) {
    state.deviceFlowInterval = setInterval(async () => {
        try {
            const res = await fetch(CONFIG.api.pollToken, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
    }, interval * 1000);
}

function closeDeviceModal() {
    document.getElementById('device-modal').classList.add('hidden');
    if (state.deviceFlowInterval) {
        clearInterval(state.deviceFlowInterval);
        state.deviceFlowInterval = null;
    }
}

function logout() {
    state.user = null;
    state.accessToken = null;
    localStorage.removeItem('gh_token');
    updateAuthUI();
}

// ===== DATA LOADING =====
async function loadForumData() {
    loadActivityFeed();
    loadCategoryStats();
}

async function loadActivityFeed() {
    const list = document.getElementById('activity-list');
    
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
            
            const stats = await fetchCategoryStats(repo.owner, repo.repo, cfg.ghCategory);
            
            const threads = document.getElementById(`${id}-threads`);
            const posts = document.getElementById(`${id}-posts`);
            const last = document.getElementById(`${id}-last`);
            
            if (threads) threads.textContent = stats.threadCount;
            if (posts) posts.textContent = stats.postCount;
            if (last && stats.lastPost) {
                last.innerHTML = `by ${esc(stats.lastPost.author)}<br>${timeAgo(stats.lastPost.date)}`;
            }
        } catch (e) {
            console.warn(`Stats failed for ${id}:`, e);
        }
    }
}

async function fetchCategoryStats(owner, repo, categoryName) {
    const query = `query {
        repository(owner: "${owner}", name: "${repo}") {
            discussions(first: 100) {
                totalCount
                nodes { category { name } comments { totalCount } createdAt author { login } }
            }
        }
    }`;
    
    try {
        const res = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(state.accessToken ? { 'Authorization': `Bearer ${state.accessToken}` } : {})
            },
            body: JSON.stringify({ query })
        });
        
        const data = await res.json();
        const all = data.data?.repository?.discussions?.nodes || [];
        const filtered = all.filter(d => d.category?.name?.toLowerCase() === categoryName?.toLowerCase());
        
        return {
            threadCount: filtered.length,
            postCount: filtered.reduce((sum, d) => sum + (d.comments?.totalCount || 0) + 1, 0),
            lastPost: filtered[0] ? { author: filtered[0].author?.login || 'unknown', date: filtered[0].createdAt } : null
        };
    } catch (e) {
        return { threadCount: '—', postCount: '—', lastPost: null };
    }
}

// ===== CATEGORY & THREAD VIEWS =====
async function viewCategory(categoryId) {
    const cfg = CONFIG.categories[categoryId];
    if (!cfg) return;
    
    state.currentCategory = { id: categoryId, ...cfg };
    document.getElementById('category-title').textContent = cfg.title;
    document.getElementById('category-header').textContent = cfg.title;
    
    switchView('category');
    
    const list = document.getElementById('thread-list');
    list.innerHTML = '<tr><td colspan="4" class="loading-row">Loading threads...</td></tr>';
    
    try {
        const repo = CONFIG.repos.find(r => r.label === cfg.repo);
        if (!repo) throw new Error('Repo not found');
        
        const discussions = await fetchDiscussionsByCategory(repo.owner, repo.repo, cfg.ghCategory);
        
        if (discussions.length === 0) {
            list.innerHTML = '<tr><td colspan="4" class="loading-row">No threads in this category</td></tr>';
        } else {
            list.innerHTML = discussions.map(d => `
                <tr class="forum-row alt-a">
                    <td align="center"><div class="f-icon">📝</div></td>
                    <td>
                        <div class="forum-title"><a href="#" onclick="viewThread('${d.id}'); return false;">${esc(d.title)}</a></div>
                        <div class="forum-desc">by ${esc(d.author?.login || 'unknown')} · ${timeAgo(d.createdAt)}</div>
                    </td>
                    <td class="last-post">${timeAgo(d.createdAt)}</td>
                    <td align="center">${d.comments?.totalCount || 0}</td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Category load failed:', e);
        list.innerHTML = '<tr><td colspan="4" class="loading-row">Failed to load threads</td></tr>';
    }
}

async function fetchDiscussionsByCategory(owner, repo, categoryName) {
    const query = `query {
        repository(owner: "${owner}", name: "${repo}") {
            discussions(first: 50, orderBy: {field: CREATED_AT, direction: DESC}) {
                nodes { id title body createdAt author { login avatarUrl } category { name } comments(first: 1) { totalCount } }
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
    return (data.data?.repository?.discussions?.nodes || []).filter(d => 
        d.category?.name?.toLowerCase() === categoryName?.toLowerCase()
    );
}

async function viewThread(discussionId) {
    state.currentThread = discussionId;
    switchView('thread');
    
    const postList = document.getElementById('post-list');
    postList.innerHTML = '<div class="loading-row">Loading thread...</div>';
    
    try {
        const discussion = await fetchDiscussion(discussionId);
        
        if (!discussion) {
            postList.innerHTML = '<div class="loading-row">Thread not found</div>';
            return;
        }
        
        document.getElementById('thread-title-bar').textContent = discussion.title;
        
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

function backToCategory() {
    if (state.currentCategory) {
        viewCategory(state.currentCategory.id);
    } else {
        switchView('index');
    }
}

// ===== LEADERBOARD =====
async function loadLeaderboard() {
    const topBody = document.getElementById('lb-top-body');
    const recentBody = document.getElementById('lb-recent-body');
    
    try {
        const res = await fetch(CONFIG.api.leaderboard);
        if (res.ok) {
            const data = await res.json();
            
            if (data.top?.length > 0) {
                topBody.innerHTML = data.top.map((e, i) => `
                    <tr class="forum-row alt-a">
                        <td><span class="rank-medal">${getRankMedal(i + 1)}</span></td>
                        <td><a href="https://github.com/${e.github}" target="_blank">${esc(e.github)}</a>${e.verified ? '<span class="verified-badge" title="Verified Hardware">🛡️</span>' : ''}</td>
                        <td><span class="speed-value">${e.throughput}</span> Mbps</td>
                        <td>+${e.latency}ms</td>
                        <td>
                            ${esc(e.hardware)}
                            ${e.hwHash ? `<span class="hardware-hash" title="Reproducible Hash">#${e.hwHash.substring(0,8)}</span>` : ''}
                        </td>
                        <td>${formatDate(e.date)}</td>
                    </tr>
                `).join('');
            }
            
            if (data.recent?.length > 0) {
                recentBody.innerHTML = data.recent.map(e => `
                    <tr class="forum-row alt-a">
                        <td><a href="https://github.com/${e.github}" target="_blank">${esc(e.github)}</a>${e.verified ? '<span class="verified-badge" title="Verified Hardware">🛡️</span>' : ''}</td>
                        <td><span class="speed-value">${e.download}</span> Mbps</td>
                        <td><span class="speed-value">${e.upload}</span> Mbps</td>
                        <td>${e.latency} ms</td>
                        <td>
                            ${esc(e.cork || e.hardware)}
                            ${e.hwHash ? `<span class="hardware-hash">#${e.hwHash.substring(0,8)}</span>` : ''}
                        </td>
                        <td>${timeAgo(e.submitted)}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (e) {
        console.warn('Leaderboard unavailable');
        recentBody.innerHTML = '<tr><td colspan="6" class="loading-row">Leaderboard unavailable</td></tr>';
    }
}

function getRankMedal(rank) {
    return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
}

// ===== BLACKLIST =====
async function loadBlacklist() {
    const corksBody = document.getElementById('bl-corks-body');
    const hwidBody = document.getElementById('bl-hwid-body');
    
    try {
        const res = await fetch(CONFIG.api.blacklist);
        if (res.ok) {
            const data = await res.json();
            
            if (data.corks?.length > 0) {
                corksBody.innerHTML = data.corks.map(c => `
                    <tr>
                        <td>${esc(c.id)}</td>
                        <td><span class="reason-badge reason-${c.reasonType}">${c.reasonType.toUpperCase()}</span></td>
                        <td>${c.cve || 'N/A'}</td>
                        <td class="severity-${c.severity.toLowerCase()}">${c.severity}</td>
                        <td>${formatDate(c.blockedSince)}</td>
                    </tr>
                `).join('');
            } else {
                corksBody.innerHTML = '<tr><td colspan="5" class="loading-row">No compromised corks</td></tr>';
            }
            
            if (data.hwids?.length > 0) {
                hwidBody.innerHTML = data.hwids.map(h => `
                    <tr>
                        <td>${esc(h.partial)}</td>
                        <td><span class="reason-badge reason-abuse">${h.reasonType.toUpperCase()}</span> ${esc(h.reason)}</td>
                        <td>${formatDate(h.bannedSince)}</td>
                        <td class="${h.appeal === 'Denied' ? 'severity-critical' : ''}">${h.appeal}</td>
                    </tr>
                `).join('');
            } else {
                hwidBody.innerHTML = '<tr><td colspan="4" class="loading-row">No blacklisted HWIDs</td></tr>';
            }
        }
    } catch (e) {
        console.warn('Blacklist unavailable');
        corksBody.innerHTML = '<tr><td colspan="5" class="loading-row">Blacklist unavailable</td></tr>';
        hwidBody.innerHTML = '<tr><td colspan="4" class="loading-row">Blacklist unavailable</td></tr>';
    }
}

// ===== VERIFIED SUBMISSION FLOW =====
async function initSubmitView() {
    updateAuthUI();
    if (state.user) {
        // Generate new Challenge Token
        try {
            // In a real implementation, this hits the API
            // const res = await fetch(CONFIG.api.getChallenge, { ... });
            // const data = await res.json();
            
            // Simulating for UI
            const challenge = 'rrul_' + Math.random().toString(36).substring(2, 6);
            state.activeChallenge = challenge;
            
            document.getElementById('challenge-code').textContent = challenge;
            document.getElementById('cmd-token').textContent = challenge;
            
            // Start Polling for Submission
            pollForSubmission(challenge);
            
        } catch (e) {
            console.error("Failed to generate challenge:", e);
        }
    }
}

function pollForSubmission(challenge) {
    if (state.challengeInterval) clearInterval(state.challengeInterval);
    
    state.challengeInterval = setInterval(async () => {
        try {
            // const res = await fetch(`${CONFIG.api.checkChallenge}/${challenge}`);
            // if (res.ok && (await res.json()).submitted) { ... }
            
            // Mocking success after random time for demo? 
            // In real app, just wait for signal.
        } catch (e) {
            console.error("Poll failed");
        }
    }, 3000);
}

function copyChallenge() {
    const code = document.getElementById('challenge-code').textContent;
    navigator.clipboard.writeText(code);
    alert('Challenge Token copied to clipboard!');
}

// ===== MANUAL SUBMISSION (LEGACY) =====
async function submitRRUL() {
    if (!state.user) {
        startDeviceAuth();
        return;
    }
    
    const jsonInput = document.getElementById('rrul-json').value;
    const cork = document.getElementById('cork-select').value;
    const hardware = document.getElementById('hardware-input').value;
    const notes = document.getElementById('notes-input').value;
    
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
    
    try {
        const res = await fetch(CONFIG.api.submit, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.accessToken}`
            },
            body: JSON.stringify({ rrul, cork, hardware, notes, github: state.user.login, verified: false })
        });
        
        if (res.ok) {
            alert('RRUL results submitted successfully!');
            document.getElementById('rrul-json').value = '';
            document.getElementById('notes-input').value = '';
            loadLeaderboard();
        } else {
            const err = await res.json();
            alert(`Submission failed: ${err.message || 'Unknown error'}`);
        }
    } catch (e) {
        console.error('Submit failed:', e);
        alert('Submission failed (Backend Offline).');
    }
}

// ===== REPLY =====
async function postReply() {
    if (!state.user || !state.currentThread) return;
    
    const text = document.getElementById('reply-text').value.trim();
    if (!text) { alert('Please enter a reply.'); return; }
    
    try {
        const mutation = `mutation {
            addDiscussionComment(input: {
                discussionId: "${state.currentThread}",
                body: "${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
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
}

// ===== SEARCH =====
function doSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    window.open(`https://github.com/search?q=org%3Adreamswag+${encodeURIComponent(query)}&type=discussions`, '_blank');
}

// ===== UTILITIES =====
function esc(text) {
    const div = document.createElement('div');
    div.textContent = text;
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
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        document.getElementById('search-input').focus();
    }
    if (e.key === 'Escape') closeDeviceModal();
});