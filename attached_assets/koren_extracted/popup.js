(function () {
  // ── BD Clock ──────────────────────────────────────────────
  function tick() {
    var el = document.getElementById('bdClock');
    if (!el) return;
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    var bd = new Date(utc + 6 * 3600000);
    var h = bd.getHours(), m = bd.getMinutes(), s = bd.getSeconds();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    el.textContent = ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2) + ' ' + ampm;
  }
  tick();
  setInterval(tick, 1000);

  // ── TOTP / Base32 ─────────────────────────────────────────
  var B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  function base32Decode(input) {
    var clean = input.toUpperCase().replace(/\s/g, "").replace(/=+$/, "");
    var bits = 0, value = 0, idx = 0;
    var out = new Uint8Array(Math.floor((clean.length * 5) / 8));
    for (var i = 0; i < clean.length; i++) {
      var ci = B32.indexOf(clean[i]);
      if (ci === -1) continue;
      value = (value << 5) | ci;
      bits += 5;
      if (bits >= 8) { out[idx++] = (value >>> (bits - 8)) & 255; bits -= 8; }
    }
    return out.slice(0, idx);
  }

  async function generateTOTP(secret) {
    try {
      var keyBytes = base32Decode(secret);
      if (keyBytes.length === 0) return "------";
      var counter = Math.floor(Date.now() / 1000 / 30);
      var buf = new ArrayBuffer(8);
      new DataView(buf).setUint32(4, counter, false);
      var key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
      var sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
      var o = sig[sig.length - 1] & 0x0f;
      var code = (((sig[o] & 0x7f) << 24) | ((sig[o + 1] & 0xff) << 16) | ((sig[o + 2] & 0xff) << 8) | (sig[o + 3] & 0xff)) % 1000000;
      return String(code).padStart(6, "0");
    } catch (e) { return "------"; }
  }

  function secsLeft() { return 30 - (Math.floor(Date.now() / 1000) % 30); }

  // ── State ─────────────────────────────────────────────────
  var uid = "", pass = "", secret = "", totpCode = "------";
  var loading = false, done = false, autoTimer = null, loginTabId = null, pollTimer = null;
  var toastTimer = null;

  // ── DOM ───────────────────────────────────────────────────
  var comboInput   = document.getElementById("comboInput");
  var parsedRow    = document.getElementById("parsedRow");
  var pUid         = document.getElementById("pUid");
  var pPass        = document.getElementById("pPass");
  var pSecret      = document.getElementById("pSecret");
  var totpBox      = document.getElementById("totpBox");
  var totpCodeEl   = document.getElementById("totpCode");
  var countdownArc = document.getElementById("countdownArc");
  var countdownNum = document.getElementById("countdownNum");
  var progressWrap = document.getElementById("progressWrap");
  var progressFill = document.getElementById("progressFill");
  var stageLabel   = document.getElementById("stageLabel");
  var stagePct     = document.getElementById("stagePct");
  var loginBtn     = document.getElementById("loginBtn");
  var loginBtnText = document.getElementById("loginBtnText");
  var successBox   = document.getElementById("successBox");
  var usedCodeEl   = document.getElementById("usedCode");
  var toastEl      = document.getElementById("toast");

  // ── Helpers ───────────────────────────────────────────────
  function showToast(msg, color) {
    color = color || "#1877F2";
    toastEl.textContent = msg;
    toastEl.style.background = color + "e8";
    toastEl.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.display = "none"; }, 4000);
  }

  function setProgress(label, pct) {
    progressWrap.style.display = "flex";
    stageLabel.textContent = label;
    stagePct.textContent = pct + "%";
    progressFill.style.width = pct + "%";
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ── Parse input line ──────────────────────────────────────
  function parseLine(line) {
    var parts = line.split("\t");
    if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
      uid    = parts[0].replace(/\s/g, "");
      pass   = parts[1].replace(/\s/g, "");
      secret = parts.length >= 3 ? parts.slice(2).join(" ").replace(/\s/g, "") : "";
      parsedRow.style.display = "grid";
      pUid.textContent    = uid || "—";
      pPass.textContent   = pass ? "••••••" : "—";
      pSecret.textContent = secret ? secret.slice(0, 6) + "…" : "নেই";
      if (secret) { startTOTP(); } else { totpBox.style.display = "none"; }
      loginBtn.disabled = false;
      return true;
    }
    parsedRow.style.display = "none";
    totpBox.style.display   = "none";
    loginBtn.disabled = true;
    return false;
  }

  // ── TOTP display ──────────────────────────────────────────
  function startTOTP() {
    totpBox.style.display = "flex";
    generateTOTP(secret).then(function (c) { totpCode = c; totpCodeEl.textContent = c; });
    updateCountdown();
  }

  function updateCountdown() {
    var secs = secsLeft();
    var frac = secs / 30;
    var circ = 94.2;
    if (countdownArc) countdownArc.style.strokeDasharray = (frac * circ) + " " + circ;
    if (countdownNum) countdownNum.textContent = secs;
    if (secs === 30 && secret) {
      generateTOTP(secret).then(function (c) { totpCode = c; totpCodeEl.textContent = c; });
    }
  }

  // ── Polling after login attempt ───────────────────────────
  function detectPageType(tabId, cb) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        var url = location.href;
        if (url.includes('checkpoint') || url.includes('approvals')) return 'checkpoint';
        if (document.querySelector('input[name="approvals_code"]') ||
            document.querySelector('input[name="mfa_code"]')) return 'twofa';
        if (url.includes('facebook.com') && !url.includes('/login') &&
            !url.includes('checkpoint')) return 'success';
        return 'unknown';
      }
    }, function (results) {
      var r = results && results[0] && results[0].result;
      cb(r || 'unknown');
    });
  }

  function injectCheckpointClick(tabId, cb) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        var btns = Array.from(document.querySelectorAll('button,input[type="submit"],a'));
        var clicked = false;
        var keywords = ['continue','ok','confirm','approve','this was me','আমি ছিলাম'];
        for (var b of btns) {
          var txt = (b.textContent || b.value || '').toLowerCase();
          if (keywords.some(function (k) { return txt.includes(k); })) {
            b.click(); clicked = true; break;
          }
        }
        return clicked;
      }
    }, function (results) {
      cb(results && results[0] && results[0].result);
    });
  }

  function inject2FA(tabId, code, cb) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function (c) {
        function setVal(el, val) {
          try {
            var d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            if (d && d.set) d.set.call(el, val);
          } catch (e) { el.value = val; }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        var inp = document.querySelector('input[name="approvals_code"]') ||
                  document.querySelector('input[name="mfa_code"]') ||
                  document.querySelector('input[type="tel"]') ||
                  document.querySelector('input[autocomplete="one-time-code"]');
        if (!inp) return false;
        inp.focus(); setVal(inp, c);
        setTimeout(function () {
          var btn = document.querySelector('button[type="submit"]') ||
                    document.querySelector('input[type="submit"]');
          if (btn) btn.click();
        }, 300);
        return true;
      },
      args: [code]
    }, function (results) {
      cb(results && results[0] && results[0].result);
    });
  }

  function startPolling(tabId) {
    stopPoll();
    var attempts = 0;
    pollTimer = setInterval(function () {
      attempts++;
      if (attempts > 20) { stopPoll(); loading = false; showToast("Timeout — দেরি হচ্ছে", "#e53e3e"); return; }
      detectPageType(tabId, function (type) {
        if (type === 'checkpoint') {
          setProgress("CAPTCHA / Checkpoint auto-click চেষ্টা...", 60);
          injectCheckpointClick(tabId, function (clicked) {
            if (clicked) showToast("Checkpoint button ক্লিক করা হয়েছে!", "#f59e0b");
          });
        } else if (type === 'twofa') {
          stopPoll();
          setProgress("2FA কোড দেওয়া হচ্ছে...", 80);
          loginBtnText.innerHTML = '⏳ 2FA দেওয়া হচ্ছে...';
          generateTOTP(secret).then(function (newCode) {
            inject2FA(tabId, newCode, function (ok) {
              if (ok) {
                setProgress("2FA দেওয়া হয়েছে! ✅", 95);
                loginBtnText.innerHTML = '✅ 2FA সম্পন্ন!';
                usedCodeEl.textContent = "2FA: " + newCode;
                successBox.style.display = "block";
                showToast("2FA কোড " + newCode + " দেওয়া হয়েছে! ✅", "#25D366");
                loading = false; done = true;
              } else {
                startPolling(tabId);
              }
            });
          });
        } else if (type === 'success') {
          stopPoll();
          setProgress("লগইন সম্পন্ন! ✅", 100);
          loginBtnText.innerHTML = '✅ লগইন সম্পন্ন!';
          usedCodeEl.textContent = "Login Success ✅";
          successBox.style.display = "block";
          showToast("লগইন সফল! ✅", "#25D366");
          loading = false; done = true;
        }
      });
    }, 1500);
  }

  // ── Inject login form ─────────────────────────────────────
  function injectLoginForm(tabId) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function (email, pw) {
        function setVal(el, val) {
          try {
            var d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            if (d && d.set) d.set.call(el, val);
          } catch (e) { el.value = val; }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        var emailEl = document.querySelector('input[name="email"]') || document.getElementById('email');
        var passEl  = document.querySelector('input[name="pass"]')  || document.getElementById('pass');
        if (!emailEl || !passEl) return 'not_found';
        emailEl.focus(); setVal(emailEl, email);
        setTimeout(function () {
          passEl.focus(); setVal(passEl, pw);
          setTimeout(function () {
            var btn = document.querySelector('[data-testid="royal_login_button"]') ||
                      document.querySelector('button[name="login"]') ||
                      document.querySelector('button[type="submit"]') ||
                      document.querySelector('input[type="submit"]');
            if (btn) btn.click();
          }, 400);
        }, 150);
        return 'filled';
      },
      args: [uid, pass]
    }, function (results) {
      var res = results && results[0] && results[0].result;
      if (res === 'not_found') {
        showToast("Login form পাওয়া যায়নি!", "#e53e3e");
        loading = false; return;
      }
      setProgress("Login form fill হয়েছে! ✅", 40);
      loginBtnText.innerHTML = '⏳ লগইন হচ্ছে...';
      showToast("Email & Password fill করা হয়েছে!", "#1877F2");
      setTimeout(function () { startPolling(tabId); }, 2000);
    });
  }

  // ── Main login flow ───────────────────────────────────────
  function runLogin() {
    if (loading || !uid || !pass) return;
    if (done) {
      done = false;
      successBox.style.display = "none";
      progressWrap.style.display = "none";
      loginBtnText.textContent = "Auto Login করুন";
    }
    loading = true;
    stopPoll();
    setProgress("শুরু হচ্ছে...", 5);
    loginBtnText.innerHTML = '<div class="spinner"></div> Tab খোঁজা হচ্ছে...';

    chrome.tabs.query({ url: "https://www.facebook.com/*" }, function (fbTabs) {
      if (fbTabs && fbTabs.length > 0) {
        loginTabId = fbTabs[0].id;
        chrome.tabs.update(loginTabId, { active: true });
        var url = fbTabs[0].url || '';
        showToast("খোলা Facebook tab পাওয়া গেছে!", "#1877F2");
        if (url.includes('checkpoint') || url.includes('approvals')) {
          setProgress("Checkpoint page... auto-click চেষ্টা করছি", 55);
          loginBtnText.innerHTML = '⏳ CAPTCHA solve করার চেষ্টা...';
          showToast("CAPTCHA দেখা যাচ্ছে, auto-click চেষ্টা করছি!", "#f59e0b");
          startPolling(loginTabId);
        } else if (url.includes('/login') || url.match(/facebook\.com\/?$/)) {
          setTimeout(function () { injectLoginForm(loginTabId); }, 400);
        } else {
          chrome.tabs.update(loginTabId, { url: "https://www.facebook.com/login" }, function () {
            setProgress("Login page এ যাচ্ছি...", 15);
            chrome.tabs.onUpdated.addListener(function navL(id, info) {
              if (id === loginTabId && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(navL);
                setTimeout(function () { injectLoginForm(loginTabId); }, 500);
              }
            });
          });
        }
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, function (active) {
          if (!active || !active.length) {
            loading = false; showToast("Tab পাওয়া যায়নি", "#e53e3e"); return;
          }
          loginTabId = active[0].id;
          chrome.tabs.update(loginTabId, { url: "https://www.facebook.com/login" }, function () {
            setProgress("Facebook login page খোলা হচ্ছে...", 15);
            chrome.tabs.onUpdated.addListener(function navL(id, info) {
              if (id === loginTabId && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(navL);
                setTimeout(function () { injectLoginForm(loginTabId); }, 500);
              }
            });
          });
        });
      }
    });
  }

  // ── Event listeners ───────────────────────────────────────
  comboInput.addEventListener("input", function () {
    done = false; loading = false;
    successBox.style.display = "none";
    loginBtnText.textContent = "Auto Login করুন";
    progressWrap.style.display = "none";
    stopPoll(); clearTimeout(autoTimer);
    if (parseLine(comboInput.value.trim())) {
      autoTimer = setTimeout(function () { runLogin(); }, 300);
    }
  });

  loginBtn.addEventListener("click", runLogin);
  setInterval(updateCountdown, 1000);
})();
