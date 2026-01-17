// ============ 状态管理 ============
const state = {
    token: localStorage.getItem('token'),
    username: localStorage.getItem('username'),
    isAdmin: false,
    conversations: JSON.parse(localStorage.getItem('conversations') || '[]'),
    currentConversationId: null,
    models: [],
    currentModel: localStorage.getItem('currentModel') || '',
    isStreaming: false,
    abortController: null,
    searchQuery: '',
    selectedImages: [],
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent)
};

// ============ DOM元素 ============
const loginPage = document.getElementById('login-page');
const chatPage = document.getElementById('chat-page');
const adminPage = document.getElementById('admin-page');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const regUsernameInput = document.getElementById('reg-username');
const regPasswordInput = document.getElementById('reg-password');
const regPasswordConfirmInput = document.getElementById('reg-password-confirm');
const regInviteCodeInput = document.getElementById('reg-invite-code');
const switchToRegister = document.getElementById('switch-to-register');
const switchToLogin = document.getElementById('switch-to-login');
const authSubtitle = document.getElementById('auth-subtitle');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');
const modelSelector = document.getElementById('model-selector');
const modelTrigger = document.getElementById('model-trigger');
const modelDisplay = document.getElementById('model-display');
const modelDropdown = document.getElementById('model-dropdown');
const modelDropdownContent = document.getElementById('model-dropdown-content');
const conversationList = document.getElementById('conversation-list');
const newChatBtn = document.getElementById('new-chat-btn');
const logoutBtn = document.getElementById('logout-btn');
const currentUserSpan = document.getElementById('current-user');
const themeBtn = document.getElementById('theme-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const stopBtn = document.getElementById('stop-btn');
const searchInput = document.getElementById('search-conversations');
const quickPrompts = document.getElementById('quick-prompts');
const userAvatar = document.getElementById('user-avatar');
const adminBtn = document.getElementById('admin-btn');
const adminCloseBtn = document.getElementById('admin-close-btn');
const inviteCodesList = document.getElementById('invite-codes-list');
const usersList = document.getElementById('users-list');
const createInviteCodeBtn = document.getElementById('create-invite-code-btn');
const settingsForm = document.getElementById('settings-form');
const settingsApiUrl = document.getElementById('settings-api-url');
const settingsApiKey = document.getElementById('settings-api-key');
const toggleApiKeyBtn = document.getElementById('toggle-api-key');
const apiKeyMasked = document.getElementById('api-key-masked');
const testSettingsBtn = document.getElementById('test-settings-btn');
const settingsMessage = document.getElementById('settings-message');
const imageBtn = document.getElementById('image-btn');
const imageInput = document.getElementById('image-input');
const imagePreviewContainer = document.getElementById('image-preview-container');

// ============ 初始化 ============
async function init() {
    // 初始化主题
    initTheme();

    if (state.token) {
        try {
            const resp = await fetch('/api/me', {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                state.isAdmin = data.is_admin;
                showChatPage();
                await loadModels();
                renderConversations();
                return;
            }
        } catch (e) {}
        logout();
    }
    showLoginPage();
}

// ============ 页面切换 ============
function showLoginPage() {
    loginPage.classList.remove('hidden');
    chatPage.classList.add('hidden');
    adminPage.classList.add('hidden');
}

function showChatPage() {
    loginPage.classList.add('hidden');
    chatPage.classList.remove('hidden');
    adminPage.classList.add('hidden');
    currentUserSpan.textContent = state.username;
    if (userAvatar) {
        userAvatar.textContent = getUserInitial();
    }
    // 显示/隐藏管理按钮
    if (adminBtn) {
        adminBtn.classList.toggle('hidden', !state.isAdmin);
    }
}

function showAdminPage() {
    loginPage.classList.add('hidden');
    chatPage.classList.add('hidden');
    adminPage.classList.remove('hidden');
    loadInviteCodes();
    loadUsers();
    loadSettings();
}

// ============ 登录/注册表单切换 ============
function showRegisterForm() {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    switchToRegister.classList.add('hidden');
    switchToLogin.classList.remove('hidden');
    authSubtitle.textContent = '注册新账号';
    loginError.textContent = '';
    registerError.textContent = '';
}

function showLoginForm() {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    switchToRegister.classList.remove('hidden');
    switchToLogin.classList.add('hidden');
    authSubtitle.textContent = '登录以开始对话';
    loginError.textContent = '';
    registerError.textContent = '';
}

switchToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
});

switchToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
});

// ============ 登录/登出 ============
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';

    try {
        const resp = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: usernameInput.value,
                password: passwordInput.value
            })
        });

        const data = await resp.json();

        if (resp.ok) {
            state.token = data.token;
            state.username = data.username;
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            // 获取用户信息
            const meResp = await fetch('/api/me', {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (meResp.ok) {
                const meData = await meResp.json();
                state.isAdmin = meData.is_admin;
            }
            showChatPage();
            await loadModels();
            renderConversations();
        } else {
            loginError.textContent = data.detail || '登录失败';
        }
    } catch (e) {
        loginError.textContent = '网络错误，请重试';
    }
});

// ============ 注册 ============
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.textContent = '';

    const username = regUsernameInput.value.trim();
    const password = regPasswordInput.value;
    const passwordConfirm = regPasswordConfirmInput.value;
    const inviteCode = regInviteCodeInput.value.trim();

    // 前端验证
    if (password !== passwordConfirm) {
        registerError.textContent = '两次输入的密码不一致';
        return;
    }

    try {
        const resp = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password,
                invite_code: inviteCode
            })
        });

        const data = await resp.json();

        if (resp.ok) {
            state.token = data.token;
            state.username = data.username;
            state.isAdmin = false;
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            showChatPage();
            await loadModels();
            renderConversations();
            showToast('注册成功');
        } else {
            registerError.textContent = data.detail || '注册失败';
        }
    } catch (e) {
        registerError.textContent = '网络错误，请重试';
    }
});

function logout() {
    state.token = null;
    state.username = null;
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    showLoginPage();
}

logoutBtn.addEventListener('click', logout);

// ============ 模型加载 ============
async function loadModels() {
    try {
        const resp = await fetch('/api/models', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await resp.json();

        if (data.data) {
            state.models = data.data.map(m => m.id).sort();
            renderModelSelect();
        }
    } catch (e) {
        console.error('加载模型失败:', e);
    }
}

function renderModelSelect() {
    // 按厂商分组
    const groups = {
        'Claude': { icon: 'claude', models: [] },
        'GPT': { icon: 'gpt', models: [] },
        'Gemini': { icon: 'gemini', models: [] },
        'GLM': { icon: 'glm', models: [] },
        '其他': { icon: 'other', models: [] }
    };

    // 厂商图标 SVG (来源: lobehub/lobe-icons)
    const groupIcons = {
        claude: `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"/></svg>`,
        gpt: `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" fill-rule="evenodd" d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"/></svg>`,
        gemini: `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"/></svg>`,
        glm: `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" fill-rule="evenodd" d="M9.917 2c4.906 0 10.178 3.947 8.93 10.58-.014.07-.037.14-.057.21l-.003-.277c-.083-3-1.534-8.934-8.87-8.934-3.393 0-8.137 3.054-7.93 8.158-.04 4.778 3.555 8.4 7.95 8.332l.073-.001c1.2-.033 2.763-.429 3.1-1.657.063-.031.26.534.268.598.048.256.112.369.192.34.981-.348 2.286-1.222 1.952-2.38-.176-.61-1.775-.147-1.921-.347.418-.979 2.234-.926 3.153-.716.443.102.657.38 1.012.442.29.052.981-.2.96.242C17.226 19.632 13.833 22 9.918 22 3.654 22 0 16.574 0 11.737 0 5.947 4.959 2 9.917 2zM9.9 5.3c.484 0 1.125.225 1.38.585 3.669.145 4.313 2.686 4.694 5.444.255 1.838.315 2.3.182 1.387l.083.59c.068.448.554.737.982.516.144-.075.254-.231.328-.47a.2.2 0 01.258-.13l.625.22a.2.2 0 01.124.238 2.172 2.172 0 01-.51.92c-.878.917-2.757.664-3.08-.62-.14-.554-.055-.626-.345-1.242-.292-.621-1.238-.709-1.69-.295-.345.315-.407.805-.406 1.282L12.6 15.9a.9.9 0 01-.9.9h-1.4a.9.9 0 01-.9-.9v-.65a1.15 1.15 0 10-2.3 0v.65a.9.9 0 01-.9.9H4.8a.9.9 0 01-.9-.9l.035-3.239c.012-1.884.356-3.658 2.47-4.134.2-.045.252.13.29.342.025.154.043.252.053.294.701 3.058 1.75 4.299 3.144 3.722l.66-.331.254-.13c.158-.082.25-.131.276-.15.012-.01-.165-.206-.407-.464l-1.012-1.067a8.925 8.925 0 01-.199-.216c-.047-.034-.116.068-.208.306-.074.157-.251.252-.272.326-.013.058.108.298.362.72.164.288.22.508-.31.343-1.04-.8-1.518-2.273-1.684-3.725-.004-.035-.162-1.913-.162-1.913a1.2 1.2 0 011.113-1.281L9.9 5.3z"/></svg>`,
        other: `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`
    };

    state.models.forEach(m => {
        const lower = m.toLowerCase();
        if (lower.includes('claude')) {
            groups['Claude'].models.push(m);
        } else if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) {
            groups['GPT'].models.push(m);
        } else if (lower.includes('gemini')) {
            groups['Gemini'].models.push(m);
        } else if (lower.includes('glm')) {
            groups['GLM'].models.push(m);
        } else {
            groups['其他'].models.push(m);
        }
    });

    let html = '';
    for (const [groupName, groupData] of Object.entries(groups)) {
        if (groupData.models.length > 0) {
            const isCurrentGroup = groupData.models.includes(state.currentModel);
            html += `
                <div class="model-group ${isCurrentGroup ? 'expanded' : ''}" data-group="${groupName}">
                    <div class="model-group-header">
                        <div class="model-group-title">
                            <span class="group-icon ${groupData.icon}">${groupIcons[groupData.icon]}</span>
                            <span>${groupName}</span>
                            <span class="model-group-count">${groupData.models.length}</span>
                        </div>
                        <svg class="model-group-arrow" viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                        </svg>
                    </div>
                    <div class="model-group-items">
                        ${groupData.models.map(m => `
                            <div class="model-item ${m === state.currentModel ? 'active' : ''}" data-model="${m}">
                                <span>${m}</span>
                                <svg class="model-item-check" viewBox="0 0 24 24" width="16" height="16">
                                    <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                </svg>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    if (modelDropdownContent) {
        modelDropdownContent.innerHTML = html;
        bindModelDropdownEvents();
    }

    // 更新显示
    updateModelDisplay();

    if (!state.currentModel && state.models.length > 0) {
        state.currentModel = state.models[0];
        localStorage.setItem('currentModel', state.currentModel);
        updateModelDisplay();
    }
}

function updateModelDisplay() {
    if (modelDisplay) {
        modelDisplay.textContent = state.currentModel || '选择模型';
    }
}

function toggleModelDropdown() {
    if (modelSelector) {
        modelSelector.classList.toggle('open');
    }
}

function closeModelDropdown() {
    if (modelSelector) {
        modelSelector.classList.remove('open');
    }
}

function selectModel(model) {
    state.currentModel = model;
    localStorage.setItem('currentModel', state.currentModel);
    updateModelDisplay();

    // 更新选中状态
    if (modelDropdownContent) {
        modelDropdownContent.querySelectorAll('.model-item').forEach(item => {
            item.classList.toggle('active', item.dataset.model === model);
        });
    }

    closeModelDropdown();
}

function bindModelDropdownEvents() {
    if (!modelDropdownContent) return;

    // 分组展开/收起
    modelDropdownContent.querySelectorAll('.model-group-header').forEach(header => {
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            const group = header.closest('.model-group');
            group.classList.toggle('expanded');
        });
    });

    // 模型选择
    modelDropdownContent.querySelectorAll('.model-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectModel(item.dataset.model);
        });
    });
}

// 模型选择器事件
if (modelTrigger) {
    modelTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleModelDropdown();
    });
}

// 点击外部关闭下拉菜单
document.addEventListener('click', (e) => {
    if (modelSelector && !modelSelector.contains(e.target)) {
        closeModelDropdown();
    }
});

// ============ 对话管理 ============
function createConversation() {
    const conv = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [],
        model: state.currentModel,
        createdAt: new Date().toISOString()
    };
    state.conversations.unshift(conv);
    saveConversations();
    return conv;
}

function saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(state.conversations));
}

function getDateGroup(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (date >= today) return '今天';
    if (date >= yesterday) return '昨天';
    if (date >= weekAgo) return '最近7天';
    return '更早';
}

function filterConversations() {
    if (!state.searchQuery) return state.conversations;
    const query = state.searchQuery.toLowerCase();
    return state.conversations.filter(conv =>
        conv.title.toLowerCase().includes(query) ||
        conv.messages.some(m => m.content.toLowerCase().includes(query))
    );
}

function renderConversations() {
    const filtered = filterConversations();

    // 按日期分组
    const groups = {};
    filtered.forEach(conv => {
        const group = getDateGroup(conv.createdAt);
        if (!groups[group]) groups[group] = [];
        groups[group].push(conv);
    });

    const groupOrder = ['今天', '昨天', '最近7天', '更早'];
    let html = '';

    groupOrder.forEach(groupName => {
        if (groups[groupName] && groups[groupName].length > 0) {
            html += `<div class="conversation-group">
                <div class="conversation-group-title">${groupName}</div>`;
            html += groups[groupName].map(conv => `
                <div class="conversation-item ${conv.id === state.currentConversationId ? 'active' : ''}"
                     data-id="${conv.id}">
                    <span class="title">${escapeHtml(conv.title)}</span>
                    <div class="conv-actions">
                        <button class="rename-btn" data-id="${conv.id}" title="重命名">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                        <button class="delete-btn" data-id="${conv.id}" title="删除">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
            html += '</div>';
        }
    });

    conversationList.innerHTML = html;

    // 绑定点击事件
    conversationList.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.conv-actions')) {
                selectConversation(item.dataset.id);
            }
        });
    });

    conversationList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversation(btn.dataset.id);
        });
    });

    conversationList.querySelectorAll('.rename-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            startRename(btn.dataset.id);
        });
    });
}

function startRename(id) {
    const item = conversationList.querySelector(`.conversation-item[data-id="${id}"]`);
    const titleSpan = item.querySelector('.title');
    const conv = state.conversations.find(c => c.id === id);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-input';
    input.value = conv.title;

    titleSpan.replaceWith(input);
    input.focus();
    input.select();

    const finishRename = () => {
        const newTitle = input.value.trim() || '新对话';
        conv.title = newTitle;
        saveConversations();
        renderConversations();
    };

    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            renderConversations();
        }
    });
}

function selectConversation(id) {
    state.currentConversationId = id;
    const conv = state.conversations.find(c => c.id === id);
    if (conv) {
        renderMessages(conv.messages);
        if (conv.model && state.models.includes(conv.model)) {
            state.currentModel = conv.model;
            modelSelect.value = conv.model;
        }
    }
    renderConversations();
}

function deleteConversation(id) {
    state.conversations = state.conversations.filter(c => c.id !== id);
    saveConversations();
    if (state.currentConversationId === id) {
        state.currentConversationId = null;
        renderWelcome();
    }
    renderConversations();
}

newChatBtn.addEventListener('click', () => {
    state.currentConversationId = null;
    renderWelcome();
    renderConversations();
    chatInput.focus();
});

// ============ 消息渲染 ============
function renderWelcome() {
    chatMessages.innerHTML = `
        <div class="welcome-message">
            <h2>开始新对话</h2>
            <p>选择一个模型，输入你的问题</p>
        </div>
    `;
}

function renderMessages(messages) {
    if (messages.length === 0) {
        renderWelcome();
        return;
    }

    chatMessages.innerHTML = messages.map(msg => {
        const content = typeof msg.content === 'string' ? renderMarkdown(msg.content) : formatMessageWithImages(msg.content);
        return `
            <div class="message ${msg.role}">
                <div class="message-avatar">${msg.role === 'user' ? getUserInitial() : 'AI'}</div>
                <div class="message-body">
                    <div class="message-role">${msg.role === 'user' ? '用户' : 'AI'}</div>
                    <div class="message-content">${content}</div>
                </div>
            </div>
        `;
    }).join('');

    scrollToBottom();
    highlightCode();
    addCopyButtons();
}

function appendMessage(role, content) {
    const welcome = chatMessages.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = `
        <div class="message-avatar">${role === 'user' ? getUserInitial() : 'AI'}</div>
        <div class="message-body">
            <div class="message-role">${role === 'user' ? '用户' : 'AI'}</div>
            <div class="message-content">${renderMarkdown(content)}</div>
        </div>
    `;
    chatMessages.appendChild(div);
    scrollToBottom();
    highlightCode();
    addCopyButtons();
    return div;
}

function appendTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = 'typing-message';
    div.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-body">
            <div class="message-role">AI</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    chatMessages.appendChild(div);
    scrollToBottom();
    return div;
}

function updateStreamingMessage(content) {
    const msg = document.getElementById('typing-message');
    if (msg) {
        msg.querySelector('.message-content').innerHTML = renderMarkdown(content);
        scrollToBottom();
        highlightCode();
    }
}

function finalizeStreamingMessage() {
    const msg = document.getElementById('typing-message');
    if (msg) {
        msg.removeAttribute('id');
        addCopyButtons();
    }
}

// ============ 发送消息 ============
async function sendMessage() {
    const content = chatInput.value.trim();
    if ((!content && state.selectedImages.length === 0) || state.isStreaming) return;

    // 获取或创建对话
    let conv;
    if (state.currentConversationId) {
        conv = state.conversations.find(c => c.id === state.currentConversationId);
    }
    if (!conv) {
        conv = createConversation();
        state.currentConversationId = conv.id;
    }

    // 构建消息内容（支持图片）
    let messageContent;
    if (state.selectedImages.length > 0) {
        messageContent = [
            { type: 'text', text: content || '请分析这些图片' }
        ];
        for (const img of state.selectedImages) {
            messageContent.push({
                type: 'image_url',
                image_url: { url: img }
            });
        }
    } else {
        messageContent = content;
    }

    // 添加用户消息
    conv.messages.push({ role: 'user', content: messageContent });
    appendMessage('user', typeof messageContent === 'string' ? messageContent : formatMessageWithImages(messageContent));
    chatInput.value = '';
    autoResizeInput();

    // 清除图片预览
    clearImagePreviews();

    // 更新标题
    if (conv.messages.length === 1) {
        conv.title = (typeof messageContent === 'string' ? messageContent : content || '图片对话').slice(0, 30) + (content.length > 30 ? '...' : '');
        conv.model = state.currentModel;
    }
    saveConversations();
    renderConversations();

    // 发送请求
    state.isStreaming = true;
    state.abortController = new AbortController();
    sendBtn.disabled = true;
    stopBtn.classList.remove('hidden');
    appendTypingIndicator();

    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: state.currentModel,
                messages: conv.messages.map(m => ({ role: m.role, content: m.content })),
                stream: true
            }),
            signal: state.abortController.signal
        });

        if (!resp.ok) {
            throw new Error('请求失败');
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices?.[0]?.delta?.content;
                        if (delta) {
                            assistantContent += delta;
                            updateStreamingMessage(assistantContent);
                        }
                    } catch (e) {}
                }
            }
        }

        // 保存助手消息
        if (assistantContent) {
            conv.messages.push({ role: 'assistant', content: assistantContent });
            saveConversations();
        }

    } catch (e) {
        if (e.name === 'AbortError') {
            showToast('已停止生成');
        } else {
            console.error('发送失败:', e);
            updateStreamingMessage('抱歉，发生了错误，请重试。');
        }
    } finally {
        state.isStreaming = false;
        state.abortController = null;
        sendBtn.disabled = false;
        stopBtn.classList.add('hidden');
        finalizeStreamingMessage();
    }
}

function stopGeneration() {
    if (state.abortController) {
        state.abortController.abort();
    }
}

sendBtn.addEventListener('click', sendMessage);
stopBtn.addEventListener('click', stopGeneration);

let isComposing = false;
chatInput.addEventListener('compositionstart', () => { isComposing = true; });
chatInput.addEventListener('compositionend', () => { isComposing = false; });

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
        e.preventDefault();
        sendMessage();
    }
});

// ============ 搜索对话 ============
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderConversations();
    });
}

// ============ 快捷提示 ============
if (quickPrompts) {
    quickPrompts.addEventListener('click', (e) => {
        const btn = e.target.closest('.quick-prompt');
        if (btn) {
            const prompt = btn.dataset.prompt;
            if (prompt) {
                chatInput.value = prompt;
                chatInput.focus();
                autoResizeInput();
            }
        }
    });
}

// ============ 键盘快捷键 ============
document.addEventListener('keydown', (e) => {
    // Esc 停止生成
    if (e.key === 'Escape' && state.isStreaming) {
        stopGeneration();
    }
    // Ctrl/Cmd + N 新对话
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newChatBtn.click();
    }
});

// ============ Toast 通知 ============
function showToast(message, duration = 2000) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// ============ 工具函数 ============
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderMarkdown(text) {
    marked.setOptions({
        breaks: true,
        gfm: true
    });
    return marked.parse(text);
}

function highlightCode() {
    document.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
    });
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function autoResizeInput() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
}

// ============ 图片处理 ============
function formatMessageWithImages(content) {
    if (typeof content === 'string') return content;

    let html = '';
    for (const item of content) {
        if (item.type === 'text') {
            html += `<p>${escapeHtml(item.text)}</p>`;
        } else if (item.type === 'image_url') {
            html += `<img src="${item.image_url.url}" style="max-width: 300px; border-radius: 8px; margin: 8px 0;" />`;
        }
    }
    return html;
}

function clearImagePreviews() {
    state.selectedImages = [];
    imagePreviewContainer.innerHTML = '';
    imagePreviewContainer.classList.add('hidden');
    imageInput.value = '';
}

function renderImagePreviews() {
    if (state.selectedImages.length === 0) {
        imagePreviewContainer.classList.add('hidden');
        return;
    }

    imagePreviewContainer.classList.remove('hidden');
    imagePreviewContainer.innerHTML = state.selectedImages.map((img, index) => `
        <div class="image-preview-item">
            <img src="${img}" alt="Preview ${index + 1}">
            <button class="image-preview-remove" data-index="${index}">×</button>
        </div>
    `).join('');

    // 绑定删除按钮事件
    imagePreviewContainer.querySelectorAll('.image-preview-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            state.selectedImages.splice(index, 1);
            renderImagePreviews();
        });
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 图片上传按钮事件
if (imageBtn && imageInput) {
    imageBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                showToast('只能上传图片文件');
                continue;
            }

            if (file.size > 10 * 1024 * 1024) {
                showToast('图片大小不能超过 10MB');
                continue;
            }

            try {
                const base64 = await fileToBase64(file);
                state.selectedImages.push(base64);
            } catch (e) {
                console.error('读取图片失败:', e);
                showToast('读取图片失败');
            }
        }

        renderImagePreviews();
    });
}

// 支持粘贴图片
chatInput.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;

            if (file.size > 10 * 1024 * 1024) {
                showToast('图片大小不能超过 10MB');
                continue;
            }

            try {
                const base64 = await fileToBase64(file);
                state.selectedImages.push(base64);
                renderImagePreviews();
                showToast('图片已添加');
            } catch (e) {
                console.error('读取图片失败:', e);
                showToast('读取图片失败');
            }
        }
    }
});

chatInput.addEventListener('input', autoResizeInput);

// ============ 主题切换 ============
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    updateCodeTheme(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
    updateCodeTheme(next);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        if (theme === 'light') {
            icon.innerHTML = '<path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>';
        } else {
            icon.innerHTML = '<path fill="currentColor" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>';
        }
    }
}

function updateCodeTheme(theme) {
    const link = document.getElementById('hljs-theme');
    if (link) {
        if (theme === 'light') {
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        } else {
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
        }
    }
}

themeBtn.addEventListener('click', toggleTheme);

// ============ 移动端菜单 ============
function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('open');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
}

menuBtn.addEventListener('click', openSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// ============ 代码复制按钮 ============
function addCopyButtons() {
    document.querySelectorAll('pre code').forEach(block => {
        const pre = block.parentElement;
        if (pre.querySelector('.copy-btn')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = '复制';
        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(block.textContent);
                btn.textContent = '已复制';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = '复制';
                    btn.classList.remove('copied');
                }, 2000);
            } catch (e) {
                btn.textContent = '失败';
            }
        });
        wrapper.appendChild(btn);
    });
}

// ============ 工具函数 ============
function getUserInitial() {
    return state.username ? state.username.charAt(0).toUpperCase() : 'U';
}

// ============ 管理面板 ============
if (adminBtn) {
    adminBtn.addEventListener('click', showAdminPage);
}

if (adminCloseBtn) {
    adminCloseBtn.addEventListener('click', showChatPage);
}

// 管理面板标签切换
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.dataset.tab;
        document.querySelectorAll('.admin-panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        document.getElementById(`panel-${tabName}`).classList.remove('hidden');
    });
});

// 加载邀请码列表
async function loadInviteCodes() {
    try {
        const resp = await fetch('/api/admin/invite-codes', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resp.ok) {
            const data = await resp.json();
            renderInviteCodes(data.codes);
        }
    } catch (e) {
        console.error('加载邀请码失败:', e);
    }
}

function renderInviteCodes(codes) {
    if (!inviteCodesList) return;

    if (codes.length === 0) {
        inviteCodesList.innerHTML = '<div class="admin-empty">暂无邀请码</div>';
        return;
    }

    inviteCodesList.innerHTML = codes.map(code => `
        <div class="admin-item ${code.used_by ? 'used' : ''}">
            <div class="admin-item-main">
                <span class="invite-code">${code.code}</span>
                <span class="admin-item-status ${code.used_by ? 'status-used' : 'status-available'}">
                    ${code.used_by ? '已使用' : '可用'}
                </span>
            </div>
            <div class="admin-item-meta">
                <span>创建者: ${code.created_by}</span>
                <span>${formatDate(code.created_at)}</span>
                ${code.used_by ? `<span>使用者: ${code.used_by}</span>` : ''}
            </div>
            ${!code.used_by ? `
                <div class="admin-item-actions">
                    <button class="copy-code-btn" data-code="${code.code}" title="复制">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                    </button>
                    <button class="delete-code-btn" data-code="${code.code}" title="删除">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');

    // 绑定复制按钮
    inviteCodesList.querySelectorAll('.copy-code-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(btn.dataset.code);
                showToast('已复制邀请码');
            } catch (e) {
                showToast('复制失败');
            }
        });
    });

    // 绑定删除按钮
    inviteCodesList.querySelectorAll('.delete-code-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteInviteCode(btn.dataset.code));
    });
}

// 创建邀请码
if (createInviteCodeBtn) {
    createInviteCodeBtn.addEventListener('click', async () => {
        try {
            const resp = await fetch('/api/admin/invite-codes', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                showToast(`邀请码已创建: ${data.code}`);
                loadInviteCodes();
            } else {
                const err = await resp.json();
                showToast(err.detail || '创建失败');
            }
        } catch (e) {
            showToast('创建失败');
        }
    });
}

// 删除邀请码
async function deleteInviteCode(code) {
    if (!confirm('确定要删除这个邀请码吗？')) return;

    try {
        const resp = await fetch(`/api/admin/invite-codes/${code}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resp.ok) {
            showToast('删除成功');
            loadInviteCodes();
        } else {
            const err = await resp.json();
            showToast(err.detail || '删除失败');
        }
    } catch (e) {
        showToast('删除失败');
    }
}

// 加载用户列表
async function loadUsers() {
    try {
        const resp = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resp.ok) {
            const data = await resp.json();
            renderUsers(data.users);
        }
    } catch (e) {
        console.error('加载用户失败:', e);
    }
}

function renderUsers(users) {
    if (!usersList) return;

    if (users.length === 0) {
        usersList.innerHTML = '<div class="admin-empty">暂无用户</div>';
        return;
    }

    usersList.innerHTML = users.map(user => `
        <div class="admin-item">
            <div class="admin-item-main">
                <span class="user-name">
                    <span class="user-avatar-small">${user.username.charAt(0).toUpperCase()}</span>
                    ${user.username}
                </span>
                ${user.is_admin ? '<span class="admin-badge">管理员</span>' : ''}
            </div>
            <div class="admin-item-meta">
                <span>注册时间: ${formatDate(user.created_at)}</span>
                ${user.invite_code_used ? `<span>邀请码: ${user.invite_code_used}</span>` : '<span>初始用户</span>'}
            </div>
            ${!user.is_admin && user.username !== state.username ? `
                <div class="admin-item-actions">
                    <button class="delete-user-btn" data-username="${user.username}" title="删除">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');

    // 绑定删除按钮
    usersList.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteUser(btn.dataset.username));
    });
}

// 删除用户
async function deleteUser(username) {
    if (!confirm(`确定要删除用户 "${username}" 吗？`)) return;

    try {
        const resp = await fetch(`/api/admin/users/${username}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resp.ok) {
            showToast('删除成功');
            loadUsers();
        } else {
            const err = await resp.json();
            showToast(err.detail || '删除失败');
        }
    } catch (e) {
        showToast('删除失败');
    }
}

// 格式化日期
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============ API设置 ============
async function loadSettings() {
    try {
        const resp = await fetch('/api/admin/settings', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resp.ok) {
            const data = await resp.json();
            if (settingsApiUrl) settingsApiUrl.value = data.api_base_url || '';
            if (settingsApiKey) settingsApiKey.value = '';
            if (settingsApiKey) settingsApiKey.placeholder = '输入新密钥或留空保持不变';
            if (apiKeyMasked) apiKeyMasked.textContent = data.api_key_masked || '未设置';
        }
    } catch (e) {
        console.error('加载设置失败:', e);
    }
}

// 切换API Key显示/隐藏
if (toggleApiKeyBtn && settingsApiKey) {
    toggleApiKeyBtn.addEventListener('click', () => {
        const isPassword = settingsApiKey.type === 'password';
        settingsApiKey.type = isPassword ? 'text' : 'password';
        toggleApiKeyBtn.title = isPassword ? '隐藏' : '显示';
    });
}

// 测试API连接
if (testSettingsBtn) {
    testSettingsBtn.addEventListener('click', async () => {
        const apiUrl = settingsApiUrl?.value?.trim();
        const apiKey = settingsApiKey?.value?.trim();

        if (!apiUrl) {
            showSettingsMessage('请输入API URL', 'error');
            return;
        }

        // 如果没有输入新密钥，需要提示
        if (!apiKey) {
            showSettingsMessage('测试连接需要输入API Key', 'error');
            return;
        }

        testSettingsBtn.disabled = true;
        testSettingsBtn.innerHTML = `
            <svg class="spin" viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
            </svg>
            测试中...
        `;

        try {
            const resp = await fetch('/api/admin/settings/test', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api_base_url: apiUrl,
                    api_key: apiKey
                })
            });
            const data = await resp.json();
            showSettingsMessage(data.message, data.success ? 'success' : 'error');
        } catch (e) {
            showSettingsMessage('测试失败: ' + e.message, 'error');
        } finally {
            testSettingsBtn.disabled = false;
            testSettingsBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                测试连接
            `;
        }
    });
}

// 保存设置
if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const apiUrl = settingsApiUrl?.value?.trim();
        const apiKey = settingsApiKey?.value?.trim();

        if (!apiUrl) {
            showSettingsMessage('请输入API URL', 'error');
            return;
        }

        if (!apiKey) {
            showSettingsMessage('请输入API Key', 'error');
            return;
        }

        try {
            const resp = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api_base_url: apiUrl,
                    api_key: apiKey
                })
            });

            if (resp.ok) {
                showSettingsMessage('设置已保存', 'success');
                // 重新加载设置以更新masked key显示
                loadSettings();
                // 清空密钥输入框
                if (settingsApiKey) settingsApiKey.value = '';
            } else {
                const err = await resp.json();
                showSettingsMessage(err.detail || '保存失败', 'error');
            }
        } catch (e) {
            showSettingsMessage('保存失败: ' + e.message, 'error');
        }
    });
}

function showSettingsMessage(message, type) {
    if (!settingsMessage) return;
    settingsMessage.textContent = message;
    settingsMessage.className = `settings-message ${type}`;
    // 3秒后清除消息
    setTimeout(() => {
        settingsMessage.textContent = '';
        settingsMessage.className = 'settings-message';
    }, 5000);
}

// ============ 移动端优化 ============
// 防止iOS Safari双击缩放
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

// 移动端键盘弹出时自动滚动到底部
if (state.isMobile && chatInput) {
    chatInput.addEventListener('focus', () => {
        setTimeout(() => {
            scrollToBottom();
        }, 300);
    });
}

// iOS Safari地址栏隐藏优化
if (state.isIOS) {
    // 监听窗口大小变化（键盘弹出/收起）
    let lastHeight = window.innerHeight;
    window.addEventListener('resize', () => {
        const currentHeight = window.innerHeight;
        if (currentHeight < lastHeight) {
            // 键盘弹出
            setTimeout(() => scrollToBottom(), 100);
        }
        lastHeight = currentHeight;
    });
}

// 移动端侧边栏滑动关闭
if (state.isMobile && sidebar && sidebarOverlay) {
    let touchStartX = 0;
    let touchEndX = 0;

    sidebar.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 50) {
            // 向左滑动，关闭侧边栏
            closeSidebar();
        }
    }, { passive: true });
}

// 移动端优化：点击消息区域关闭侧边栏
if (state.isMobile && chatMessages) {
    chatMessages.addEventListener('click', () => {
        if (sidebar && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });
}

// 移动端优化：防止输入框被键盘遮挡
if (state.isMobile && chatInput) {
    chatInput.addEventListener('focus', () => {
        // 延迟执行，等待键盘完全弹出
        setTimeout(() => {
            chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    });
}

// 移动端优化：长按消息复制
if (state.isMobile) {
    document.addEventListener('DOMContentLoaded', () => {
        chatMessages.addEventListener('contextmenu', (e) => {
            const messageContent = e.target.closest('.message-content');
            if (messageContent) {
                e.preventDefault();
                const text = messageContent.textContent;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                        showToast('已复制消息内容');
                    }).catch(() => {
                        showToast('复制失败');
                    });
                }
            }
        });
    });
}

// 移动端优化：下拉刷新禁用（防止误触）
if (state.isMobile) {
    document.body.addEventListener('touchmove', (e) => {
        if (e.target.closest('.chat-messages') && chatMessages.scrollTop === 0) {
            // 在消息区域顶部时，允许滚动
            return;
        }
    }, { passive: true });
}

// 移动端优化：自动隐藏地址栏
if (state.isMobile) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            window.scrollTo(0, 1);
        }, 100);
    });
}

// 移动端优化：优化触摸滚动性能
if (state.isMobile) {
    const scrollElements = [chatMessages, conversationList, modelDropdownContent];
    scrollElements.forEach(el => {
        if (el) {
            el.style.webkitOverflowScrolling = 'touch';
        }
    });
}

// 移动端优化：阻止页面过度滚动
if (state.isMobile) {
    document.body.addEventListener('touchmove', (e) => {
        const target = e.target;
        const scrollable = target.closest('.chat-messages, .conversation-list, .model-dropdown-content, .admin-panel');

        if (!scrollable) {
            e.preventDefault();
        }
    }, { passive: false });
}

// 移动端优化：优化输入框体验
if (state.isMobile && chatInput) {
    // 防止输入时页面缩放
    chatInput.addEventListener('touchstart', (e) => {
        e.stopPropagation();
    }, { passive: true });

    // 输入时自动调整高度
    chatInput.addEventListener('input', () => {
        autoResizeInput();
        if (state.isMobile) {
            // 移动端输入时保持输入框可见
            setTimeout(() => {
                chatInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    });
}

// 移动端优化：优化模型选择器
if (state.isMobile && modelSelector) {
    modelTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleModelDropdown();

        // 移动端打开时滚动到当前选中的模型
        if (modelSelector.classList.contains('open')) {
            setTimeout(() => {
                const activeItem = modelDropdownContent.querySelector('.model-item.active');
                if (activeItem) {
                    activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    });
}

// 移动端优化：优化图片预览
if (state.isMobile && imagePreviewContainer) {
    // 移动端图片预览优化
    imagePreviewContainer.addEventListener('click', (e) => {
        const img = e.target.closest('.image-preview-item img');
        if (img && !e.target.classList.contains('image-preview-remove')) {
            // 可以添加全屏预览功能
            e.preventDefault();
        }
    });
}

// 移动端优化：网络状态监听
if (state.isMobile) {
    window.addEventListener('online', () => {
        showToast('网络已连接');
    });

    window.addEventListener('offline', () => {
        showToast('网络已断开', 3000);
    });
}

// 移动端优化：页面可见性变化处理
if (state.isMobile) {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // 页面隐藏时停止流式输出
            if (state.isStreaming) {
                stopGeneration();
            }
        }
    });
}

// 启动
init();
