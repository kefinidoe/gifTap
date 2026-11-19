const DEFAULT_GIFTAP_URL = "__GIFTAP_URL__";

const input = document.getElementById("appUrl");
const saveBtn = document.getElementById("saveBtn");
const openBtn = document.getElementById("openBtn");
const statusEl = document.getElementById("status");

function fallbackUrl() {
  return DEFAULT_GIFTAP_URL.startsWith("http")
    ? DEFAULT_GIFTAP_URL.replace(/\/+$/, "")
    : "http://localhost:3000";
}

chrome.storage.sync.get(["giftapUrl"], (res) => {
  input.value = res.giftapUrl || fallbackUrl();
});

saveBtn.addEventListener("click", () => {
  const val = input.value.trim().replace(/\/+$/, "") || fallbackUrl();
  chrome.storage.sync.set({ giftapUrl: val }, () => {
    statusEl.textContent = "Saved!";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 1200);
  });
});

openBtn.addEventListener("click", () => {
  const val = input.value.trim().replace(/\/+$/, "") || fallbackUrl();
  chrome.tabs.create({ url: val });
});
