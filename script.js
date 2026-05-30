/* ================================================= */
/* CONFIG */
/* ================================================= */

const SUPABASE_URL =
"https://puaggevlswqumummsokw.supabase.co";

const SUPABASE_KEY =
"YOUR_ANON_KEY_HERE";

const GITHUB_CONFIG =
"https://raw.githubusercontent.com/Natinav/origen-config/refs/heads/main/config.json";

const supabase =
window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* ================================================= */
/* STATE */
/* ================================================= */

let config = {
    coinValue: 0.05,
    vpnRequiredPercentage: 100,
    tasks:[]
};

let currentUser = null;

let coins = 0;

let taps = 0;

let miningLocked = false;

/* ================================================= */
/* ELEMENTS */
/* ================================================= */

const loginScreen =
document.getElementById("login-screen");

const app =
document.getElementById("app-container");

const loginBtn =
document.getElementById("login-btn");

const coinBtn =
document.getElementById("tap-coin");

const balanceText =
document.getElementById("coin-balance-display");

const progressFill =
document.getElementById("progress-fill");

const tapCounter =
document.getElementById("tap-counter");

const taskBox =
document.getElementById("task-box");

const vpnOverlay =
document.getElementById("vpn-overlay");

/* ================================================= */
/* INIT */
/* ================================================= */

window.onload = async () => {

    await loadConfig();

    setupTabs();

    setupVpnListener();

};

/* ================================================= */
/* LOAD CONFIG */
/* ================================================= */

async function loadConfig(){

    try{

        const res =
        await fetch(
            GITHUB_CONFIG +
            "?t=" +
            Date.now()
        );

        config =
        await res.json();

    }catch(err){

        console.log(err);

    }

}

/* ================================================= */
/* LOGIN */
/* ================================================= */

loginBtn.onclick = async () => {

    const name =
    document.getElementById("login-name")
    .value
    .trim();

    const phone =
    document.getElementById("login-phone")
    .value
    .trim();

    if(!name || !phone){

        alert("Enter name and phone");

        return;
    }

    loginBtn.innerText =
    "Connecting...";

    try{

        const {data} =
        await supabase
        .from("users")
        .select("*")
        .eq("phone_number", phone)
        .maybeSingle();

        /* EXISTING USER */

        if(data){

            currentUser = data;

            coins =
            data.coin_balance || 0;

            taps =
            data.tap_count || 0;

        }

        /* NEW USER */

        else{

            const newUser = {

                phone_number: phone,

                name: name,

                coin_balance:0,

                money_balance:0,

                tap_count:0

            };

            const {data:inserted} =
            await supabase
            .from("users")
            .insert(newUser)
            .select()
            .single();

            currentUser = inserted;

        }

        openApp();

    }catch(err){

        console.log(err);

        alert("Connection Failed");

    }

    loginBtn.innerText =
    "Enter Mining Hub";

};

/* ================================================= */
/* OPEN APP */
/* ================================================= */

function openApp(){

    loginScreen.classList.add("hidden");

    app.classList.remove("hidden");

    document.getElementById(
        "user-display-name"
    ).innerText =
    currentUser.name;

    document.getElementById(
        "acc-name"
    ).innerText =
    currentUser.name;

    document.getElementById(
        "acc-phone"
    ).innerText =
    currentUser.phone_number;

    updateUI();

    loadLeaderboard();

}

/* ================================================= */
/* UPDATE UI */
/* ================================================= */

function updateUI(){

    balanceText.innerText =
    coins.toLocaleString();

    tapCounter.innerText =
    taps;

    const percent =
    Math.min((taps / 500) * 100,100);

    progressFill.style.width =
    percent + "%";

    document.getElementById(
        "acc-coins"
    ).innerText =
    coins;

    const money =
    (
        coins *
        Number(config.coinValue || 0)
    ).toFixed(2);

    document.getElementById(
        "acc-money"
    ).innerText =
    money;

}

/* ================================================= */
/* COIN CLICK */
/* ================================================= */

coinBtn.onclick = async (e) => {

    if(miningLocked) return;

    coins++;

    taps++;

    updateUI();

    floatingText(e);

    if(taps >= 500){

        miningLocked = true;

        await saveUser();

        showModal(
            "⚡",
            "500 Taps Reached",
            "Complete tasks to continue mining.",
            () => {
                openTasks();
            }
        );

    }

    debounceSave();

};

/* ================================================= */
/* FLOATING TEXT */
/* ================================================= */

function floatingText(e){

    const div =
    document.createElement("div");

    div.className =
    "floating-hit-text";

    div.innerText =
    "+1";

    const rect =
    coinBtn.getBoundingClientRect();

    div.style.left =
    (e.clientX - rect.left) + "px";

    div.style.top =
    (e.clientY - rect.top) + "px";

    document.getElementById(
        "coin-stage"
    ).appendChild(div);

    setTimeout(() => {

        div.remove();

    },800);

}

/* ================================================= */
/* SAVE USER */
/* ================================================= */

async function saveUser(){

    if(!currentUser) return;

    const money =
    (
        coins *
        Number(config.coinValue || 0)
    );

    await supabase
    .from("users")
    .update({

        coin_balance:coins,

        money_balance:money,

        tap_count:taps

    })
    .eq(
        "phone_number",
        currentUser.phone_number
    );

}

/* ================================================= */
/* SAVE DEBOUNCE */
/* ================================================= */

let saveTimeout;

function debounceSave(){

    clearTimeout(saveTimeout);

    saveTimeout =
    setTimeout(async () => {

        await saveUser();

    },2000);

}

/* ================================================= */
/* TASKS */
/* ================================================= */

function openTasks(){

    switchTab("tasks-screen");

    const vpnPercent =
    Number(config.vpnRequiredPercentage || 0);

    const roll =
    Math.random() * 100;

    const needsVpn =
    roll <= vpnPercent;

    if(needsVpn){

        vpnOverlay.classList.remove(
            "hidden"
        );

    }else{

        renderTasks();

    }

}

/* ================================================= */
/* VPN LISTENER */
/* ================================================= */

function setupVpnListener(){

    document.addEventListener(
        "visibilitychange",
        () => {

            if(document.hidden){

                if(
                    !vpnOverlay.classList.contains(
                        "hidden"
                    )
                ){

                    vpnOverlay.classList.add(
                        "hidden"
                    );

                    renderTasks();

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

    config.tasks.forEach(task => {

        const card =
        document.createElement("div");

        card.className =
        "task-card";

        card.innerHTML = `

            <h3>${task.title}</h3>

            <p>
            Watch video to earn reward
            </p>

            <div class="reward-tag">
            +${task.rewardCoins}
            Origen Coins
            </div>

            <button class="task-btn">
            Start Task
            </button>

        `;

        const btn =
        card.querySelector(".task-btn");

        const savedEnd =
        localStorage.getItem(
            "task_" + task.level
        );

        if(savedEnd){

            startTimer(
                btn,
                task,
                Number(savedEnd)
            );

        }

        btn.onclick = () => {

            const end =
            Date.now() +
            (task.duration * 1000);

            localStorage.setItem(
                "task_" + task.level,
                end
            );

            window.open(
                task.videoUrl,
                "_blank"
            );

            startTimer(
                btn,
                task,
                end
            );

        };

        taskBox.appendChild(card);

    });

}

/* ================================================= */
/* TASK TIMER */
/* ================================================= */

function startTimer(btn,task,end){

    btn.disabled = true;

    const interval =
    setInterval(async () => {

        const remain =
        Math.floor(
            (end - Date.now()) / 1000
        );

        if(remain <= 0){

            clearInterval(interval);

            localStorage.removeItem(
                "task_" + task.level
            );

            coins +=
            Number(task.rewardCoins);

            taps = 0;

            miningLocked = false;

            updateUI();

            await saveUser();

            btn.innerText =
            "Reward Claimed";

            showModal(
                "🎉",
                "Reward Granted",
                `+${task.rewardCoins} Coins Added`
            );

            return;
        }

        const min =
        Math.floor(remain / 60);

        const sec =
        remain % 60;

        btn.innerText =
        `${min}:${sec
            .toString()
            .padStart(2,"0")}`;

    },1000);

}

/* ================================================= */
/* LEADERBOARD */
/* ================================================= */

async function loadLeaderboard(){

    const {data} =
    await supabase
    .from("users")
    .select("*")
    .order(
        "coin_balance",
        {ascending:false}
    )
    .limit(20);

    const list =
    document.getElementById(
        "leaderboard-list"
    );

    list.innerHTML = "";

    data.forEach((user,index) => {

        const li =
        document.createElement("li");

        li.innerHTML = `

            <span>
            #${index+1}
            ${user.name}
            </span>

            <strong>
            ${user.coin_balance}
            </strong>

        `;

        list.appendChild(li);

    });

}

/* ================================================= */
/* MODAL */
/* ================================================= */

function showModal(
    icon,
    title,
    message,
    callback = null
){

    document.getElementById(
        "modal-icon"
    ).innerText =
    icon;

    document.getElementById(
        "modal-title"
    ).innerText =
    title;

    document.getElementById(
        "modal-message"
    ).innerText =
    message;

    const modal =
    document.getElementById(
        "global-modal"
    );

    modal.classList.remove("hidden");

    document.getElementById(
        "modal-btn"
    ).onclick = () => {

        modal.classList.add(
            "hidden"
        );

        if(callback){
            callback();
        }

    };

}

/* ================================================= */
/* TABS */
/* ================================================= */

function setupTabs(){

    document.querySelectorAll(
        ".nav-btn"
    ).forEach(btn => {

        btn.onclick = () => {

            switchTab(
                btn.dataset.target
            );

        };

    });

}

function switchTab(id){

    document.querySelectorAll(
        ".app-section"
    ).forEach(sec => {

        sec.classList.add("hidden");

    });

    document.getElementById(id)
    .classList.remove("hidden");

}

/* ================================================= */
/* AUTO SAVE */
/* ================================================= */

setInterval(async () => {

    if(currentUser){

        await saveUser();

    }

},30000);
