// ====================================================================
// 1. DATABASE CONNECTION & CONFIG
// ====================================================================
const SUPABASE_URL = "https://puaggevlswqumummsokw.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1YWdnZXZsc3dxdW11bW1zb2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTE3NTMsImV4cCI6MjA5NTU2Nzc1M30.DcUoTvcNsfdmzpqzfvCh7inPYYW1tlo8IVmXlNzJFGQ";

let supabaseClient = null;
try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn("Offline fallback framework running.");
    }
} catch(e) {
    console.error("Initialization anomaly:", e);
}

const GITHUB_CONFIG_RAW_URL = "https://raw.githubusercontent.com/Natinav/origen-config/refs/heads/main/config.json";

let remoteConfig = {
    coinValue: 0.12, 
    vpnRequiredPercentage: 100, 
    tasks: [{ title: "Task Phase Alpha: Sync Node", rewardCoins: 1500, duration: 15, videoUrl: "https://www.youtube.com" }] 
};

let currentUser = null;       
let currentTapsCount = 0;     
let isCoinLocked = false;     
let autoSaveInterval = null;  
let cloudSyncDebounceTimer = null; 
let taskCountdownTimer = null; 

// UI Declarations
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('login-btn');
const tapCoin = document.getElementById('tap-coin');
const coinStage = document.getElementById('coin-stage');
const coinBalanceDisplay = document.getElementById('coin-balance-display');
const tapCounter = document.getElementById('tap-counter');
const progressFill = document.getElementById('progress-fill');
const taskBox = document.getElementById('task-box');
const syncStatus = document.getElementById('sync-status');

// Modal Elements Links
const globalModal = document.getElementById("global-modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalButton = document.getElementById("modal-btn");
const modalIcon = document.getElementById("modal-icon");
const vpnOverlay = document.getElementById("vpn-overlay");

// ====================================================================
// 2. REMOTE PARSER & VPN SECURITY SYSTEM
// ====================================================================
async function loadRemoteConfig() {
    try {
        let response = await fetch(GITHUB_CONFIG_RAW_URL);
        if (response.ok) remoteConfig = await response.json();
    } catch (e) { console.log("Using cached configurations."); }
}

async function executeVpnGateCheck() {
    const randomRoll = Math.floor(Math.random() * 100) + 1;
    const requiredPct = remoteConfig.vpnRequiredPercentage !== undefined ? remoteConfig.vpnRequiredPercentage : 100;
    
    if (randomRoll > requiredPct) {
        if (vpnOverlay) vpnOverlay.classList.add("hidden");
        switchSectionToTasks();
        return;
    }

    if (vpnOverlay) {
        vpnOverlay.innerHTML = `
            <div class="vpn-card">
                <div class="vpn-icon" style="font-size: 40px; margin-bottom: 12px;">🌍</div>
                <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">VPN REQUIRED</h2>
                <p style="color: #8e8e9a; font-size: 13px; line-height: 1.6; margin-bottom: 20px;">
                    Please route your connection outside of Ethiopia to unlock the mining verification parameters.
                </p>
                <button id="vpn-check-btn" style="width: 100%; padding: 14px; background: linear-gradient(90deg, #ffcc00, #ff7b00); border: none; border-radius: 12px; color: #111; font-weight: 800; cursor: pointer; font-size: 14px;">
                    Check Connection
                </button>
            </div>
        `;
        vpnOverlay.classList.remove("hidden");

        const checkBtn = document.getElementById("vpn-check-btn");
        checkBtn.addEventListener("click", async () => {
            checkBtn.innerText = "Verifying Route...";
            checkBtn.disabled = true;

            try {
                let response = await fetch("https://ipapi.co/json/");
                
                if (!response.ok) {
                    showModal("⚠️", "Network Intercepted", "Connection verification blocked. Please temporarily disable your ad blocker or check your network connection and try again.", "Try Again");
                    checkBtn.innerText = "Check Connection";
                    checkBtn.disabled = false;
                    return;
                }
                
                let data = await response.json();

                if (data.country_code === "ET") {
                    showModal("⚠️", "VPN Route Flagged", "VPN not detected, please turn on an international VPN connection and try again.", "Try Again");
                    checkBtn.innerText = "Check Connection";
                    checkBtn.disabled = false;
                } else {
                    vpnOverlay.classList.add("hidden");
                    switchSectionToTasks();
                }
            } catch (err) {
                showModal("⚠️", "Security Exception", "Network verification error. Please ensure your VPN is active and any ad blockers are disabled.", "Try Again");
                checkBtn.innerText = "Check Connection";
                checkBtn.disabled = false;
            }
        });
    }
}

function switchSectionToTasks() {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    
    const taskNavBtn = document.querySelector('[data-target="tasks-screen"]');
    if (taskNavBtn) taskNavBtn.classList.add('active');
    
    const tasksScreen = document.getElementById('tasks-screen');
    if (tasksScreen) tasksScreen.classList.remove('hidden');
    renderActiveTask();
}

// ====================================================================
// 3. ROUTING MANAGER
// ====================================================================
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (isCoinLocked && btn.getAttribute('data-target') !== 'tasks-screen') {
            executeVpnGateCheck();
            return;
        }

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
        btn.classList.add('active');
        const target = document.getElementById(btn.getAttribute('data-target'));
        if (target) target.classList.remove('hidden');

        if(btn.getAttribute('data-target') === 'leaderboard-screen') loadLeaderboard();
        if(btn.getAttribute('data-target') === 'account-screen') updateAccountDetails();
    });
});

// ====================================================================
// 4. AUTH HANDLER LOOP
// ====================================================================
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const nameInput = document.getElementById('login-name');
        const phoneInput = document.getElementById('login-phone');
        
        if (!nameInput || !phoneInput) return;

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();

        if(!name || !phone) {
            showModal("⚠️", "Validation Check", "Please complete all secure profile fields.", "Dismiss");
            return;
        }

        loginBtn.innerText = "Synchronizing Hub...";
        loginBtn.disabled = true;

        const loadDashboard = (userRecord) => {
            currentUser = userRecord;
            document.getElementById('user-display-name').innerText = currentUser.name;
            loginScreen.classList.add('hidden');
            loginScreen.style.display = "none";
            appContainer.classList.remove('hidden');
            coinBalanceDisplay.innerText = currentUser.coin_balance.toLocaleString();
            
            updateTapProgressUI();
            startAutoSaveTimer();
            renderActiveTask();
        };

        try {
            await loadRemoteConfig();

            if (!supabaseClient) {
                loadDashboard({ name: name, phone_number: phone, coin_balance: 0, task_level: 1 });
                return;
            }

            let { data: user, error } = await supabaseClient.from('users').select('*').eq('phone_number', phone);

            if (error || !user || user.length === 0) {
                const { data: newUser } = await supabaseClient
                    .from('users')
                    .insert([{ name: name, phone_number: phone, coin_balance: 0, money_balance: 0.00, task_level: 1 }])
                    .select();
                loadDashboard(newUser ? newUser[0] : { name: name, phone_number: phone, coin_balance: 0, task_level: 1 });
            } else {
                let existing = user[0];
                const localBackup = localStorage.getItem(`origen_backup_${existing.phone_number}`);
                if (localBackup) {
                    const backup = JSON.parse(localBackup);
                    if (backup.coin_balance > existing.coin_balance) {
                        existing.coin_balance = backup.coin_balance;
                        existing.task_level = backup.task_level;
                        currentTapsCount = backup.current_taps || 0;
                    }
                }
                if (currentTapsCount >= 500) isCoinLocked = true;
                loadDashboard(existing);
            }
        } catch (err) {
            loadDashboard({ name: name, phone_number: phone, coin_balance: 0, task_level: 1 });
        }
    });
}

// ====================================================================
// 5. POINT EXTRACTION CONTROLS
// ====================================================================
if (tapCoin) {
    tapCoin.addEventListener('click', (e) => {
        if (isCoinLocked) {
            executeVpnGateCheck();
            return;
        }

        currentUser.coin_balance += 1;
        currentTapsCount += 1;
        coinBalanceDisplay.innerText = currentUser.coin_balance.toLocaleString();
        updateTapProgressUI();
        createFloatingHitTextEffect(e);
        saveProgressLocally();

        clearTimeout(cloudSyncDebounceTimer);
        cloudSyncDebounceTimer = setTimeout(() => { forceCloudDataSave(); }, 1500);

        if (currentTapsCount >= 500) {
            isCoinLocked = true;
            forceCloudDataSave(); 
            executeVpnGateCheck();
        }
    });
}

// ====================================================================
// 6. ADVERTISING TASK VERIFIER
// ====================================================================
function saveProgressLocally() {
    if (!currentUser) return;
    localStorage.setItem(`origen_backup_${currentUser.phone_number}`, JSON.stringify({
        coin_balance: currentUser.coin_balance, task_level: currentUser.task_level, current_taps: currentTapsCount
    }));
}

function createFloatingHitTextEffect(e) {
    if (!coinStage) return;
    const hitText = document.createElement('div');
    hitText.innerText = "+1";
    hitText.style.cssText = "position:absolute; color:#ffcc00; font-weight:800; font-size:22px; pointer-events:none; z-index:100; transition: transform 0.6s, opacity 0.6s;";
    
    const bounds = coinStage.getBoundingClientRect();
    hitText.style.left = `${e.clientX - bounds.left}px`;
    hitText.style.top = `${e.clientY - bounds.top}px`;
    coinStage.appendChild(hitText);

    setTimeout(() => {
        hitText.style.transform = "translateY(-40px)";
        hitText.style.opacity = "0";
    }, 10);
    setTimeout(() => { hitText.remove(); }, 600);
}

function updateTapProgressUI() {
    if (tapCounter) tapCounter.innerText = currentTapsCount;
    if (progressFill) progressFill.style.width = `${(currentTapsCount / 500) * 100}%`;
}

async function renderActiveTask() {
    if (!taskBox || !currentUser) return; // Added security check to prevent asynchronous breaks
    taskBox.innerHTML = "";
    if (!remoteConfig.tasks || remoteConfig.tasks.length === 0) return;

    const currentTask = remoteConfig.tasks[(currentUser.task_level - 1) % remoteConfig.tasks.length];

    if (!isCoinLocked) {
        taskBox.innerHTML = `<p style="text-align:center;color:#8e8e9a;padding:20px;font-size:13px;">Ecosystem capacitor functional. Continue extraction processing.</p>`;
        return;
    }

    taskBox.innerHTML = `
        <div class="task-card" style="background:#121420; border:1px solid rgba(255,255,255,0.05); padding:20px; border-radius:16px;">
            <h3 style="font-size: 16px; font-weight:700; margin-bottom:6px;">${currentTask.title}</h3>
            <p style="color:#ffcc00; font-weight:700; margin:4px 0 16px 0;">+${currentTask.rewardCoins} Coins</p>
            <button id="watch-btn" style="width:100%; padding:12px; background:#ffcc00; border:none; color:#111; font-weight:700; border-radius:10px; cursor:pointer; font-size:14px;">Launch Video Task</button>
            <button id="claim-btn" style="width:100%; padding:12px; background:#191c2c; border:none; color:#4e5361; font-weight:700; border-radius:10px; margin-top:10px; font-size:14px;" disabled>Processing Node Link...</button>
        </div>
    `;

    const watchBtn = document.getElementById('watch-btn');
    const claimBtn = document.getElementById('claim-btn');
    const storageKey = `origen_timer_end_${currentUser.phone_number}_lvl_${currentUser.task_level}`;
    let savedEndTime = localStorage.getItem(storageKey);

    if (savedEndTime) {
        runTaskTimer(parseInt(savedEndTime), currentTask);
    }

    if (watchBtn) {
        watchBtn.addEventListener('click', () => {
            if(localStorage.getItem(storageKey)) return;
            window.open(currentTask.videoUrl, '_blank');
            const end = Date.now() + (currentTask.duration * 1000);
            localStorage.setItem(storageKey, end);
            runTaskTimer(end, currentTask);
        });
    }

    if (claimBtn) {
        claimBtn.addEventListener('click', () => {
            currentUser.coin_balance += currentTask.rewardCoins;
            currentUser.task_level += 1;
            currentTapsCount = 0;
            isCoinLocked = false;
            localStorage.removeItem(storageKey);
            showModal("🎉", "Task Certified", "Rewards added successfully. Core capacitor cleared.", "Proceed");
            renderActiveTask();
            updateTapProgressUI();
            saveProgressLocally();
            forceCloudDataSave();
        });
    }
}

function runTaskTimer(targetTime, task) {
    const updateUI = () => {
        const watch = document.getElementById('watch-btn');
        const claim = document.getElementById('claim-btn');
        
        if (watch) { 
            watch.innerText = "✔ Loop Processing"; 
            watch.style.background = "#0d0f18"; 
            watch.style.color = "#4e5361"; 
            watch.style.cursor = "default"; 
        }
        
        let diff = targetTime - Date.now();
        if (diff <= 0) {
            clearInterval(taskCountdownTimer);
            if (claim) {
                claim.innerText = "Claim Task Reward";
                claim.disabled = false;
                claim.style.background = "linear-gradient(90deg, #ffcc00, #ff7b00)";
                claim.style.color = "#111";
                claim.style.cursor = "pointer";
                claim.style.boxShadow = "0 0 15px rgba(255, 204, 0, 0.4)";
            }
        } else {
            let secs = Math.ceil(diff / 1000);
            if (claim) claim.innerText = `Analyzing Sync (${secs}s)`;
        }
    };

    if (taskCountdownTimer) clearInterval(taskCountdownTimer);
    updateUI(); // Run immediately to prevent layout pop or empty frames
    taskCountdownTimer = setInterval(updateUI, 1000);
}

function startAutoSaveTimer() {
    if(autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => { forceCloudDataSave(); }, 5 * 60 * 1000);
}

async function forceCloudDataSave() {
    if (!currentUser || !supabaseClient || !syncStatus) return;
    syncStatus.innerText = "● Syncing Data...";
    syncStatus.style.color = "#ffcc00";
    try {
        await supabaseClient.from('users').update({ coin_balance: currentUser.coin_balance, task_level: currentUser.task_level }).eq('phone_number', currentUser.phone_number);
        syncStatus.innerText = "● Secure Cloud Synced";
        syncStatus.style.color = "#00ff88";
    } catch (e) { 
        syncStatus.innerText = "● Cloud Offline"; 
        syncStatus.style.color = "#ff3366"; 
    }
}

async function loadLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list || !supabaseClient) return;
    list.innerHTML = "<li style='text-align:center;color:#8e8e9a;list-style:none;font-size:13px;'>Querying global rankings...</li>";
    try {
        let { data } = await supabaseClient.from('users').select('*').order('coin_balance', { ascending: false }).limit(50);
        list.innerHTML = "";
        data.forEach((u, idx) => {
            let li = document.createElement('li');
            li.style.cssText = "display:flex; justify-content:space-between; padding:14px 6px; border-bottom:1px solid rgba(255,255,255,0.02); font-size:14px;";
            li.innerHTML = `<span>${idx + 1}. ${u.name}</span><span style="color:#ffcc00">🪙 ${u.coin_balance.toLocaleString()}</span>`;
            list.appendChild(li);
        });
    } catch(e) { 
        list.innerHTML = "<li style='text-align:center;color:#8e8e9a;list-style:none;font-size:13px;'>Failed to trace database metrics.</li>"; 
    }
}

function updateAccountDetails() {
    if(!currentUser) return;
    document.getElementById('acc-name').innerText = currentUser.name;
    document.getElementById('acc-phone').innerText = currentUser.phone_number;
    document.getElementById('acc-coins').innerText = currentUser.coin_balance.toLocaleString();
    document.getElementById('acc-money').innerText = (currentUser.coin_balance * remoteConfig.coinValue).toFixed(2);
}

function showModal(icon, title, message, btnText) {
    if (!globalModal) { alert(message); return; }
    modalIcon.innerText = icon; 
    modalTitle.innerText = title; 
    modalMessage.innerText = message; 
    modalButton.innerText = btnText;
    globalModal.classList.remove("hidden");
    modalButton.onclick = () => globalModal.classList.add("hidden");
}
