# UPDATED script.js — PART 1

Delete your current `script.js`.

Create a new `script.js`.

Paste THIS first.

Then after this I will send PART 2.

```javascript id="2mx9rk"
/* ================================================= */
/* ORIGEN COIN */
/* ================================================= */

/* ================================================= */
/* SUPABASE */
/* ================================================= */

const SUPABASE_URL =
    "https://puaggevlswqumummsokw.supabase.co";

const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1YWdnZXZsc3dxdW11bW1zb2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTE3NTMsImV4cCI6MjA5NTU2Nzc1M30.DcUoTvcNsfdmzpqzfvCh7inPYYW1tlo8IVmXlNzJFGQ";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

/* ================================================= */
/* GITHUB CONFIG */
/* ================================================= */

const GITHUB_CONFIG_RAW_URL =
    "https://raw.githubusercontent.com/Natinav/origen-config/refs/heads/main/config.json";

/* ================================================= */
/* GLOBAL STATE */
/* ================================================= */

let remoteConfig = {
    coinValue: 0.05,
    vpnRequiredPercentage: 100,
    tasks: []
};

let currentUser = null;

let userCoins = 0;

let userTapCount = 0;

let miningLocked = false;

let currentTask = null;

let currentTaskTimer = null;

let taskEndTimestamp = null;

let isVpnLockedForUser = false;

let vpnAssignmentChecked = false;

let currentTaskRunning = false;

/* ================================================= */
/* ELEMENTS */
/* ================================================= */

const loginScreen =
    document.getElementById("login-screen");

const appContainer =
    document.getElementById("app-container");

const loginBtn =
    document.getElementById("login-btn");

const nameInput =
    document.getElementById("login-name");

const phoneInput =
    document.getElementById("login-phone");

const coinBalanceDisplay =
    document.getElementById("coin-balance-display");

const tapCoin =
    document.getElementById("tap-coin");

const coinStage =
    document.getElementById("coin-stage");

const progressFill =
    document.getElementById("progress-fill");

const tapCounter =
    document.getElementById("tap-counter");

const taskBox =
    document.getElementById("task-box");

const navButtons =
    document.querySelectorAll(".nav-btn");

const appSections =
    document.querySelectorAll(".app-section");

const vpnOverlay =
    document.getElementById("vpn-overlay");

const leaderboardList =
    document.getElementById("leaderboard-list");

/* ================================================= */
/* MODAL ELEMENTS */
/* ================================================= */

const globalModal =
    document.getElementById("global-modal");

const modalTitle =
    document.getElementById("modal-title");

const modalMessage =
    document.getElementById("modal-message");

const modalButton =
    document.getElementById("modal-btn");

const modalIcon =
    document.getElementById("modal-icon");

/* ================================================= */
/* START APP */
/* ================================================= */

window.addEventListener(
    "load",
    async () => {

        await loadRemoteConfig();

        setupNavigation();

        setupVisibilityListener();

        restoreExistingTaskTimer();

        console.log("Origen Coin Initialized");

    }
);

/* ================================================= */
/* LOAD CONFIG */
/* ================================================= */

async function loadRemoteConfig(){

    try{

        const response =
            await fetch(
                GITHUB_CONFIG_RAW_URL +
                "?t=" +
                Date.now()
            );

        const data =
            await response.json();

        remoteConfig = data;

        console.log(
            "Remote Config Loaded:",
            remoteConfig
        );

    }catch(error){

        console.error(
            "Config Fetch Failed:",
            error
        );

        remoteConfig = {
            coinValue: 0.05,
            vpnRequiredPercentage: 100,
            tasks: []
        };

    }

}

/* ================================================= */
/* LOGIN */
/* ================================================= */

loginBtn.addEventListener(
    "click",
    async () => {

        const fullName =
            nameInput.value.trim();

        const phone =
            phoneInput.value.trim();

        if(!fullName || !phone){

            showModal(
                "⚠️",
                "Missing Information",
                "Please enter your full name and Telebirr number.",
                "Continue"
            );

            return;
        }

        loginBtn.disabled = true;

        loginBtn.innerText =
            "Connecting...";

        try{

            const { data, error } =
                await supabaseClient
                .from("users")
                .select("*")
                .eq("phone", phone)
                .single();

            if(error && error.code !== "PGRST116"){
                throw error;
            }

            /* ========================= */
            /* EXISTING USER */
            /* ========================= */

            if(data){

                currentUser = data;

                userCoins =
                    Number(data.coin_balance || 0);

                userTapCount =
                    Number(data.tap_count || 0);

                openMainApp();

            }

            /* ========================= */
            /* NEW USER */
            /* ========================= */

            else{

                const newUser = {

                    full_name: fullName,

                    phone: phone,

                    coin_balance: 0,

                    tap_count: 0

                };

                const {
                    data: insertedUser,
                    error: insertError
                } =
                    await supabaseClient
                    .from("users")
                    .insert(newUser)
                    .select()
                    .single();

                if(insertError){
                    throw insertError;
                }

                currentUser =
                    insertedUser;

                userCoins = 0;

                userTapCount = 0;

                openMainApp();

            }

        }catch(error){

            console.error(
                "Login Error:",
                error
            );

            showModal(
                "⚠️",
                "Connection Failed",
                "Could not connect to Origen Cloud.",
                "Retry"
            );

        }

        loginBtn.disabled = false;

        loginBtn.innerText =
            "Enter Mining Hub";

    }
);

/* ================================================= */
/* OPEN APP */
/* ================================================= */

function openMainApp(){

    loginScreen.classList.remove("active");

    loginScreen.classList.add("hidden");

    appContainer.classList.remove("hidden");

    document.getElementById(
        "user-display-name"
    ).innerText =
        currentUser.full_name;

    document.getElementById(
        "acc-name"
    ).innerText =
        currentUser.full_name;

    document.getElementById(
        "acc-phone"
    ).innerText =
        currentUser.phone;

    updateUI();

    loadLeaderboard();

}

/* ================================================= */
/* UPDATE UI */
/* ================================================= */

function updateUI(){

    coinBalanceDisplay.innerText =
        userCoins.toLocaleString();

    tapCounter.innerText =
        userTapCount;

    const percent =
        Math.min(
            (userTapCount / 500) * 100,
            100
        );

    progressFill.style.width =
        percent + "%";

    document.getElementById(
        "acc-coins"
    ).innerText =
        userCoins.toLocaleString();

    const estimatedValue =
        (
            userCoins *
            Number(remoteConfig.coinValue || 0)
        ).toFixed(2);

    document.getElementById(
        "acc-money"
    ).innerText =
        estimatedValue;

}

/* ================================================= */
/* NAVIGATION */
/* ================================================= */

function setupNavigation(){

    navButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const target =
                    button.dataset.target;

                navButtons.forEach(btn => {
                    btn.classList.remove("active");
                });

                button.classList.add("active");

                appSections.forEach(section => {
                    section.classList.add("hidden");
                });

                document
                    .getElementById(target)
                    .classList.remove("hidden");

                if(target === "tasks-screen"){

                    openTasksFlow();

                }

                if(target === "leaderboard-screen"){

                    loadLeaderboard();

                }

            }
        );

    });

}

/* ================================================= */
/* TAP ENGINE */
/* ================================================= */

tapCoin.addEventListener(
    "click",
    async (event) => {

        if(miningLocked){
            return;
        }

        userCoins += 1;

        userTapCount += 1;

        updateUI();

        createFloatingHitText(event);

        if(userTapCount >= 500){

            miningLocked = true;

            await saveUserData();

            showModal(
                "⚡",
                "Mining Capacity Reached",
                "Your mining core has reached the 500 tap limit. Complete a premium task to recharge and continue mining.",
                "Go To Tasks",
                () => {

                    switchToTasksTab();

                }
            );

        }

        debounceCloudSave();

    }
);

/* ================================================= */
/* FLOATING TEXT */
/* ================================================= */

function createFloatingHitText(event){

    const text =
        document.createElement("div");

    text.className =
        "floating-hit-text";

    text.innerText =
        "+1";

    const rect =
        coinStage.getBoundingClientRect();

    text.style.left =
        (event.clientX - rect.left) + "px";

    text.style.top =
        (event.clientY - rect.top) + "px";

    coinStage.appendChild(text);

    setTimeout(() => {

        text.remove();

    }, 800);

}

/* ================================================= */
/* SWITCH TASK TAB */
/* ================================================= */

function switchToTasksTab(){

    navButtons.forEach(btn => {

        btn.classList.remove("active");

        if(
            btn.dataset.target ===
            "tasks-screen"
        ){
            btn.classList.add("active");
        }

    });

    appSections.forEach(section => {
        section.classList.add("hidden");
    });

    document
        .getElementById("tasks-screen")
        .classList.remove("hidden");

    openTasksFlow();

}

/* ================================================= */
/* TASK FLOW */
/* ================================================= */

function openTasksFlow(){

    if(!miningLocked){

        taskBox.innerHTML = `

            <div class="task-card">

                <h3>
                    Mining Active
                </h3>

                <p>
                    Reach 500 taps to unlock premium tasks.
                </p>

            </div>

        `;

        return;
    }

    assignVpnRequirement();

    if(isVpnLockedForUser){

        showVpnOverlay();

        return;
    }

    renderTasks();

}

/* ================================================= */
/* VPN ASSIGNMENT */
/* ================================================= */

function assignVpnRequirement(){

    if(vpnAssignmentChecked){
        return;
    }

    vpnAssignmentChecked = true;

    const saved =
        localStorage.getItem(
            "origen_vpn_assignment"
        );

    if(saved !== null){

        isVpnLockedForUser =
            saved === "true";

        return;
    }

    const percentage =
        Number(
            remoteConfig.vpnRequiredPercentage || 0
        );

    const roll =
        Math.random() * 100;

    isVpnLockedForUser =
        roll <= percentage;

    localStorage.setItem(
        "origen_vpn_assignment",
        isVpnLockedForUser
    );

}
```
# UPDATED script.js — PART 2

Paste THIS directly UNDER Part 1 inside the SAME `script.js` file.

```javascript id="vx7eq9"
/* ================================================= */
/* VPN OVERLAY */
/* ================================================= */

function showVpnOverlay(){

    vpnOverlay.classList.remove("hidden");

    taskBox.innerHTML = "";

}

function hideVpnOverlay(){

    vpnOverlay.classList.add("hidden");

}

/* ================================================= */
/* VISIBILITY LISTENER */
/* ================================================= */

function setupVisibilityListener(){

    document.addEventListener(
        "visibilitychange",
        () => {

            if(document.hidden){

                if(isVpnLockedForUser){

                    console.log(
                        "VPN behavior completed."
                    );

                    hideVpnOverlay();

                    isVpnLockedForUser = false;

                    localStorage.setItem(
                        "origen_vpn_assignment",
                        "false"
                    );

                    renderTasks();

                    setTimeout(() => {

                        showModal(
                            "✅",
                            "Global Route Confirmed",
                            "Your premium mining tasks have been unlocked.",
                            "Continue"
                        );

                    }, 300);

                }

            }

        }
    );

}

/* ================================================= */
/* RENDER TASKS */
/* ================================================= */

function renderTasks(){

    taskBox.innerHTML = "";

    const tasks =
        remoteConfig.tasks || [];

    if(tasks.length === 0){

        taskBox.innerHTML = `

            <div class="task-card">

                <h3>
                    No Tasks Available
                </h3>

                <p>
                    New mining quests will appear soon.
                </p>

            </div>

        `;

        return;
    }

    tasks.forEach(task => {

        const reward =
            task.rewardCoins ||
            task.reward ||
            0;

        const duration =
            task.duration || 60;

        const url =
            task.videoUrl ||
            task.url ||
            "#";

        const card =
            document.createElement("div");

        card.className =
            "task-card";

        card.innerHTML = `

            <h3>
                ${task.title}
            </h3>

            <p>
                Watch the premium stream and complete the timer to unlock rewards.
            </p>

            <div class="reward-tag">
                +${reward.toLocaleString()} Origen Coins
            </div>

            <button
                class="task-btn"
                data-level="${task.level}"
            >
                Watch Now
            </button>

        `;

        const button =
            card.querySelector(".task-btn");

        /* ========================= */
        /* TIMER RESTORE */
        /* ========================= */

        const savedEnd =
            localStorage.getItem(
                "origen_timer_end_" +
                task.level
            );

        if(savedEnd){

            const remaining =
                Math.floor(
                    (
                        Number(savedEnd) -
                        Date.now()
                    ) / 1000
                );

            if(remaining > 0){

                startTaskCountdown(
                    button,
                    remaining,
                    task
                );

            }

        }

        button.addEventListener(
            "click",
            () => {

                if(currentTaskRunning){
                    return;
                }

                startTask(
                    task,
                    button,
                    url,
                    duration
                );

            }
        );

        taskBox.appendChild(card);

    });

}

/* ================================================= */
/* START TASK */
/* ================================================= */

function startTask(
    task,
    button,
    url,
    duration
){

    currentTaskRunning = true;

    currentTask = task;

    taskEndTimestamp =
        Date.now() +
        (duration * 1000);

    localStorage.setItem(
        "origen_timer_end_" + task.level,
        taskEndTimestamp
    );

    window.open(
        url,
        "_blank"
    );

    startTaskCountdown(
        button,
        duration,
        task
    );

}

/* ================================================= */
/* TIMER */
/* ================================================= */

function startTaskCountdown(
    button,
    seconds,
    task
){

    button.disabled = true;

    clearInterval(currentTaskTimer);

    currentTaskTimer =
        setInterval(async () => {

            const end =
                Number(
                    localStorage.getItem(
                        "origen_timer_end_" +
                        task.level
                    )
                );

            const remaining =
                Math.floor(
                    (
                        end -
                        Date.now()
                    ) / 1000
                );

            if(remaining <= 0){

                clearInterval(
                    currentTaskTimer
                );

                localStorage.removeItem(
                    "origen_timer_end_" +
                    task.level
                );

                button.innerText =
                    "Reward Granted";

                button.style.opacity =
                    "0.7";

                await rewardTask(task);

                return;
            }

            const minutes =
                Math.floor(
                    remaining / 60
                );

            const secs =
                remaining % 60;

            button.innerText =
                `Watching ${minutes}:${secs
                    .toString()
                    .padStart(2, "0")}`;

        }, 1000);

}

/* ================================================= */
/* TASK REWARD */
/* ================================================= */

async function rewardTask(task){

    const reward =
        Number(
            task.rewardCoins ||
            task.reward ||
            0
        );

    userCoins += reward;

    userTapCount = 0;

    miningLocked = false;

    currentTaskRunning = false;

    updateUI();

    await saveUserData();

    showModal(
        "🎉",
        "Reward Granted",
        `You received ${reward.toLocaleString()} Origen Coins and your mining energy has been restored.`,
        "Continue"
    );

}

/* ================================================= */
/* SAVE USER */
/* ================================================= */

async function saveUserData(){

    if(!currentUser){
        return;
    }

    try{

        await supabaseClient
            .from("users")
            .update({

                coin_balance:
                    userCoins,

                tap_count:
                    userTapCount

            })
            .eq(
                "id",
                currentUser.id
            );

    }catch(error){

        console.error(
            "Save Error:",
            error
        );

    }

}

/* ================================================= */
/* SAVE DEBOUNCE */
/* ================================================= */

let saveDebounceTimeout = null;

function debounceCloudSave(){

    clearTimeout(
        saveDebounceTimeout
    );

    saveDebounceTimeout =
        setTimeout(async () => {

            await saveUserData();

        }, 3000);

}

/* ================================================= */
/* LEADERBOARD */
/* ================================================= */

async function loadLeaderboard(){

    try{

        const {
            data,
            error
        } =
            await supabaseClient
            .from("users")
            .select("*")
            .order(
                "coin_balance",
                {
                    ascending:false
                }
            )
            .limit(20);

        if(error){
            throw error;
        }

        leaderboardList.innerHTML = "";

        data.forEach(
            (user,index) => {

                const li =
                    document.createElement("li");

                li.innerHTML = `

                    <span>
                        #${index + 1}
                        ${user.full_name}
                    </span>

                    <strong>
                        ${Number(
                            user.coin_balance || 0
                        ).toLocaleString()}
                    </strong>

                `;

                leaderboardList.appendChild(li);

            }
        );

    }catch(error){

        console.error(
            "Leaderboard Error:",
            error
        );

    }

}

/* ================================================= */
/* MODAL */
/* ================================================= */

function showModal(
    icon,
    title,
    message,
    buttonText,
    callback = null
){

    modalIcon.innerText =
        icon;

    modalTitle.innerText =
        title;

    modalMessage.innerText =
        message;

    modalButton.innerText =
        buttonText;

    globalModal.classList.remove(
        "hidden"
    );

    modalButton.onclick =
        () => {

            globalModal.classList.add(
                "hidden"
            );

            if(callback){
                callback();
            }

        };

}

/* ================================================= */
/* TIMER RESTORE */
/* ================================================= */

function restoreExistingTaskTimer(){

    const keys =
        Object.keys(localStorage);

    const timerKeys =
        keys.filter(key =>
            key.startsWith(
                "origen_timer_end_"
            )
        );

    if(timerKeys.length > 0){

        miningLocked = true;

    }

}

/* ================================================= */
/* AUTO CLOUD SAVE */
/* ================================================= */

setInterval(
    async () => {

        if(currentUser){

            await saveUserData();

        }

    },
    30000
);

console.log(
    "Origen Coin Script Loaded Successfully"
);
```
