// App State
let cardBalance = 100.0;
let realNfcActive = false;
let gateResetTimer = null;

const stations = [
  "Govindpuri",
  "Lajpat Nagar",
  "Hauz Khas",
  "Rajiv Chowk",
  "Kashmere Gate"
];

const tripHistory = [
  { route: "Lajpat Nagar → Rajiv Chowk", fare: 27, time: "Yesterday, 6:15 PM" }
];

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  updateBalanceUI();
  updateFareEstimate();
  renderTrips();

  appendBotMessage(
    "Namaste! 👋 Welcome to <b>DMRC Official Transit Bot</b>.<br>Manage your Virtual NFC Metro Card or book instant QR tickets—no station queues or AVM machine sync needed!"
  );
});

// Mobile View Switcher & Phone Tabs
function setupNavigation() {
  document.querySelectorAll(".switch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".switch-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const view = btn.dataset.view;
      document.getElementById("phonePanel").classList.toggle("active-view", view === "phone");
      document.getElementById("gatePanel").classList.toggle("active-view", view === "gate");
    });
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const targetTab = btn.dataset.tab;
      document.querySelectorAll(".tab-content").forEach((tab) => {
        tab.classList.toggle("active", tab.id === targetTab);
      });
    });
  });
}

// WhatsApp Chat Helpers
function appendUserMessage(text) {
  const chat = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "msg user";
  div.innerHTML = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function appendBotMessage(html) {
  const chat = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "msg bot";
  div.innerHTML = html;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// WhatsApp Bot Interactive Actions
function handleBotAction(action, amount = 0) {
  if (action === "balance") {
    appendUserMessage("Check Virtual Card Balance");
    setTimeout(() => {
      appendBotMessage(
        `💳 <b>Virtual NCMC Card:</b> •••• 8921<br>💰 <b>Available Balance:</b> ₹${cardBalance.toFixed(2)}<br><span class="sync-badge">✓ Ready for Tap & Go</span>`
      );
    }, 300);
  } else if (action === "recharge") {
    appendUserMessage(`Recharge ₹${amount} via UPI`);
    setTimeout(() => {
      cardBalance += amount;
      updateBalanceUI();
      appendBotMessage(
        `✅ <b>UPI Payment of ₹${amount} Successful!</b><br>New Card Balance: <b>₹${cardBalance.toFixed(2)}</b><br><span class="sync-badge">⚡ Instant Sync Complete: No Station AVM Tap Needed!</span>`
      );
    }, 450);
  } else if (action === "qr") {
    const entry = stations[document.getElementById("entryStation").value];
    const exit = stations[document.getElementById("exitStation").value];
    const fare = calculateSmartFare().base;
    appendUserMessage(`Book Single QR Ticket (${entry} to ${exit})`);
    setTimeout(() => {
      appendBotMessage(
        `🎟️ <b>Single Journey QR Ticket</b><br>${entry} → ${exit} (Paid ₹${fare})
        <div class="qr-box">
          <div class="qr-grid"></div>
          <small>Scan at AFC QR Reader • Valid 60 mins</small>
        </div>`
      );
    }, 450);
  }
}

// Fare Calculator (10% Smart Card Discount)
function calculateSmartFare() {
  const s1 = parseInt(document.getElementById("entryStation").value, 10);
  const s2 = parseInt(document.getElementById("exitStation").value, 10);
  const stops = Math.abs(s1 - s2);
  const base = stops === 0 ? 10 : 10 + stops * 10;
  const discounted = Math.round(base * 0.9);
  return { base, discounted };
}

function updateFareEstimate() {
  const { base, discounted } = calculateSmartFare();
  document.getElementById("baseFareText").textContent = `₹${base}`;
  document.getElementById("finalFareText").textContent = `₹${discounted}`;
}

// Real Android Chrome Web NFC API with Safe Fallback
async function toggleRealNFC() {
  const statusText = document.getElementById("nfcStatusText");
  const btn = document.getElementById("enableNfcBtn");
  const topPill = document.getElementById("topNfcIndicator");

  if (!("NDEFReader" in window)) {
    statusText.textContent = "Web NFC unsupported on this browser — Simulation Mode Active";
    btn.textContent = "Simulated";
    return;
  }

  try {
    const ndef = new NDEFReader();
    await ndef.scan();
    realNfcActive = true;
    statusText.textContent = "Hardware NFC Sensor Listening — Tap metro reader!";
    btn.textContent = "NFC Active";
    btn.style.background = "#10b981";
    topPill.textContent = "Hardware NFC ON";

    ndef.onreading = () => {
      triggerGateTap();
    };
  } catch (error) {
    statusText.textContent = "Permission denied or HTTPS required — Simulation Mode Active";
  }
}

// AFC Gate Tap Execution 
function triggerGateTap() {
  const entry = stations[document.getElementById("entryStation").value];
  const exit = stations[document.getElementById("exitStation").value];
  const { discounted } = calculateSmartFare();

  const screen = document.getElementById("gateScreen");
  const icon = document.getElementById("gateIcon");
  const title = document.getElementById("gateTitle");
  const subtitle = document.getElementById("gateSubtitle");
  const meta = document.getElementById("gateMeta");
  const rechargeBtn = document.getElementById("gateRechargeBtn");

  // Switch mobile view to Gate so user sees the result immediately
  if (window.innerWidth <= 860) {
    document.querySelector('[data-view="gate"]').click();
  }

  clearTimeout(gateResetTimer);

  if (cardBalance >= discounted) {
    cardBalance -= discounted;
    updateBalanceUI();
    playGateBeep(true);

    screen.className = "gate-screen state-open";
    icon.textContent = "✅";
    title.textContent = "GATE OPEN • HAPPY JOURNEY";
    subtitle.textContent = `${entry} → ${exit}`;
    meta.textContent = `Fare Deducted: ₹${discounted} | Remaining: ₹${cardBalance.toFixed(2)}`;
    rechargeBtn.classList.add("hidden");

    tripHistory.unshift({
      route: `${entry} → ${exit}`,
      fare: discounted,
      time: "Just now"
    });
    renderTrips();
  } else {
    playGateBeep(false);
    screen.className = "gate-screen state-error";
    icon.textContent = "⛔";
    title.textContent = "INSUFFICIENT BALANCE";
    subtitle.textContent = `Required: ₹${discounted} | Available: ₹${cardBalance.toFixed(2)}`;
    meta.textContent = "Recharge instantly on WhatsApp—no AVM queue!";
    rechargeBtn.classList.remove("hidden");
  }

  gateResetTimer = setTimeout(() => {
    screen.className = "gate-screen state-ready";
    icon.textContent = "📡";
    title.textContent = "READY TO TAP";
    subtitle.textContent = "Bring NFC smartphone near reader";
    meta.textContent = "";
    rechargeBtn.classList.add("hidden");
  }, 4500);
}

// Jump directly to WhatsApp Tab on Low Balance
function jumpToWhatsAppRecharge() {
  if (window.innerWidth <= 860) {
    document.querySelector('[data-view="phone"]').click();
  }
  document.querySelector('[data-tab="whatsappTab"]').click();
}

// Update Balance & Trip List
function updateBalanceUI() {
  document.getElementById("cardBalanceDisplay").textContent = `₹${cardBalance.toFixed(2)}`;
}

function renderTrips() {
  const list = document.getElementById("tripHistoryList");
  list.innerHTML = tripHistory
    .slice(0, 4)
    .map(
      (t) =>
        `<li><span>${t.route} <small style="color:#9ca3af">(${t.time})</small></span><strong>-₹${t.fare}</strong></li>`
    )
    .join("");
}

// Web Audio API Confirmation Beep
function playGateBeep(success) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? "sine" : "sawtooth";
    osc.frequency.value = success ? 880 : 220;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.16 : 0.32));
  } catch (e) {
    // Ignore audio block if browser restricts autoplay
  }
}
