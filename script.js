// ====================================================================
// 1. DATABASE CONNECTION & CONFIG (RESTORE TO ORIGINAL VARIABLE)
// ====================================================================
const SUPABASE_URL = "https://puaggevlswqumummsokw.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1YWdnZXZsc3dxdW11bW1zb2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTE3NTMsImV4cCI6MjA5NTU2Nzc1M30.DcUoTvcNsfdmzpqzfvCh7inPYYW1tlo8IVmXlNzJFGQ";

let supabaseClient = null;
try {
    if (typeof window.supabase !== 'undefined') {
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
// 2. REMOTE PARSER & VPN FILTERS
// ====================================================================
async function loadRemoteConfig() {
    try {
        let response = await fetch(GITHUB_CONFIG_RAW_URL);
        if (response.ok) remoteConfig = await response.json();
    } catch (e) { console.log("Using cached configurations."); }
}

async function verifyGlobalNetworkGate() {
    const randomRoll = Math.floor(Math.random() * 100) + 1;
    if (randomRoll > (remoteConfig.vpnRequiredPercentage || 0)) return true; 
    try {
        let response = await fetch("https://ipapi.co/json/");
        if (!response.ok) return true;
        let data = await response.json();
        if (data.country_code === "ET") {
            if (vpnOverlay) vpnOverlay.classList.remove("hidden");
            showModal("🌍", "VPN Route Flagged", "Please initialize an outside connection to unlock mining verification parameters.", "Okay");
            return false;
        }
        if (vpnOverlay) vpnOverlay.classList.add("hidden");
        return true;
    } catch (err) { return true; }
}

// ====================================================================
// 3. ROUTING MANAGER
// ====================================================================
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
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
        const name = document.getElementById('login-name').value.trim();
        const phone = document.getElementById('login-phone').value.trim();

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

            let { data: user, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('phone_number', phone);

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
            showModal("🔒", "Capacitor Depleted", "Complete your designated active task loop to restore balance tapping.", "Understood");
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
            showModal("⚡", "Maximum Capacity Hit", "Energy empty! Fulfill the current verification task to clear safety locks.", "Go to Tasks");
            renderActiveTask();
            forceCloudDataSave(); 
        }
    });
}

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

// ====================================================================
// 6. ADVERTISING TASK VERIFIER
// ====================================================================
async function renderActiveTask() {
    if (!taskBox) return;
    taskBox.innerHTML = "";
    if (!remoteConfig.tasks || remoteConfig.tasks.length === 0) return;

    const currentTask = remoteConfig.tasks[(currentUser.task_level - 1) % remoteConfig.tasks.length];

    if (!isCoinLocked) {
        taskBox.innerHTML = `<p style="text-align:center;color:#8a8f9d;padding:20px;">Ecosystem capacitor functional. Continue extraction processing.</p>`;
        return;
    }

    taskBox.innerHTML = `
        <div class="task-card" style="background:#1a1d2e; border:1px solid rgba(255,255,255,0.06); padding:20px; border-radius:16px;">
            <h3>${currentTask.title}</h3>
            <p style="color:#ffcc00; font-weight:700; margin:4px 0 16px 0;">+${currentTask.rewardCoins} Coins</p>
            <button id="watch-btn" style="width:100%; padding:12px; background:#ffcc00; border:none; color:#111; font-weight:700; border-radius:10px; cursor:pointer;">Launch Video Task</button>
            <button id="claim-btn" style="width:100%; padding:12px; background:#222; border:none; color:#555; font-weight:700; border-radius:10px; margin-top:10px;" disabled>Processing Node Link...</button>
        </div>
    `;

    const watchBtn = document.getElementById('watch-btn');
    const claimBtn = document.getElementById('claim-btn');
    const storageKey = `origen_timer_end_${currentUser.phone_number}_lvl_${currentUser.task_level}`;
    let savedEndTime = localStorage.getItem(storageKey);

    if (savedEndTime) runTaskTimer(parseInt(savedEndTime), claimBtn, watchBtn, storageKey, currentTask);

    watchBtn.addEventListener('click', async () => {
        if(localStorage.getItem(storageKey)) return;
        watchBtn.innerText = "Configuring Networks...";
        if (!await verifyGlobalNetworkGate()) { watchBtn.innerText = "Launch Video Task"; return; }
        window.open(currentTask.videoUrl, '_blank');
        const end = Date.now() + (currentTask.duration * 1000);
        localStorage.setItem(storageKey, end);
        runTaskTimer(end, claimBtn, watchBtn, storageKey, currentTask);
    });

    claimBtn.addEventListener('click', () => {
        currentUser.coin_balance += currentTask.rewardCoins;
        currentUser.task_level += 1;
        currentTapsCount = 0;
        isCoinLocked = false;
        localStorage.removeItem(storageKey);
        showModal("🎉", "Task Certified", "Rewards added successfully. Core core cleared.", "Proceed");
        renderActiveTask();
        updateTapProgressUI();
        saveProgressLocally();
        forceCloudDataSave();
    });
}

function runTaskTimer(targetTime, claim, watch, key, task) {
    if (watch) { watch.innerText = "✔ Loop Processing"; watch.style.background = "#0d0f18"; watch.style.color = "#444"; }
    if (taskCountdownTimer) clearInterval(taskCountdownTimer);
    
    taskCountdownTimer = setInterval(() => {
        let diff = targetTime - Date.now();
        if (diff <= 0) {
            clearInterval(taskCountdownTimer);
            if (claim) { claim.removeAttribute('disabled'); claim.style.background = "#00ff88"; claim.style.color = "#111"; claim.innerText = "Claim Verified Points"; }
        } else {
            let secs = Math.ceil(diff / 1000);
            if (claim) claim.innerText = `Analyzing Sync (${secs}s)`;
        }
    }, 1000);
}

// ====================================================================
// 7. SYNC SERVICES & SUB-TABS
// ====================================================================
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
    } catch (e) { syncStatus.innerText = "● Cloud Offline"; syncStatus.style.color = "#ff3366"; }
}

async function loadLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list || !supabaseClient) return;
    list.innerHTML = "<li style='text-align:center;color:#8a8f9d;list-style:none;'>Querying global rankings...</li>";
    try {
        let { data } = await supabaseClient.from('users').select('name, coin_balance').order('coin_balance', { ascending: false }).limit(50);
        list.innerHTML = "";
        data.forEach((u, idx) => {
            let li = document.createElement('li');
            li.style.cssText = "display:flex; justify-content:space-between; padding:12px 6px; border-bottom:1px solid rgba(255,255,255,0.02); font-size:14px;";
            li.innerHTML = `<span>${idx + 1}. ${u.name}</span><span style="color:#ffcc00">🪙 ${u.coin_balance.toLocaleString()}</span>`;
            list.appendChild(li);
        });
    } catch(e) { list.innerHTML = "<li style='text-align:center;color:#8a8f9d;list-style:none;'>Failed to trace database metrics.</li>"; }
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
    modalIcon.innerText = icon; modalTitle.innerText = title; modalMessage.innerText = message; modalButton.innerText = btnText;
    globalModal.classList.remove("hidden");
    modalButton.onclick = () => globalModal.classList.add("hidden");
}
