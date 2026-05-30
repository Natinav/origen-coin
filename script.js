// ====================================================================
// 1. GLOBAL STATE & CONFIGURATION
// ====================================================================
let userCoins = 0;
let userHasRegistered = true;       // Set to true so login tracking clears instantly
let hasSwitchedApps = false;       // Tracks if user minimized the app to toggle VPN
let isVpnLockedForUser = false;    // Tracks if this specific user got locked by lottery

// Remote configuration fallback (Will overwrite when connected to your config repo)
let remoteConfig = {
    vpnRequiredPercentage: "100", // Enforced at 100% so every single user receives the prompt
    tasks: [
        { id: 1, title: "Watch Premium Ad Stream 1", reward: 150, url: "https://www.youtube.com" },
        { id: 2, title: "Watch Premium Ad Stream 2", reward: 200, url: "https://www.youtube.com" }
    ]
};

// URL pointing to your config repository
const GITHUB_CONFIG_RAW_URL = "https://raw.githubusercontent.com/Natinav/origen-config-/refs/heads/main/config.json";

// ====================================================================
// 2. APP INITIALIZATION & NAVIGATION
// ====================================================================
document.addEventListener("DOMContentLoaded", () => {
    fetchRemoteConfig();
    setupNavigation();
    setupMining();
    setupVisibilityListener();
    
    // Auto-verify initialization status
    const balanceDisplay = document.getElementById("coin-balance");
    if (balanceDisplay) {
        balanceDisplay.textContent = userCoins;
    }
});

function setupNavigation() {
    const tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.getAttribute("data-tab");
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.remove("active");
    });
    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.classList.remove("active");
    });

    // Activate selected tab
    const activeContent = document.getElementById(`${tabId}-tab`);
    const activeTab = document.querySelector(`[data-tab="${tabId}"]`);
    
    if (activeContent) activeContent.classList.add("active");
    if (activeTab) activeTab.classList.add("active");

    // Special behavior if entering tasks tab
    if (tabId === "tasks") {
        initTaskTabGateway();
    }
}

// ====================================================================
// 3. REMOTE CONFIGURATION FETCH
// ====================================================================
async function fetchRemoteConfig() {
    try {
        const response = await fetch(GITHUB_CONFIG_RAW_URL);
        if (!response.ok) throw new Error("Config network response error");
        const data = await response.json();
        remoteConfig = data;
        console.log("Remote configuration loaded successfully:", remoteConfig);
    } catch (error) {
        console.warn("Using local configuration fallback:", error.message);
    }
}

// ====================================================================
// 4. MINING CORE LOGIC
// ====================================================================
function setupMining() {
    const coinButton = document.getElementById("main-coin-btn");
    const balanceDisplay = document.getElementById("coin-balance");

    if (!coinButton) return;

    coinButton.addEventListener("click", (e) => {
        userCoins += 1;
        if (balanceDisplay) balanceDisplay.textContent = userCoins;

        // Visual floating +1 effect
        createFloatingText(e);

        // Check if user reached the milestone milestone
        if (userCoins === 500) {
            triggerMilestonePopup();
        }
    });
}

function createFloatingText(e) {
    const coinButton = document.getElementById("main-coin-btn");
    const floatText = document.createElement("div");
    floatText.textContent = "+1";
    floatText.style.position = "absolute";
    floatText.style.color = "#ffcc00";
    floatText.style.fontWeight = "bold";
    floatText.style.fontSize = "20px";
    floatText.style.pointerEvents = "none";
    floatText.style.animation = "floatUp 0.8s ease-out forwards";

    const rect = coinButton.getBoundingClientRect();
    floatText.style.left = `${e.clientX - rect.left}px`;
    floatText.style.top = `${e.clientY - rect.top}px`;

    coinButton.appendChild(floatText);
    setTimeout(() => floatText.remove(), 800);
}

function triggerMilestonePopup() {
    alert("🎉 Milestone Reached! You have mined 500 coins. Redirecting you to premium video tasks!");
    switchTab("tasks");
}

// ====================================================================
// 5. BEHAVIORAL VPN LOCK SYSTEM (NO INTRUSIVE APIS)
// ====================================================================
function initTaskTabGateway() {
    const targetPercentage = parseInt(remoteConfig.vpnRequiredPercentage) || 0;
    const randomRoll = Math.floor(Math.random() * 100) + 1;
    
    console.log(`Roll: ${randomRoll} | Required Threshold: <= ${targetPercentage}`);

    if (randomRoll <= targetPercentage) {
        isVpnLockedForUser = true;
        showVpnLockModal();
    } else {
        isVpnLockedForUser = false;
        hideVpnLockModal();
        renderTasksLive();
    }
}

function setupVisibilityListener() {
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            // User minimized app/went to their settings drawer to toggle VPN
            if (isVpnLockedForUser) {
                hasSwitchedApps = true;
                console.log("App minimized. User modifying system network settings...");
            }
        } else {
            // User maximized and came back into the web app
            if (isVpnLockedForUser && hasSwitchedApps) {
                console.log("App restored. Safety protocols cleared!");
                
                hideVpnLockModal();
                isVpnLockedForUser = false;
                hasSwitchedApps = false; // Reset flag
                
                renderTasksLive();
                alert("✅ Global Route Confirmed! Your video tasks have been unlocked.");
            }
        }
    });
}

// ====================================================================
// 6. DYNAMIC UI MODAL RENDERING (BLACK & PREMIUM GOLD THEME)
// ====================================================================
function showVpnLockModal() {
    let lockOverlay = document.getElementById("vpn-lock-modal");
    const taskTabContent = document.getElementById("tasks-tab");

    if (!taskTabContent) return;

    if (!lockOverlay) {
        lockOverlay = document.createElement("div");
        lockOverlay.id = "vpn-lock-modal";
        lockOverlay.innerHTML = `
            <div style="background: linear-gradient(145deg, #121420, #1a1d2e); border: 2px solid #ffcc00; padding: 35px 25px; border-radius: 24px; text-align: center; max-width: 85%; box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 204, 0, 0.15); font-family: 'Poppins', sans-serif;">
                <h1 style="color: #ffcc00; margin-top: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; text-shadow: 0 0 10px rgba(255, 204, 0, 0.3);">⚠️ TURN ON VPN</h1>
                <p style="color: #8a8f9d; font-size: 14px; line-height: 1.6; margin-bottom: 25px;">To access high-yield premium tasks, your profile container must routing-tunnel outside local delivery zones.</p>
                
                <div style="background: #0d0f17; border-left: 4px solid #ff9900; padding: 15px; text-align: left; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.04);">
                    <strong style="color: #ffcc00; font-size: 14px; display: block; margin-bottom: 8px; font-weight: 700;">Follow these steps precisely:</strong>
                    <ol style="color: #ffffff; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                        <li style="margin-bottom: 6px;">Minimize this app (Do not close it entirely).</li>
                        <li style="margin-bottom: 6px;">Open your choice VPN tool and launch a secure global link.</li>
                        <li>Return straight back to this page to clear the lock.</li>
                    </ol>
                </div>
                
                <div style="margin-top: 25px; display: flex; justify-content: center; align-items: center; gap: 10px;">
                    <div style="width: 8px; height: 8px; background: #ffcc00; border-radius: 50%; animation: pulse 1.2s infinite alternate; box-shadow: 0 0 8px #ffcc00;"></div>
                    <p style="color: #8a8f9d; font-size: 12px; margin: 0; font-style: italic;">Awaiting background system routing sync...</p>
                </div>
            </div>
            
            <style>
                @keyframes pulse {
                    0% { transform: scale(0.8); opacity: 0.5; }
                    100% { transform: scale(1.3); opacity: 1; }
                }
            </style>
        `;

        // Apply deep premium matching dark gloss styling to block interactions completely
        Object.assign(lockOverlay.style, {
            position: "absolute",
            top: "0", left: "0", width: "100%", height: "100%",
            background: "rgba(9, 10, 16, 0.98)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: "9999", borderRadius: "24px"
        });

        taskTabContent.style.position = "relative";
        taskTabContent.appendChild(lockOverlay);
    }
    lockOverlay.style.display = "flex";
}

function hideVpnLockModal() {
    const lockOverlay = document.getElementById("vpn-lock-modal");
    if (lockOverlay) lockOverlay.style.display = "none";
}

// ====================================================================
// 7. TASK INJECTION LOGIC
// ====================================================================
function renderTasksLive() {
    const taskTabContent = document.getElementById("tasks-tab");
    if (!taskTabContent) return;

    taskTabContent.innerHTML = ""; 

    const tasksWrapper = document.createElement("div");
    tasksWrapper.style.padding = "20px";
    tasksWrapper.style.width = "100%";
    tasksWrapper.style.boxSizing = "border-box";

    const title = document.createElement("h2");
    title.textContent = "Premium Video Streams";
    title.style.color = "#ffffff";
    title.style.marginBottom = "20px";
    title.style.fontWeight = "700";
    tasksWrapper.appendChild(title);

    remoteConfig.tasks.forEach(task => {
        const card = document.createElement("div");
        Object.assign(card.style, {
            background: "#121420",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            borderRadius: "16px",
            padding: "15px 20px",
            marginBottom: "15px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
        });

        card.innerHTML = `
            <div>
                <h4 style="color: #ffffff; margin: 0 0 5px 0; font-size: 15px; font-weight: 600;">${task.title}</h4>
                <p style="color: #ffcc00; margin: 0; font-weight: 700; font-size: 13px;">+${task.reward} Origen Coins</p>
            </div>
            <button onclick="window.open('${task.url}', '_blank');" style="background: linear-gradient(90deg, #ffcc00, #ff9900); color: #000000; border: none; padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: transform 0.2s; font-size: 13px;">
                Watch Now
            </button>
        `;
        tasksWrapper.appendChild(card);
    });

    taskTabContent.appendChild(tasksWrapper);
}
