const DEFAULT_GIFTAP_URL = "__GIFTAP_URL__";

async function getAppBaseUrl() {
  try {
    const stored = await chrome.storage.sync.get(["giftapUrl"]);
    if (stored.giftapUrl && typeof stored.giftapUrl === "string") {
      return stored.giftapUrl.replace(/\/+$/, "");
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_GIFTAP_URL.startsWith("http")
    ? DEFAULT_GIFTAP_URL.replace(/\/+$/, "")
    : "http://localhost:3000";
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "giftap-send-media",
    title: "Send this GIF with GifTap",
    contexts: ["video", "image", "link", "page"],
    documentUrlPatterns: ["*://x.com/*", "*://twitter.com/*"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "giftap-send-media") return;

  const targetUrl = info.srcUrl || info.linkUrl || info.pageUrl || tab?.url || "";
  if (!targetUrl) return;

  const baseUrl = await getAppBaseUrl();
  const shareUrl = `${baseUrl}/share?url=${encodeURIComponent(targetUrl)}`;
  chrome.tabs.create({ url: shareUrl });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "GIFTAP_OPEN_SHARE" && message.url) {
    getAppBaseUrl().then((baseUrl) => {
      const shareUrl = `${baseUrl}/share?url=${encodeURIComponent(message.url)}&title=${encodeURIComponent(message.title || "")}`;
      chrome.tabs.create({ url: shareUrl });
    });
  }
});
