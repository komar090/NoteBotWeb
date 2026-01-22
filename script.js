let tg = null;

// -- CONFIGURATION --
// The base URL must be HTTPS to work with Telegram Mini App on GitHub Pages.
// We use sslip.io for a free SSL-compatible hostname for the IP.
const API_BASE_URL = "https://46.149.67.44.sslip.io";
// -------------------

// DEBUG logger
function log(msg) {
    const el = document.getElementById('debugLog');
    if (el) {
        el.innerText += msg + "\n";
    }
    console.log(msg);
}

document.addEventListener('DOMContentLoaded', () => {
    log("🚀 App V15.0 (Mini App Focus)");
    log("Target API: " + API_BASE_URL);

    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        log("TG WebApp Ready");

        // Setup Button
        tg.MainButton.textColor = '#FFFFFF';
        tg.MainButton.color = '#3390ec';
        tg.MainButton.onClick(createTask);
    } else {
        log("⚠️ Telegram WebApp not detected");
    }

    runSelfCheck();
    loadTasks();
});

let taskInput = document.getElementById("taskInput");
let categorySelect = document.getElementById("categorySelect");
let dateInput = document.getElementById("dateInput");
let timeInput = document.getElementById("timeInput");

async function runSelfCheck() {
    const statusText = document.getElementById('apiStatusText');
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        if (data.status === 'ok') {
            statusText.innerText = "ONLINE 🟢";
            statusText.style.color = "#4caf50";
        } else {
            statusText.innerText = "DEGRADED 🟠";
            statusText.style.color = "#ff9800";
            log("Health Check Detail: " + JSON.stringify(data.checks));
        }
    } catch (e) {
        statusText.innerText = "OFFLINE 🔴";
        statusText.style.color = "#f44336";
        log("Health Check Failed: " + e.message);
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById(`view-${viewName}`).classList.add('active');

    const navs = document.querySelectorAll('.nav-item');
    navs.forEach(n => n.classList.remove('active'));

    if (viewName === 'tasks') {
        navs[0].classList.add('active');
        loadTasks();
        tg.MainButton.hide();
    } else if (viewName === 'create') {
        navs[1].classList.add('active');
        tg.MainButton.setText("Создать задачу");
        if (taskInput.value.trim().length > 0) tg.MainButton.show();
    } else if (viewName === 'settings') {
        navs[2].classList.add('active');
        tg.MainButton.hide();
        loadProfile();
        loadSettings();
        loadCategories();
    } else if (viewName === 'admin') {
        const adminNav = document.getElementById('nav-admin');
        if (adminNav) adminNav.classList.add('active');
        tg.MainButton.hide();
        // loadAdminStats();
    }
}

// -- API CALLS --

async function loadTasks() {
    const list = document.getElementById('taskList');
    const count = document.getElementById('taskCount');

    if (!tg || !tg.initData) {
        list.innerHTML = `<div style="padding:20px; text-align:center; opacity:0.5;">Waiting for Telegram...</div>`;
        return;
    }

    try {
        const url = `${API_BASE_URL}/api/tasks?initData=${encodeURIComponent(tg.initData)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const tasks = await response.json();
        list.innerHTML = '';
        count.innerText = tasks.length;

        if (tasks.length === 0) {
            list.innerHTML = `<div style="padding:20px; text-align:center; opacity:0.5;">Нет задач 🎉</div>`;
            return;
        }

        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <div class="task-checkbox" onclick="completeTask(${task.id}, this)"></div>
                <div class="task-content">
                    <div class="task-text">${escapeHtml(task.text)}</div>
                    <div class="task-meta"><span class="badge">${task.category}</span></div>
                </div>
                <div onclick="deleteTask(${task.id})" style="opacity:0.5; padding:5px;">🗑</div>
            `;
            list.appendChild(item);
        });
        updateProgress(tasks.length);
    } catch (e) {
        log("Load Tasks Error: " + e.message);
        list.innerHTML = `<div style="padding:20px; text-align:center; color:#ff5252;">Fail: ${e.message}</div>`;
    }
}

async function completeTask(id, checkboxEl) {
    if (checkboxEl.classList.contains('checked')) return;
    checkboxEl.classList.add('checked');
    const textEl = checkboxEl.parentElement.querySelector('.task-text');
    textEl.style.textDecoration = 'line-through';
    textEl.style.opacity = '0.5';

    try {
        await fetch(`${API_BASE_URL}/api/tasks/${id}/done?initData=${encodeURIComponent(tg.initData)}`, { method: 'POST' });
    } catch (e) { alert("Ошибка сети"); }
}

async function deleteTask(id) {
    if (!confirm("Удалить задачу?")) return;
    try {
        await fetch(`${API_BASE_URL}/api/tasks/${id}?initData=${encodeURIComponent(tg.initData)}`, { method: 'DELETE' });
        loadTasks();
    } catch (e) { alert("Ошибка удаления: " + e.message); }
}

async function createTask() {
    const data = {
        user_id: tg.initDataUnsafe.user?.id || 0,
        text: taskInput.value,
        category: categorySelect.value,
        date: dateInput.value || null,
        time: timeInput.value || null
    };

    try {
        const url = `${API_BASE_URL}/api/tasks?initData=${encodeURIComponent(tg.initData)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            taskInput.value = '';
            tg.MainButton.hide();
            switchView('tasks');
        }
    } catch (e) { alert("Ошибка создания: " + e.message); }
}

// -- SETTINGS & CATEGORIES --

async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/me?initData=${encodeURIComponent(tg.initData)}`);
        if (response.ok) {
            const user = await response.json();
            document.getElementById('profileName').innerText = user.first_name;
            document.getElementById('profileStatus').innerText = user.is_admin ? "👑 Admin" : "User";

            if (user.is_admin && !document.getElementById('nav-admin')) {
                const navbar = document.querySelector('.navbar');
                const adminBtn = document.createElement('a');
                adminBtn.href = "#"; adminBtn.className = "nav-item"; adminBtn.id = "nav-admin";
                adminBtn.onclick = () => switchView('admin');
                adminBtn.innerHTML = '<ion-icon name="flash-outline" style="color: #ffcc00;"></ion-icon>';
                navbar.appendChild(adminBtn);
            }
        }
    } catch (e) { console.error("Profile load failed", e); }
}

async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/settings?initData=${encodeURIComponent(tg.initData)}`);
        if (response.ok) {
            const settings = await response.json();
            document.getElementById('tzSelect').value = settings.timezone;
        }
    } catch (e) { console.error("Settings load failed", e); }
}

async function updateTimezone() {
    const tz = document.getElementById('tzSelect').value;
    const body = new URLSearchParams({ timezone: tz });
    try {
        await fetch(`${API_BASE_URL}/api/settings/timezone?initData=${encodeURIComponent(tg.initData)}`, {
            method: 'POST',
            body: body
        });
        tg.showPopup({ message: "Часовой пояс обновлен!" });
    } catch (e) { alert("Ошибка обновления!"); }
}

async function loadCategories() {
    const list = document.getElementById('categoryList');
    const select = document.getElementById('categorySelect');
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories?initData=${encodeURIComponent(tg.initData)}`);
        const cats = await response.json();

        // Update Select in Create Task
        select.innerHTML = '<option value="Работа">💼 Работа</option><option value="Личное">🏠 Личное</option><option value="Покупки">🛒 Покупки</option>';
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.innerText = "📂 " + c;
            select.appendChild(opt);
        });

        // Update List in Settings
        list.innerHTML = '';
        cats.forEach(c => {
            const item = document.createElement('div');
            item.style = "display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);";
            item.innerHTML = `<span>${c}</span> <span onclick="deleteCategory('${c}')" style="color:#ff5252; cursor:pointer;">Удалить</span>`;
            list.appendChild(item);
        });
    } catch (e) { console.error("Cats load failed", e); }
}

async function addNewCategory() {
    const input = document.getElementById('newCatInput');
    const name = input.value.trim();
    if (!name) return;
    const body = new URLSearchParams({ name: name });
    try {
        await fetch(`${API_BASE_URL}/api/categories?initData=${encodeURIComponent(tg.initData)}`, { method: 'POST', body: body });
        input.value = '';
        loadCategories();
    } catch (e) { alert("Ошибка добавления"); }
}

async function deleteCategory(name) {
    if (!confirm(`Удалить категорию "${name}"?`)) return;
    try {
        await fetch(`${API_BASE_URL}/api/categories/${encodeURIComponent(name)}?initData=${encodeURIComponent(tg.initData)}`, { method: 'DELETE' });
        loadCategories();
    } catch (e) { alert("Ошибка удаления"); }
}

// -- UI HELPERS --

function updateProgress(count) {
    const bar = document.getElementById('progressBar');
    let pct = Math.min((count / 10) * 100, 100);
    bar.style.width = pct + '%';
}

function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

taskInput.addEventListener('input', () => {
    if (taskInput.value.trim().length > 0) tg.MainButton.show();
    else tg.MainButton.hide();
});
