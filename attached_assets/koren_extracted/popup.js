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

  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ── Parse input line ──────────────────────────────────────
  // Handles any separator: single tab, multiple tabs, multiple spaces, or mixed.
  // The 2FA secret can have internal spaces (e.g. "YPC3 P4AU KVNM") — they are stripped.
  function parseLine(line) {
    var trimmed = line.trim();
    if (!trimmed) return false;

    var parts;

    // Pass 1: split by one or more tabs (most common from spreadsheet paste)
    if (trimmed.indexOf('\t') !== -1) {
      parts = trimmed.split(/\t+/).map(function (p) { return p.trim(); }).filter(Boolean);
    }

    // Pass 2: if tabs gave < 2 fields, try two or more consecutive spaces as separator
    if (!parts || parts.length < 2) {
      parts = trimmed.split(/[ \t]{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);
    }

    // Pass 3: fallback — any whitespace run of 2+
    if (!parts || parts.length < 2) {
      parts = trimmed.split(/\s{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);
    }

    if (parts.length >= 2 && parts[0] && parts[1]) {
      uid  = parts[0].replace(/\s/g, "");          // UID — no spaces
      pass = parts[1].trim();                       // Password — keep as typed
      // 2FA secret: everything after the 2nd field, all spaces removed (base32 formatting)
      secret = parts.length >= 3 ? parts.slice(2).join("").replace(/\s/g, "") : "";

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

  // ── Detect page type (2FA check FIRST before URL checkpoint check) ──
  function detectPageType(tabId, cb) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        var url = location.href;

        // ① 2FA input field present? → highest priority, check BEFORE URL checks
        var tfaSelectors = [
          'input[name="approvals_code"]',
          'input[name="mfa_code"]',
          'input[name="code"]',
          'input[id*="approvals"]',
          'input[id*="mfa"]',
          'input[autocomplete="one-time-code"]',
          'input[placeholder*="code" i]',
          'input[placeholder*="কোড"]',
          'input[aria-label*="code" i]',
          'input[aria-label*="authentication" i]',
        ];
        for (var i = 0; i < tfaSelectors.length; i++) {
          var el = document.querySelector(tfaSelectors[i]);
          if (el && el.type !== 'hidden' && el.offsetParent !== null) return 'twofa';
        }
        // Also detect numeric-only visible single input on checkpoint pages as 2FA
        if ((url.includes('checkpoint') || url.includes('two_step') || url.includes('login/two')) &&
            !url.includes('save-device') && !url.includes('remember')) {
          var inputs = document.querySelectorAll('input[type="tel"], input[type="number"], input[type="text"]');
          for (var j = 0; j < inputs.length; j++) {
            var inp = inputs[j];
            if (inp.offsetParent !== null && !inp.name.match(/email|pass|user/i)) return 'twofa';
          }
        }

        // ② Checkpoint / CAPTCHA page
        if (url.includes('checkpoint') || url.includes('approvals') ||
            url.includes('captcha') || url.includes('integrity')) {
          return 'checkpoint';
        }

        // ③ Successfully logged in (not on login/checkpoint page, on facebook.com)
        if (url.match(/facebook\.com/) && !url.includes('/login') && !url.includes('checkpoint')) {
          // Additional checks: logged-in users have specific elements
          var hasLoginBtn = document.querySelector('input[name="login"]') ||
                            document.querySelector('[data-testid="royal_login_button"]');
          if (!hasLoginBtn) return 'success';
        }

        return 'unknown';
      }
    }, function (results) {
      var r = results && results[0] && results[0].result;
      cb(r || 'unknown');
    });
  }

  // ── Auto-click CAPTCHA / checkpoint buttons ───────────────
  function injectCheckpointClick(tabId, cb) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        // Keywords for "continue/approve/confirm" buttons (EN + Bengali)
        var keywords = [
          'continue', 'ok', 'confirm', 'approve', 'this was me', 'এটা আমি',
          'আমি ছিলাম', 'continue as', 'yes, it was me', 'সঠিক', 'পরবর্তী',
          'next', 'submit', 'i approve', 'secure account', 'skip', 'done',
          'got it', 'বুঝেছি', 'not now', 'এখন না',
        ];

        // Try buttons first
        var allBtns = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"], [role="button"]'));
        var clicked = false;

        for (var i = 0; i < allBtns.length; i++) {
          var el = allBtns[i];
          if (el.offsetParent === null) continue; // skip hidden
          var txt = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
          if (keywords.some(function (k) { return txt.includes(k); })) {
            el.click();
            clicked = true;
            break;
          }
        }

        // If no button matched, try clicking the primary/submit button
        if (!clicked) {
          var primary = document.querySelector('[data-testid="royal_login_button"]') ||
                        document.querySelector('button[type="submit"]') ||
                        document.querySelector('input[type="submit"]');
          if (primary && primary.offsetParent !== null) { primary.click(); clicked = true; }
        }

        return clicked;
      }
    }, function (results) {
      cb(results && results[0] && results[0].result);
    });
  }

  // ── Inject 2FA code into the page ────────────────────────
  function inject2FA(tabId, code, cb) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function (c) {
        function setVal(el, val) {
          // React/SPA-compatible value setter
          try {
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            if (nativeInputValueSetter && nativeInputValueSetter.set) {
              nativeInputValueSetter.set.call(el, val);
            } else {
              el.value = val;
            }
          } catch (e) { el.value = val; }
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }

        // Try every possible 2FA input selector
        var selectors = [
          'input[name="approvals_code"]',
          'input[name="mfa_code"]',
          'input[name="code"]',
          'input[id*="approvals"]',
          'input[id*="mfa"]',
          'input[autocomplete="one-time-code"]',
          'input[placeholder*="code" i]',
          'input[placeholder*="কোড"]',
          'input[aria-label*="code" i]',
          'input[type="tel"]',
          'input[type="number"]',
        ];

        var inp = null;
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el && el.type !== 'hidden' && el.offsetParent !== null) { inp = el; break; }
        }

        // Last resort: find any visible text/tel input that looks like a code field
        if (!inp) {
          var all = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"], input:not([type])');
          for (var j = 0; j < all.length; j++) {
            var candidate = all[j];
            if (candidate.offsetParent !== null && !candidate.name.match(/email|pass|user|search/i)) {
              inp = candidate; break;
            }
          }
        }

        if (!inp) return 'input_not_found';

        inp.focus();
        inp.value = '';
        setVal(inp, c);

        // Submit after short delay
        setTimeout(function () {
          var btn = document.querySelector('[data-testid="two_factor_auth_confirm_button"]') ||
                    document.querySelector('button[type="submit"]') ||
                    document.querySelector('input[type="submit"]') ||
                    document.querySelector('[role="button"][tabindex="0"]');
          if (btn && btn.offsetParent !== null) btn.click();
        }, 500);

        return 'injected';
      },
      args: [code]
    }, function (results) {
      var r = results && results[0] && results[0].result;
      cb(r === 'injected');
    });
  }

  // ── Polling loop after login ──────────────────────────────
  var pollAttempts = 0;
  var twoFaInjected = false;

  function startPolling(tabId) {
    stopPoll();
    pollAttempts = 0;
    twoFaInjected = false;

    pollTimer = setInterval(function () {
      pollAttempts++;

      if (pollAttempts > 30) {
        stopPoll();
        loading = false;
        showToast("Timeout — দেরি হচ্ছে, আবার চেষ্টা করুন", "#e53e3e");
        loginBtnText.textContent = "Auto Login করুন";
        return;
      }

      detectPageType(tabId, function (type) {
        if (type === 'twofa') {
          if (twoFaInjected) return; // already injected, wait for result
          if (!secret) {
            // No 2FA secret provided — notify user
            stopPoll();
            loading = false;
            setProgress("2FA দরকার! Secret দিন", 70);
            showToast("2FA কোড চাওয়া হচ্ছে — UID[Tab]Pass[Tab]2FA_Secret দিয়ে আবার দিন", "#f59e0b");
            loginBtnText.textContent = "Auto Login করুন";
            return;
          }
          twoFaInjected = true;
          setProgress("2FA কোড দেওয়া হচ্ছে...", 80);
          loginBtnText.innerHTML = '⏳ 2FA দেওয়া হচ্ছে...';
          generateTOTP(secret).then(function (newCode) {
            inject2FA(tabId, newCode, function (ok) {
              if (ok) {
                setProgress("2FA দেওয়া হয়েছে ✅", 90);
                loginBtnText.innerHTML = '✅ 2FA সম্পন্ন!';
                usedCodeEl.textContent = "2FA: " + newCode;
                successBox.style.display = "block";
                showToast("2FA কোড " + newCode + " দেওয়া হয়েছে ✅", "#25D366");
                // Keep polling to detect final success
                twoFaInjected = false; // allow re-inject if needed
                setTimeout(function () {
                  detectPageType(tabId, function (t2) {
                    if (t2 === 'success') {
                      stopPoll();
                      setProgress("লগইন সম্পন্ন! ✅", 100);
                      loginBtnText.innerHTML = '✅ লগইন সম্পন্ন!';
                      showToast("লগইন সফল! ✅", "#25D366");
                      loading = false; done = true;
                    } else {
                      twoFaInjected = false;
                    }
                  });
                }, 2500);
              } else {
                // Input not found, retry
                twoFaInjected = false;
              }
            });
          });

        } else if (type === 'checkpoint') {
          setProgress("Checkpoint / CAPTCHA — auto-click চেষ্টা...", 60);
          loginBtnText.innerHTML = '⏳ CAPTCHA সমাধান করছি...';
          injectCheckpointClick(tabId, function (clicked) {
            if (clicked) showToast("Checkpoint button ক্লিক! ⏳", "#f59e0b");
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
        // 'unknown' — keep waiting
      });
    }, 1800);
  }

  // ── Fill login form and submit ────────────────────────────
  function injectLoginForm(tabId) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function (email, pw) {
        function setVal(el, val) {
          try {
            var d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            if (d && d.set) d.set.call(el, val);
            else el.value = val;
          } catch (e) { el.value = val; }
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
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
        }, 200);
        return 'filled';
      },
      args: [uid, pass]
    }, function (results) {
      var res = results && results[0] && results[0].result;
      if (res === 'not_found') {
        showToast("Login form পাওয়া যায়নি!", "#e53e3e");
        loading = false;
        loginBtnText.textContent = "Auto Login করুন";
        return;
      }
      setProgress("Login form fill হয়েছে ✅", 40);
      loginBtnText.innerHTML = '⏳ লগইন হচ্ছে...';
      showToast("Email & Password দেওয়া হয়েছে ✅", "#1877F2");
      setTimeout(function () { startPolling(tabId); }, 2500);
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
    loginBtnText.innerHTML = '⏳ Tab খোঁজা হচ্ছে...';

    chrome.tabs.query({ url: ["https://www.facebook.com/*", "https://m.facebook.com/*"] }, function (fbTabs) {
      if (fbTabs && fbTabs.length > 0) {
        loginTabId = fbTabs[0].id;
        chrome.tabs.update(loginTabId, { active: true });
        var url = fbTabs[0].url || '';
        showToast("খোলা Facebook tab পাওয়া গেছে!", "#1877F2");

        if (url.includes('checkpoint') || url.includes('approvals') || url.includes('captcha')) {
          // Check if 2FA first
          detectPageType(loginTabId, function (type) {
            if (type === 'twofa') {
              setProgress("2FA page পাওয়া গেছে", 75);
              startPolling(loginTabId);
            } else {
              setProgress("Checkpoint page — auto-click চেষ্টা...", 55);
              loginBtnText.innerHTML = '⏳ CAPTCHA সমাধান করছি...';
              showToast("CAPTCHA দেখা যাচ্ছে, auto-click করছি!", "#f59e0b");
              startPolling(loginTabId);
            }
          });
        } else if (url.includes('/login') || url.match(/facebook\.com\/?$/) || url === 'https://www.facebook.com/') {
          setTimeout(function () { injectLoginForm(loginTabId); }, 400);
        } else {
          // Navigate to login page first
          chrome.tabs.update(loginTabId, { url: "https://www.facebook.com/login" }, function () {
            setProgress("Login page এ যাচ্ছি...", 15);
            chrome.tabs.onUpdated.addListener(function navL(id, info) {
              if (id === loginTabId && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(navL);
                setTimeout(function () { injectLoginForm(loginTabId); }, 600);
              }
            });
          });
        }
      } else {
        // No Facebook tab open — open one
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
                setTimeout(function () { injectLoginForm(loginTabId); }, 600);
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
      autoTimer = setTimeout(function () { runLogin(); }, 350);
    }
  });

  loginBtn.addEventListener("click", runLogin);
  setInterval(updateCountdown, 1000);

})();
