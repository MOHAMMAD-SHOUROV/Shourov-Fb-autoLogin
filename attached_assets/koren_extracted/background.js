'use strict';

// ── Page type detection (runs in background, popup-independent) ──
function detectInBg(tabId, cb) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function() {
      var url = location.href;
      var bodyText = '';
      try { bodyText = (document.body.innerText || '').toLowerCase(); } catch(e) {}

      var tfaUrl = ['two_step','authenticator','two-factor','two_factor','login/two','identity','approvals_required','mfa','otp','verify_id'];
      for (var u = 0; u < tfaUrl.length; u++) { if (url.includes(tfaUrl[u])) return 'twofa'; }

      var tfaTxt = ['authentication app','6-digit','two-factor','two factor','verification code','enter the code','enter code','approvals code','confirmation code','security code','কোড লিখুন','কোড দিন','প্রমাণীকরণ'];
      for (var t = 0; t < tfaTxt.length; t++) { if (bodyText.includes(tfaTxt[t])) return 'twofa'; }

      var tfaSels = ['input[name="approvals_code"]','input[name="mfa_code"]','input[name="code"]','input[autocomplete="one-time-code"]','input[placeholder*="code" i]','input[aria-label*="code" i]'];
      for (var i = 0; i < tfaSels.length; i++) {
        var el = document.querySelector(tfaSels[i]);
        if (el && el.type !== 'hidden' && el.offsetParent !== null) return 'twofa';
      }

      if (url.includes('checkpoint') || url.includes('approvals')) {
        var ins = document.querySelectorAll('input[type="tel"],input[type="number"],input[type="text"]');
        for (var j = 0; j < ins.length; j++) {
          if (ins[j].offsetParent !== null && !ins[j].name.match(/email|pass|user/i)) return 'twofa';
        }
        return 'checkpoint';
      }

      if (
        document.querySelector('iframe[src*="recaptcha"]') ||
        document.querySelector('iframe[title*="reCAPTCHA"]') ||
        document.querySelector('.g-recaptcha') ||
        document.querySelector('[data-sitekey]') ||
        document.querySelector('div.recaptcha-checkbox-border')
      ) return 'recaptcha';

      if (url.includes('captcha') || url.includes('integrity')) return 'checkpoint';
      if (url.includes('/login') || url.match(/facebook\.com\/login/)) return 'unknown';

      if (url.match(/facebook\.com/)) {
        var tfaStill = document.querySelector('input[placeholder="Code"]') || bodyText.includes('6-digit');
        if (tfaStill) return 'twofa';
        var home = document.querySelector('[aria-label="Home"]') ||
                   document.querySelector('[data-pagelet="LeftRail"]') ||
                   document.querySelector('[role="feed"]') ||
                   document.querySelector('[aria-label="News Feed"]');
        if (home) return 'success';
      }
      return 'unknown';
    }
  }, function(results) {
    if (chrome.runtime.lastError) { cb('unknown'); return; }
    var r = results && results[0] && results[0].result;
    cb(r || 'unknown');
  });
}

function notifyPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(function() {});
}

function storePageType(pageType, tabId) {
  chrome.storage.session.set({ pendingPageType: { pageType: pageType, tabId: tabId, ts: Date.now() } });
}

// ── Auto-fill login form from background ─────────────────────────
function autoFillLogin(tabId, uid, pass, secret) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function(email, pw) {
      function setVal(el, val) {
        try {
          var d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
          if (d && d.set) d.set.call(el, val); else el.value = val;
        } catch(e) { el.value = val; }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      }
      var emailEl = document.querySelector('input[name="email"]') || document.getElementById('email');
      var passEl  = document.querySelector('input[name="pass"]')  || document.getElementById('pass');
      if (!emailEl || !passEl) return 'not_found';
      emailEl.focus(); setVal(emailEl, email);
      setTimeout(function() {
        passEl.focus(); setVal(passEl, pw);
        setTimeout(function() {
          var btn = document.querySelector('[data-testid="royal_login_button"]') ||
                    document.querySelector('button[name="login"]') ||
                    document.querySelector('button[type="submit"]') ||
                    document.querySelector('input[type="submit"]');
          if (btn) btn.click();
        }, 400);
      }, 250);
      return 'filled';
    },
    args: [uid, pass]
  }, function() {
    if (chrome.runtime.lastError) return;
    // Save session and start alarm polling
    chrome.storage.session.set({
      loginSession: { active: true, uid: uid, pass: pass, secret: secret, tabId: tabId }
    });
    chrome.alarms.clear('loginPoll', function() {
      chrome.alarms.create('loginPoll', { periodInMinutes: 0.034 });
    });
    notifyPopup({ type: 'AUTO_LOGIN_STARTED', tabId: tabId, uid: uid, pass: pass, secret: secret });
  });
}

// ── Tab navigation: fires when Facebook tab fully loads ──────────
chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
  if (info.status !== 'complete') return;
  if (!tab || !tab.url) return;

  var url = tab.url;
  var isFbLoginPage = (
    url.includes('facebook.com/login') ||
    url.match(/^https:\/\/(www\.)?facebook\.com\/?(\?.*)?$/)
  );

  chrome.storage.session.get(['loginSession'], function(sessionData) {
    var activeSession = sessionData.loginSession;

    // ── Auto-login: no active session, on login page, creds saved ──
    if (isFbLoginPage && (!activeSession || !activeSession.active)) {
      chrome.storage.local.get(['savedCreds'], function(data) {
        if (!data.savedCreds) return;
        setTimeout(function() {
          autoFillLogin(tabId, data.savedCreds.uid, data.savedCreds.pass, data.savedCreds.secret);
        }, 400);
      });
      return;
    }

    // ── Session active: detect page type and relay ──────────────────
    if (!activeSession || !activeSession.active || activeSession.tabId !== tabId) return;
    setTimeout(function() {
      detectInBg(tabId, function(type) {
        notifyPopup({ type: 'PAGE_TYPE', pageType: type, tabId: tabId });
        storePageType(type, tabId);
      });
    }, 700);
  });
});

// ── Alarm-based polling (survives popup close) ───────────────────
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name !== 'loginPoll') return;
  chrome.storage.session.get(['loginSession'], function(data) {
    var s = data.loginSession;
    if (!s || !s.active) { chrome.alarms.clear('loginPoll'); return; }
    detectInBg(s.tabId, function(type) {
      if (type === 'unknown') return;
      notifyPopup({ type: 'PAGE_TYPE', pageType: type, tabId: s.tabId });
      storePageType(type, s.tabId);
    });
  });
});

// ── Messages from popup ──────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, respond) {
  if (msg.type === 'START_POLL') {
    chrome.alarms.clear('loginPoll', function() {
      chrome.alarms.create('loginPoll', { periodInMinutes: 0.034 });
    });
    respond({ ok: true });
  } else if (msg.type === 'STOP_POLL') {
    chrome.alarms.clear('loginPoll');
    chrome.storage.session.remove(['loginSession', 'pendingPageType']);
    respond({ ok: true });
  }
  return true;
});
