(() => {
  const PROCESSED_ATTR = "data-giftap-attached";

  function findTargetMediaUrl(container) {
    const video = container.querySelector("video");
    if (video) {
      const src = video.currentSrc || video.src || video.querySelector("source")?.src;
      if (src && !src.startsWith("blob:")) {
        return src;
      }
    }

    const article = container.closest("article");
    if (article) {
      const statusLink = article.querySelector('a[href*="/status/"]');
      if (statusLink && statusLink.href) {
        return statusLink.href;
      }
    }

    return window.location.href;
  }

  function findTweetTitle(container) {
    const article = container.closest("article");
    if (!article) return "X GIF";
    const textEl = article.querySelector('[data-testid="tweetText"]');
    const text = textEl?.textContent?.trim() || "";
    return text ? text.slice(0, 80) : "X GIF";
  }

  function injectButton(container) {
    if (container.getAttribute(PROCESSED_ATTR) === "true") return;
    const video = container.querySelector("video");
    if (!video) return;

    container.setAttribute(PROCESSED_ATTR, "true");

    const computedPos = window.getComputedStyle(container).position;
    if (computedPos === "static") {
      container.style.position = "relative";
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Send with GifTap";
    btn.title = "Open this GIF in GifTap";
    Object.assign(btn.style, {
      position: "absolute",
      top: "10px",
      right: "10px",
      zIndex: "9999",
      padding: "6px 12px",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.18)",
      backgroundColor: "#000000",
      color: "#D4FF00",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "12px",
      fontWeight: "700",
      cursor: "pointer",
      opacity: "0",
      transition: "opacity 150ms ease, transform 150ms ease",
      boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
    });

    container.addEventListener("mouseenter", () => {
      btn.style.opacity = "1";
    });
    container.addEventListener("mouseleave", () => {
      btn.style.opacity = "0";
    });

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const targetUrl = findTargetMediaUrl(container);
      const title = findTweetTitle(container);
      chrome.runtime.sendMessage({
        type: "GIFTAP_OPEN_SHARE",
        url: targetUrl,
        title,
      });
    });

    container.appendChild(btn);
  }

  function scanTimeline() {
    const candidates = document.querySelectorAll(
      '[data-testid="videoComponent"], [data-testid="tweetPhoto"]'
    );
    candidates.forEach(injectButton);
  }

  scanTimeline();
  const observer = new MutationObserver(() => scanTimeline());
  observer.observe(document.body, { childList: true, subtree: true });
})();
