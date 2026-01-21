let tg = null;

// -- CONFIGURATION --
const API_BASE_URL = "https://28218d31081d0098-46-149-67-44.serveousercontent.com/api";
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
    log("🚀 App V8.0 (AI & Voice)");
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

// -- AI & VOICE FEATURES --

async function analyzeText() {
    const text = taskInput.value.trim();
    if (!text) return;

    const btn = document.getElementById('btnMagic');
    btn.style.animation = "spin 1s linear infinite"; // Reuse loader spin

    try {
        const url = `${API_BASE_URL}/analyze?initData=${encodeURIComponent(tg.initData)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) throw new Error("AI Error");
        const data = await response.json();
        fillForm(data);

    } catch (e) {
        log("Magic failed: " + e.message);
        alert("✨ Не удалось поколдовать: " + e.message);
    } finally {
        btn.style.animation = "none";
    }
}

// Voice Recording
let mediaRecorder;
let audioChunks = [];

async function toggleRecording() {
    const btn = document.getElementById('btnMic');

    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        btn.classList.remove("recording");
        // Icon back to mic
        btn.innerHTML = '<ion-icon name="mic-outline"></ion-icon>';
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' }); // or webm
                audioChunks = [];
                await sendVoice(audioBlob);
            };

            mediaRecorder.start();
            btn.classList.add("recording");
            btn.innerHTML = '<ion-icon name="square"></ion-icon>'; // Stop icon

        } catch (err) {
            log("Mic Error: " + err.message);
            alert("🎤 Ошибка доступа к микрофону. Разрешите доступ в настройках.");
        }
    }
}

async function sendVoice(blob) {
    const btn = document.getElementById('btnMic');
    // Visual loading state
    btn.style.opacity = "0.5";

    const formData = new FormData();
    formData.append("file", blob, "voice.wav");
    formData.append("initData", tg.initData);

    try {
        const response = await fetch(`${API_BASE_URL}/voice`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("Voice API Error");
        const data = await response.json();

        if (data.text) {
            // Show transcribed text first
            taskInput.value = data.text;
            tg.MainButton.show();
        }
        fillForm(data);

    } catch (e) {
        log("Voice send failed: " + e.message);
        alert("Ошибка обработки голоса");
    } finally {
        btn.style.opacity = "1";
    }
}

function fillForm(data) {
    if (data.clean_text) taskInput.value = data.clean_text;
    if (data.category) categorySelect.value = data.category;
    if (data.date) dateInput.value = data.date;
    if (data.time) timeInput.value = data.time;

    // Highlight that magic happened
    taskInput.style.borderColor = "#ffd700";
    setTimeout(() => taskInput.style.borderColor = "", 1000);
}

// -- END AI FEATURES --

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
    if (!tg || !tg.initDataUnsafe) return;
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

