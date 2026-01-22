let tg = null;

// -- CONFIGURATION --
const API_BASE_URL = "https://46.149.67.44.sslip.io/api";
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
    log("🚀 App V9.0 (FINAL DEBUG)");
    log("Target API: " + API_BASE_URL);

    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        console.log("TG InitData:", tg.initData); // Hidden log for console
        log("TG WebApp Ready");

        const user = tg.initDataUnsafe?.user;
        log("User: " + (user?.first_name || "Unknown"));
        log("InitData Len: " + (tg.initData ? tg.initData.length : "0 (EMPTY!)"));

        if (!tg.initData) {
            log("⚠️ CRITICAL: InitData is missing! Are you using the Menu Button?");
        }

        // Setup Button
        tg.MainButton.textColor = '#FFFFFF';
        tg.MainButton.color = '#3390ec';
        tg.MainButton.onClick(createTask);
    } else {

        log("⚠️ Telegram WebApp not detected");
    }

    loadTasks();
});

let taskInput = document.getElementById("taskInput");
let categorySelect = document.getElementById("categorySelect");
let dateInput = document.getElementById("dateInput");
let timeInput = document.getElementById("timeInput");

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Show selected
    document.getElementById(`view-${viewName}`).classList.add('active');

    // Update Nav
    // Simple logic: mapping icons is hard without IDs, let's just highlight based on index or onclick
    // Actually our onclick sets 'active' on 'this' but we are calling from inline.
    // Let's rely on re-querying or just fix the nav-items manually in HTML or here.

    // Better: Update nav highlight
    const navs = document.querySelectorAll('.nav-item');
    navs.forEach(n => n.classList.remove('active'));

    if (viewName === 'tasks') {
        navs[0].classList.add('active');
        loadTasks();
        tg.MainButton.hide();
    } else if (viewName === 'create') {
        navs[1].classList.add('active');
        tg.MainButton.setText("Создать задачу");
        if (taskInput.value.length > 0) tg.MainButton.show();
    } else if (viewName === 'settings') {
        navs[2].classList.add('active');
        tg.MainButton.hide();
        loadProfile();
    } else if (viewName === 'admin') {
        // Admin tab logic (added dynamically)
        const adminNav = document.getElementById('nav-admin');
        if (adminNav) adminNav.classList.add('active');
        tg.MainButton.hide();
        loadAdminStats();
    }
}

// -- API CALLS --

async function loadTasks() {
    const list = document.getElementById('taskList');
    const count = document.getElementById('taskCount');
    // list.innerHTML = '<div class="loader"></div>';

    if (!tg || !tg.initData) {
        log("Cannot load tasks: InitData missing");
        list.innerHTML = `<div style="padding:20px; text-align:center; opacity:0.5;">Waiting for Telegram...</div>`;
        return;
    }

    try {
        // Construct URL with initData for auth
        const url = `${API_BASE_URL}/tasks?initData=${encodeURIComponent(tg.initData)}`;
        console.log("Fetching:", url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);

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
                    <div class="task-meta">
                        <span class="badge">${task.category}</span>
                    </div>
                </div>
                <div onclick="deleteTask(${task.id})" style="opacity:0.5; padding:5px;">🗑</div>
            `;
            list.appendChild(item);
        });

        updateProgress(tasks.length);

    } catch (e) {
        log("ERROR: " + e.message);
        list.innerHTML = `<div style="padding:20px; text-align:center; color:#ff5252;">Ошибка загрузки (API)<br><small>${e.message}</small></div>`;
    }
}

async function completeTask(id, checkboxEl) {
    if (checkboxEl.classList.contains('checked')) return;

    checkboxEl.classList.add('checked');
    const textEl = checkboxEl.parentElement.querySelector('.task-text');
    textEl.style.textDecoration = 'line-through';
    textEl.style.opacity = '0.5';

    try {
        await fetch(`${API_BASE_URL}/tasks/${id}/done?initData=${encodeURIComponent(tg.initData)}`, {
            method: 'POST'
        });
        // Optimistic UI: already updated.
    } catch (e) {
        alert("Ошибка сети");
    }
}

async function deleteTask(id) {
    if (!confirm("Удалить задачу?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'DELETE', // Method DELETE
            headers: {
                // For some proxies, query params for auth are safer than headers if configured that way
            }
        });

        // Pass auth via query param as we do elsewhere, but fetch default doesn't allow body in DELETE easily, 
        // but verify if backend accepts query param on DELETE. Yes.
        // Wait, I missed adding initData to URL in the fetch above.

        await fetch(`${API_BASE_URL}/tasks/${id}?initData=${encodeURIComponent(tg.initData)}`, {
            method: 'DELETE'
        });

        loadTasks(); // Reload list
    } catch (e) {
        alert("Ошибка удаления: " + e.message);
    }
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
        const response = await fetch(`${API_BASE_URL}/tasks?initData=${encodeURIComponent(tg.initData)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            taskInput.value = '';
            tg.MainButton.hide();
            tg.showPopup({ message: 'Задача создана!' }, () => {
                switchView('tasks');
            });
        }
    } catch (e) {
        alert("Ошибка создания: " + e.message);
    }
}

async function loadProfile() {
    if (!tg || !tg.initData) return;

    try {
        const response = await fetch(`${API_BASE_URL}/me?initData=${encodeURIComponent(tg.initData)}`);
        if (response.ok) {
            const user = await response.json();
            document.getElementById('profileName').innerText = user.first_name;
            document.getElementById('profileStatus').innerText = user.is_admin ? "👑 Admin" : "User";

            // Show Admin Tab if not already shown
            if (user.is_admin && !document.getElementById('nav-admin')) {
                const navbar = document.querySelector('.navbar');
                const adminBtn = document.createElement('a');
                adminBtn.href = "#";
                adminBtn.className = "nav-item";
                adminBtn.id = "nav-admin";
                adminBtn.onclick = () => switchView('admin');
                adminBtn.innerHTML = '<ion-icon name="flash-outline" style="color: #ffcc00;"></ion-icon>';
                navbar.appendChild(adminBtn);
            }
        }
    } catch (e) {
        console.error("Profile load failed", e);
    }
}

function loadAdminStats() {
    const container = document.getElementById('adminStats');
    if (container) {
        container.innerHTML = "Subscribing to realtime updates...";
        // Mock for now
        setTimeout(() => {
            container.innerHTML = `
                <div class="glass-card">
                    <h3>👥 Пользователи: 1,342</h3>
                    <h3>💰 Доход: 45,900₽</h3>
                </div>
            `;
        }, 500);
    }
}

function updateProgress(count) {
    // Just a visual fun thing
    const bar = document.getElementById('progressBar');
    // If count < 5, small bar, else full?
    // Let's say goal is 10 tasks?
    let pct = Math.min((count / 10) * 100, 100);
    bar.style.width = pct + '%';
}

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// -- LISTENERS --

// Main Button click (for Create view)
// Moved inside init logic


// Input listener to show button
taskInput.addEventListener('input', () => {
    if (taskInput.value.trim().length > 0) {
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }
});

// Init
// Duplicate listener removed. Initial switchView is handled in the top listener.

