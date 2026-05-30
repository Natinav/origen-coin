// ====================================================================
// 1. DATABASE CONNECTION & CONFIG
// ====================================================================
const SUPABASE_URL = "https://puaggevlswqumummsokw.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1YWdnZXZsc3dxdW11bW1zb2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTE3NTMsImV4cCI6MjA5NTU2Nzc1M30.DcUoTvcNsfdmzpqzfvCh7inPYYW1tlo8IVmXlNzJFGQ";

let _supabase = null;
try {
    if (typeof supabase !== 'undefined') {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn("Supabase driver not loaded yet. Working in offline bypass mode.");
    }
} catch(e) {
    console.error("Init Error Error:", e);
}

const GITHUB_CONFIG_RAW_URL = "https://raw.githubusercontent.com/Natinav/origen-config/refs/heads/main/config.json";

let remoteConfig = {
    coinValue: 0.12, 
    vpnRequiredPercentage: 100, 
    tasks: [
        { title: "Task Phase Alpha: Sync Node", rewardCoins: 1500, duration: 15, videoUrl: "https://www.youtube.com" }
    ] 
};

let currentUser = null;       
let currentTapsCount = 0;     
let isCoinLocked = false;     
let autoSaveInterval = null;  
let cloudSyncDebounceTimer = null; 
let taskCountdownTimer = null; 

// UI Elements
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

// ====================================================================
// 2. CONFIG PARSER
// ====================================================================
async function loadRemoteConfig() {
    try {
        let response = await fetch(GITHUB_CONFIG_RAW_URL);
        if (!response.ok) throw new Error();
        remoteConfig = await response.json();
    } catch (e) {
        console.log("Using built-in task arrays.");
    }
}

// ====================================================================
// 3. NETWORK DETECTOR
// ====================================================================
async function verifyGlobalNetworkGate() {
    const randomRoll = Math.floor(Math.random() * 100) + 1;
    const targetPercentage = parseInt(remoteConfig.vpnRequiredPercentage) || 0;

    if (randomRoll > targetPercentage) return true; 

    try {
        let response = await fetch("https://ipapi.co/json/");
        if (!response.ok) return true; 
        
        let geoReport = await response.json();
        const userCountry = geoReport.country_code; 

        if (userCountry === "ET") {
            alert("🌍 GLOBAL NETWORK REQUIRED!\n\nPlease turn ON your VPN to any international country (outside Ethiopia) and try again.");
            return false; 
        }
        return true;
    } catch (err) {
        return true; 
    }
}

// ====================================================================
// 4. NAVIGATION TAB ROUTER
// ====================================================================
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
        
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        
        const targetElement = document.getElementById(target);
        if (targetElement) {
            targetElement.classList.remove('hidden');
        }

        if(target === 'leaderboard-screen') loadLeaderboard();
        if(target === 'account-screen') updateAccountDetails();
    });
});

// ====================================================================
// 5. BULLETPROOF AUTH CONTEXT
// ====================================================================
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const nameInput = document.getElementById('login-name');
        const phoneInput = document.getElementById('login-phone');

        if (!nameInput || !phoneInput) return;

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();

        if(!name || !phone) {
            alert("Fields cannot be left empty!");
            return;
        }

        loginBtn.innerText = "Connecting Hub...";
        loginBtn.disabled = true;

        const forceOpenDashboard = (userRecord) => {
            currentUser = userRecord;
            
            const userDisplay = document.getElementById('user-display-name');
            if (userDisplay) userDisplay.innerText = currentUser.name;
            
            if (loginScreen) {
                loginScreen.classList.remove('active');
                loginScreen.style.display = "none";
            }
            if (appContainer) {
                appContainer.classList.remove('hidden');
            }
            
            if (coinBalanceDisplay) coinBalanceDisplay.innerText = currentUser.coin_balance.toLocaleString();
            
            updateTapProgressUI();
            startAutoSaveTimer();
            renderActiveTask();
        };

        try {
            await loadRemoteConfig();

            if (!_supabase) {
                forceOpenDashboard({ name: name, phone_number: phone, coin_balance: 0, task_level: 1 });
                return;
            }

            let { data: user, error } = await _supabase
                .from('users')
                .select('*')
                .eq('phone_number', phone);

            if (error || !user || user.length === 0) {
                // Insert brand new tracking entry
                const { data: newUser } = await _supabase
                    .from('users')
                    .insert([{ name: name, phone_number: phone, coin_balance: 0, money_balance: 0.00, task_level: 1 }])
                    .select();

                let fallbackUser = (!newUser) ? { name: name, phone_number: phone, coin_balance: 0, task_level: 1 } : newUser[0];
                forceOpenDashboard(fallbackUser);
            } else {
                let existingUser = user[0];
                const savedOfflineProgress = localStorage.getItem(`origen_backup_${existingUser.phone_number}`);
                if (savedOfflineProgress) {
                    const backup = JSON.parse(savedOfflineProgress);
                    if (backup.coin_balance > existingUser.coin_balance) {
                        existingUser.coin_balance = backup.coin_balance;
                        existingUser.task_level = backup.task_level;
                        currentTapsCount = backup.current_taps || 0;
                    }
                }
                if (currentTapsCount >= 500) isCoinLocked = true;
                forceOpenDashboard(existingUser);
            }

        } catch (err) {
            forceOpenDashboard({ name: name, phone_number: phone, coin_balance: 0, task_level: 1 });
        }
    });
}

// ====================================================================
// 6. COIN TAP MECHANICS ENGINE
// ====================================================================
if (tapCoin) {
    tapCoin.addEventListener('click', (e) => {
        if (isCoinLocked) {
            alert("Capacitor Depleted! Complete Active Video Task To Recharge Coin!");
            return;
        }

        currentUser.coin_balance += 1;
        currentTapsCount += 1;
        
        if (coinBalanceDisplay) coinBalanceDisplay.innerText = currentUser.coin_balance.toLocaleString();
        updateTapProgressUI();
        createFloatingHitTextEffect(e);
        saveProgressLocally();

        clearTimeout(cloudSyncDebounceTimer);
        cloudSyncDebounceTimer = setTimeout(() => { forceCloudDataSave(); }, 1500);

        if (currentTapsCount >= 500) {
            isCoinLocked = true;
            alert("Capacitor hit 500 taps! Coin locked. Fulfill task to release safety gates.");
            renderActiveTask();
            forceCloudDataSave(); 
        }
    });
}

function saveProgressLocally() {
    if (!currentUser) return;
    const cacheData = { coin_balance: currentUser.coin_balance, task_level: currentUser.task_level, current_taps: currentTapsCount };
    localStorage.setItem(`origen_backup_${currentUser.phone_number}`, JSON.stringify(cacheData));
}

function createFloatingHitTextEffect(e) {
    if (!coinStage) return;
    const hitText = document.createElement('div');
    hitText.className = 'floating-hit-text';
    hitText.innerText = "+1";
    hitText.style.cssText = "position:absolute; color:#ffcc00; font-weight:800; font-size:24px; animation: floatUp 0.8s ease-out; pointer-events:none; z-index:100;";

    const bounds = coinStage.getBoundingClientRect();
    let x = e.clientX - bounds.left;
    let y = e.clientY - bounds.top;

    hitText.style.left = `${x}px`;
    hitText.style.top = `${y}px`;

    coinStage.appendChild(hitText);
    setTimeout(() => { hitText.remove(); }, 800);
}

function updateTapProgressUI() {
    if (tapCounter) tapCounter.innerText = currentTapsCount;
    if (progressFill) {
        let percentage = (currentTapsCount / 500) * 100;
        progressFill.style.width = `${percentage}%`;
    }
}

// ====================================================================
// 7. TASK VALIDATION MANAGEMENT
// ====================================================================
async function renderActiveTask() {
    if (!taskBox) return;
    taskBox.innerHTML = "";
    
    if (!remoteConfig.tasks || remoteConfig.tasks.length === 0) {
        taskBox.innerHTML = `<p style="text-align:center;padding:15px;color:#aaa;">Loading tasks system...</p>`;
        return;
    }

    const totalAvailableTasks = remoteConfig.tasks.length;
    const currentLoopIndex = (currentUser.task_level - 1) % totalAvailableTasks;
    const currentTask = remoteConfig.tasks[currentLoopIndex];

    if (!isCoinLocked) {
        taskBox.innerHTML = `<p style="text-align:center;padding:15px;color:#aaa;background:rgba(255,255,255,0.02);border-radius:12px;">Core capacitor active. Keep tapping to extract points.</p>`;
        return;
    }

    taskBox.innerHTML = `
        <div class="task-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:20px; border-radius:12px;">
            <h3 style="margin:0 0 5px 0; font-size:16px;">${currentTask.title}</h3>
            <p style="color:#ffcc00; font-weight:600; margin:0 0 15px 0;">Reward: +${currentTask.rewardCoins} Coins</p>
            <button id="watch-btn" style="width:100%; padding:12px; background:#ffcc00; color:#111; border:none; border-radius:8px; font-weight:700; cursor:pointer;">游 Watch Required Video</button>
            <button id="claim-btn" style="width:100%; padding:12px; background:#222; color:#555; border:none; border-radius:8px; font-weight:700; margin-top:10px; cursor:not-allowed;" disabled>Awaiting Verification</button>
        </div>
    `;

    const watchBtn = document.getElementById('watch-btn');
    const claimBtn = document.getElementById('claim-btn');

    const storageKey = `origen_timer_end_${currentUser.phone_number}_lvl_${currentUser.task_level}`;
    let savedTargetEndTime = localStorage.getItem(storageKey);

    if (savedTargetEndTime) {
        videoEngagedCountdownEngine(parseInt(savedTargetEndTime), claimBtn, watchBtn, storageKey, currentTask);
    }

    if (watchBtn) {
        watchBtn.addEventListener('click', async () => {
            if(localStorage.getItem(storageKey)) return; 
            watchBtn.innerText = "Checking Network Routing...";
            const clearToProceed = await verifyGlobalNetworkGate();
            if (!clearToProceed) {
                watchBtn.innerText = "游 Watch Required Video";
                return; 
            }
            window.open(currentTask.videoUrl, '_blank');
            const calculatedEndTime = Date.now() + (currentTask.duration * 1000);
            localStorage.setItem(storageKey, calculatedEndTime);
            videoEngagedCountdownEngine(calculatedEndTime, claimBtn, watchBtn, storageKey, currentTask);
        });
    }

    if (claimBtn) {
        claimBtn.addEventListener('click', () => {
            const pointsEarned = currentTask.rewardCoins || 1000;
            currentUser.coin_balance += pointsEarned;
            currentUser.task_level += 1; 
            currentTapsCount = 0; 
            isCoinLocked = false;
            localStorage.removeItem(storageKey); 
            alert(`Credits claimed! +${pointsEarned} Coins credited.`);
            if (coinBalanceDisplay) coinBalanceDisplay.innerText = currentUser.coin_balance.toLocaleString();
            updateTapProgressUI();
            renderActiveTask();
            saveProgressLocally(); 
            forceCloudDataSave();
        });
    }
}

function videoEngagedCountdownEngine(endTimeTarget, claimButton, watchButton, keyStorage, activeTaskInstance) {
    if (watchButton) {
        watchButton.innerText = "✔ Watch Links Connected";
        watchButton.style.background = "#161824";
        watchButton.style.color = "#444";
    }

    if(taskCountdownTimer) clearInterval(taskCountdownTimer);

    taskCountdownTimer = setInterval(() => {
        let msLeft = endTimeTarget - Date.now();
        let timeLeft = Math.max(0, Math.floor(msLeft / 1000));
        let mins = Math.floor(timeLeft / 60);
        let secs = timeLeft % 60;
        
        if (claimButton) {
            claimButton.innerText = `Analyzing Loop (${mins}:${secs < 10 ? '0' : ''}${secs})`;
        }

        if (timeLeft <= 0) {
            clearInterval(taskCountdownTimer);
            if (claimButton) {
                claimButton.removeAttribute('disabled');
                claimButton.style.background = "#00ff88";
                claimButton.style.color = "#111";
                claimButton.style.cursor = "pointer";
                claimButton.innerText = "Claim Credits & Unlock Coin";
            }
        }
    }, 1000);
}

// ====================================================================
// 8. STORAGE BACKGROUND AUTOSAVE HANDLERS
// ====================================================================
function startAutoSaveTimer() {
    if(autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => { forceCloudDataSave(); }, 5 * 60 * 1000); 
}

async function forceCloudDataSave() {
    if (!currentUser || !_supabase || !syncStatus) return;
    syncStatus.innerText = "● Syncing Data...";
    syncStatus.style.color = "#ffcc00";
    try {
        await _supabase
            .from('users')
            .update({ coin_balance: currentUser.coin_balance, task_level: currentUser.task_level })
            .eq('phone_number', currentUser.phone_number);
        syncStatus.innerText = "● Secure Cloud Synced";
        syncStatus.style.color = "#00ff88";
    } catch (err) {
        syncStatus.innerText = "● Cloud Offline";
        syncStatus.style.color = "#ff3366";
    }
}

async function loadLeaderboard() {
    const listContainer = document.getElementById('leaderboard-list');
    if (!listContainer || !_supabase) return;
    listContainer.innerHTML = "<li style='text-align:center;color:#aaa;list-style:none;'>Syncing Global Board...</li>";
    try {
        let { data: topUsers } = await _supabase
            .from('users')
            .select('name, coin_balance')
            .order('coin_balance', { ascending: false })
            .limit(100);
        
        listContainer.innerHTML = "";
        topUsers.forEach((user, index) => {
            let li = document.createElement('li');
            li.style.cssText = "display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid rgba(255,255,255,0.03); font-size:14px;";
            let rank = index + 1;
            if(rank === 1) rank = "🥇";
            else if(rank === 2) rank = "🥈";
            else if(rank === 3) rank = "🥉";
            li.innerHTML = `<div><span>${rank}</span><span style="margin-left:10px;">${user.name}</span></div><span style="color:#ffcc00">🪙 ${user.coin_balance.toLocaleString()}</span>`;
            listContainer.appendChild(li);
        });
    } catch (e) {
        listContainer.innerHTML = "<li style='text-align:center; color:#aaa;list-style:none;'>Leaderboard data link loaded locally.</li>";
    }
}

function updateAccountDetails() {
    if(!currentUser) return;
    const accName = document.getElementById('acc-name');
    const accPhone = document.getElementById('acc-phone');
    const accCoins = document.getElementById('acc-coins');
    const accMoney = document.getElementById('acc-money');

    if(accName) accName.innerText = currentUser.name;
    if(accPhone) accPhone.innerText = currentUser.phone_number;
    if(accCoins) accCoins.innerText = currentUser.coin_balance.toLocaleString();
    if(accMoney) {
        let finalMoney = currentUser.coin_balance * remoteConfig.coinValue;
        accMoney.innerText = finalMoney.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
}
