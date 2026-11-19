(function (global) {
  'use strict';

  var currentScript = document.currentScript;
  var inferredOrigin = (function () {
    if (currentScript && currentScript.src) {
      try {
        return new URL(currentScript.src).origin;
      } catch (e) {}
    }
    return window.location.origin;
  })();

  var STYLE_ID = 'giftap-embed-sdk-styles';
  var activeOverlay = null;
  var activeCallback = null;
  var listenerBound = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.giftap-sdk-backdrop{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.82);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;padding:0;}' +
      '@media(min-width:640px){.giftap-sdk-backdrop{align-items:center;padding:24px;}}' +
      '.giftap-sdk-frame-wrap{width:100%;max-width:520px;height:78vh;max-height:680px;background:#000;border:1px solid rgba(255,255,255,0.12);border-radius:24px 24px 0 0;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.75);}' +
      '@media(min-width:640px){.giftap-sdk-frame-wrap{border-radius:24px;height:600px;}}' +
      '.giftap-sdk-iframe{width:100%;height:100%;border:0;display:block;background:#000;}';
    document.head.appendChild(style);
  }

  function bindGlobalMessageListener() {
    if (listenerBound) return;
    listenerBound = true;
    window.addEventListener('message', function (event) {
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'giftap:select' && data.gif) {
        if (typeof activeCallback === 'function') {
          try {
            activeCallback(data.gif);
          } catch (err) {}
        }
        closePicker();
      } else if (data.type === 'giftap:close') {
        closePicker();
      }
    });
  }

  function closePicker() {
    if (activeOverlay && activeOverlay.parentNode) {
      activeOverlay.parentNode.removeChild(activeOverlay);
    }
    activeOverlay = null;
    activeCallback = null;
  }

  function buildEmbedUrl(options) {
    var base = (options && options.origin) || inferredOrigin;
    var url = new URL('/embed', base);
    if (options && options.query) {
      url.searchParams.set('q', options.query);
    }
    if (options && options.modal !== false) {
      url.searchParams.set('modal', '1');
    }
    return url.toString();
  }

  function openPicker(options) {
    options = options || {};
    ensureStyles();
    bindGlobalMessageListener();
    closePicker();

    activeCallback = typeof options.onSelect === 'function' ? options.onSelect : null;

    var backdrop = document.createElement('div');
    backdrop.className = 'giftap-sdk-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'GifTap Picker');

    var wrap = document.createElement('div');
    wrap.className = 'giftap-sdk-frame-wrap';

    var iframe = document.createElement('iframe');
    iframe.className = 'giftap-sdk-iframe';
    iframe.src = buildEmbedUrl(options);
    iframe.setAttribute('title', 'GifTap Picker');
    iframe.setAttribute('allow', 'clipboard-write');

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) {
        closePicker();
      }
    });

    wrap.appendChild(iframe);
    backdrop.appendChild(wrap);
    document.body.appendChild(backdrop);
    activeOverlay = backdrop;
  }

  function mount(target, options) {
    options = options || {};
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return null;

    var iframe = document.createElement('iframe');
    iframe.src = buildEmbedUrl({
      origin: options.origin,
      query: options.query,
      modal: false,
    });
    iframe.style.width = '100%';
    iframe.style.height = options.height || '480px';
    iframe.style.border = '1px solid rgba(255,255,255,0.1)';
    iframe.style.borderRadius = '16px';
    iframe.style.background = '#000';
    iframe.setAttribute('title', 'GifTap Embedded Widget');
    iframe.setAttribute('allow', 'clipboard-write');

    var onMessage = function (event) {
      if (event.source !== iframe.contentWindow) return;
      var data = event.data;
      if (data && data.type === 'giftap:select' && data.gif && typeof options.onSelect === 'function') {
        options.onSelect(data.gif);
      }
    };
    window.addEventListener('message', onMessage);
    el.innerHTML = '';
    el.appendChild(iframe);

    return {
      iframe: iframe,
      destroy: function () {
        window.removeEventListener('message', onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      },
    };
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('[data-giftap-picker]') : null;
    if (!trigger) return;
    event.preventDefault();
    var query = trigger.getAttribute('data-giftap-query') || '';
    var targetSelector = trigger.getAttribute('data-giftap-target') || '';
    openPicker({
      query: query,
      onSelect: function (gif) {
        if (targetSelector) {
          var targetInput = document.querySelector(targetSelector);
          if (targetInput && 'value' in targetInput) {
            targetInput.value = gif.mp4Url || gif.webpUrl || gif.url;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        trigger.dispatchEvent(new CustomEvent('giftap:select', { bubbles: true, detail: gif }));
      },
    });
  });

  global.GifTap = {
    openPicker: openPicker,
    close: closePicker,
    mount: mount,
  };
})(window);
