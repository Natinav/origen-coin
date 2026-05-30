// ====================================================================
// 1. GLOBAL STATE & CONFIGURATION
// ====================================================================
let userCoins = 0;
let userHasRegistered = false;

// Remote configuration fallback (Will overwrite when connected to your config repo)
let remoteConfig = {
    vpnRequiredPercentage: "100", // Defaulting to 100% for testing so you always see it
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
    floatText.style.color = "#ff7b00";
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
// 5. TASK INJECTION LOGIC
// ====================================================================
function renderTasksLive() {
    const taskTabContent = document.getElementById("tasks-tab");
    if (!taskTabContent) return;

    // Remove existing tasks wrapper or loader text inside tab if there is one
    taskTabContent.innerHTML = ""; 

    const tasksWrapper = document.createElement("div");
    tasksWrapper.style.padding = "20px";
    tasksWrapper.style.width = "100%";
    tasksWrapper.style.boxSizing = "border-box";

    const title = document.createElement("h2");
    title.textContent = "Premium Video Streams";
    title.style.color = "#ffffff";
    title.style.marginBottom = "20px";
    tasksWrapper.appendChild(title);

    // Build lists dynamically from configuration array
    remoteConfig.tasks.forEach(task => {
        const card = document.createElement("div");
        Object.assign(card.style, {
            background: "#1e1e24",
            border: "1px solid #2d2d35",
            borderRadius: "10px",
            padding: "15px",
            marginBottom: "15px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
        });

        card.innerHTML = `
            <div>
                <h4 style="color: #ffffff; margin: 0 0 5px 0; font-size: 16px;">${task.title}</h4>
                <p style="color: #ff7b00; margin: 0; font-weight: bold; font-size: 14px;">+${task.reward} Origen Coins</p>
            </div>
            <button onclick="window.open('${task.url}', '_blank');" style="background: #ff7b00; color: #ffffff; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s;">
                Watch Now
            </button>
        `;
        tasksWrapper.appendChild(card);
    });

    taskTabContent.appendChild(tasksWrapper);
}
