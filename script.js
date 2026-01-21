let tg = window.Telegram.WebApp;
tg.expand();
tg.MainButton.textColor = '#FFFFFF';
tg.MainButton.color = '#3390ec';

// -- CONFIGURATION --
// Replace this with your VPS URL (Must be HTTPS for production!)
// For testing locally or via ngrok, use that URL.
const API_BASE_URL = "https://70c61aed1af41199-94-131-14-111.serveousercontent.com/api";
// -------------------

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
    }
}

// -- API CALLS --

async function loadTasks() {
    const list = document.getElementById('taskList');
    const count = document.getElementById('taskCount');
    // list.innerHTML = '<div class="loader"></div>';

    try {
        // Construct URL with initData for auth
        const url = `${API_BASE_URL}/tasks?initData=${encodeURIComponent(tg.initData)}`;
        console.log("Fetching:", url);

        const response = await fetch(url);
        if (!response.ok) throw new Error("API Error");

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
        console.error(e);
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

function loadProfile() {
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('profileName').innerText = user.first_name + (user.last_name ? ' ' + user.last_name : '');
        document.getElementById('profileStatus').innerText = "Online";
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
tg.MainButton.onClick(createTask);

// Input listener to show button
taskInput.addEventListener('input', () => {
    if (taskInput.value.trim().length > 0) {
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Default view
    switchView('tasks');

    // Apply theme colors manually if needed, but CSS vars handle most.
});
