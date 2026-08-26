(function () {
  'use strict';

  var API_BASE = 'https://nusaiba-it-center-2478.onrender.com';
  var STORAGE_KEYS = ['savedAccounts', 'savedCreds', 'comboDraft', 'disabledUids'];
  var state = {
    account: null,
    accounts: [],
    disabledUids: {},
    loading: false,
    currentTabId: null,
    autoStartTimer: null,
    toastTimer: null,
    totpTimer: null,
    totpCode: '------'
  };

  function $(id) { return document.getElementById(id); }
  var comboInput = $('comboInput');
  var parsedRow = $('parsedRow');
  var pUid = $('pUid');
  var pPass = $('pPass');
  var pSecret = $('pSecret');
  var totpBox = $('totpBox');
  var totpCodeEl = $('totpCode');
  var countdownArc = $('countdownArc');
  var countdownNum = $('countdownNum');
  var progressWrap = $('progressWrap');
  var progressFill = $('progressFill');
  var stageLabel = $('stageLabel');
  var stagePct = $('stagePct');
  var loginBtn = $('loginBtn');
  var loginBtnText = $('loginBtnText');
  var stopBtn = $('stopBtn');
  var successBox = $('successBox');
  var usedCodeEl = $('usedCode');
  var toastEl = $('toast');
  var savedWrap = $('savedAccountsWrap');
  var savedList = $('savedAccountsList');
  var saveBtn = $('saveBtn');

  function storageGet(keys, cb) {
    try { chrome.storage.local.get(keys, cb); } catch (e) { cb({}); }
  }

  function storageSet(data, cb) {
    try { chrome.storage.local.set(data, cb || function () {}); } catch (e) {}
  }

  function showToast(message, color) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.style.background = (color || '#1877F2') + 'e8';
    toastEl.style.display = 'block';
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      toastEl.style.display = 'none';
    }, 3500);
  }

  function setProgress(label, percent) {
    progressWrap.style.display = 'flex';
    stageLabel.textContent = label;
    stagePct.textContent = percent + '%';
    progressFill.style.width = percent + '%';
  }

  function sendMessage(message, callback) {
    try {
      chrome.runtime.sendMessage(message, function (response) {
        if (chrome.runtime.lastError) {
          if (callback) callback(null);
          return;
        }
        if (callback) callback(response || null);
      });
    } catch (e) {
      if (callback) callback(null);
    }
  }

  function normalizeUid(uid) {
    return String(uid || '').trim().replace(/\s/g, '');
  }

  function parseCredentials(value) {
    var text = String(value || '').replace(/\r/g, '').trim();
    if (!text) return null;
    var line = text.split('\n').filter(function (item) { return item.trim(); })[0] || '';
    var parts = [];
    if (line.indexOf('\t') !== -1) {
      parts = line.split(/\t+/).map(function (item) { return item.trim(); }).filter(Boolean);
    } else if (line.split(/\s{2,}/).length >= 2) {
      parts = line.split(/\s{2,}/).map(function (item) { return item.trim(); }).filter(Boolean);
    } else {
      parts = line.trim().split(/\s+/).filter(Boolean);
    }
    if (parts.length < 2) return null;
    var account = {
      uid: normalizeUid(parts[0]),
      pass: String(parts[1] || '').trim(),
      secret: parts.length > 2 ? parts.slice(2).join('').replace(/\s/g, '') : ''
    };
    return account.uid && account.pass ? account : null;
  }

  function sameAccount(a, b) {
    return a && b && normalizeUid(a.uid) === normalizeUid(b.uid);
  }

  function isDisabled(uid) {
    return !!state.disabledUids[normalizeUid(uid)];
  }

  function persistState() {
    storageSet({
      savedAccounts: state.accounts,
      disabledUids: state.disabledUids,
      comboDraft: comboInput.value
    });
  }

  function upsertAccount(account, shouldRender) {
    if (!account || !account.uid || !account.pass) return;
    var next = [];
    var replaced = false;
    state.accounts.forEach(function (item) {
      if (sameAccount(item, account)) {
        next.push({
          uid: account.uid,
          pass: account.pass,
          secret: account.secret || item.secret || '',
          updatedAt: Date.now()
        });
        replaced = true;
      } else {
        next.push(item);
      }
    });
    if (!replaced) {
      next.unshift({ uid: account.uid, pass: account.pass, secret: account.secret || '', updatedAt: Date.now() });
    }
    state.accounts = next.slice(0, 50);
    persistState();
    if (shouldRender !== false) renderSavedAccounts();
  }

  function renderParsed(account) {
    state.account = account;
    if (!account) {
      parsedRow.style.display = 'none';
      totpBox.style.display = 'none';
      loginBtn.disabled = true;
      stopBtn.disabled = true;
      return;
    }
    parsedRow.style.display = 'grid';
    pUid.textContent = account.uid || '—';
    pPass.textContent = account.pass ? '••••••' : '—';
    pSecret.textContent = account.secret ? account.secret.slice(0, 6) + '…' : 'নেই';
    loginBtn.disabled = false;
    stopBtn.disabled = false;
    stopBtn.textContent = isDisabled(account.uid) ? 'On / চালু করুন' : 'Stop / Off';
    stopBtn.classList.toggle('is-off', isDisabled(account.uid));
    if (account.secret) startTOTP();
    else {
      clearInterval(state.totpTimer);
      totpBox.style.display = 'none';
    }
    saveBtn.disabled = false;
  }

  function secondsLeft() {
    return 30 - (Math.floor(Date.now() / 1000) % 30);
  }

  function base32Decode(input) {
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    var clean = String(input || '').toUpperCase().replace(/\s/g, '').replace(/=+$/, '');
    var bits = 0;
    var value = 0;
    var index = 0;
    var output = new Uint8Array(Math.floor(clean.length * 5 / 8));
    for (var i = 0; i < clean.length; i++) {
      var code = alphabet.indexOf(clean[i]);
      if (code === -1) continue;
      value = (value << 5) | code;
      bits += 5;
      if (bits >= 8) {
        output[index++] = (value >>> (bits - 8)) & 255;
        bits -= 8;
      }
    }
    return output.slice(0, index);
  }

  function generateTOTP(secret) {
    return new Promise(function (resolve) {
      try {
        var bytes = base32Decode(secret);
        if (!bytes.length) return resolve('------');
        var counter = Math.floor(Date.now() / 1000 / 30);
        var buffer = new ArrayBuffer(8);
        new DataView(buffer).setUint32(4, counter, false);
        crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
          .then(function (key) { return crypto.subtle.sign('HMAC', key, buffer); })
          .then(function (signature) {
            var data = new Uint8Array(signature);
            var offset = data[data.length - 1] & 15;
            var code = (((data[offset] & 127) << 24) |
              ((data[offset + 1] & 255) << 16) |
              ((data[offset + 2] & 255) << 8) |
              (data[offset + 3] & 255)) % 1000000;
            resolve(String(code).padStart(6, '0'));
          })
          .catch(function () { resolve('------'); });
      } catch (e) {
        resolve('------');
      }
    });
  }

  function updateTotp() {
    if (!state.account || !state.account.secret) return;
    var seconds = secondsLeft();
    var fraction = seconds / 30;
    countdownNum.textContent = seconds;
    countdownArc.style.strokeDasharray = (fraction * 94.2) + ' 94.2';
    if (seconds === 30) {
      generateTOTP(state.account.secret).then(function (code) {
        state.totpCode = code;
        totpCodeEl.textContent = code;
      });
    }
  }

  function startTOTP() {
    clearInterval(state.totpTimer);
    totpBox.style.display = 'flex';
    generateTOTP(state.account.secret).then(function (code) {
      state.totpCode = code;
      totpCodeEl.textContent = code;
    });
    updateTotp();
    state.totpTimer = setInterval(updateTotp, 1000);
  }

  function copyText(value) {
    if (!value) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () { showToast('কপি হয়েছে ✅', '#25D366'); }).catch(function () {});
    }
  }

  function updateLoginButton(text, busy) {
    loginBtnText.textContent = text;
    loginBtn.classList.toggle('is-loading', !!busy);
    loginBtn.disabled = !!busy || !state.account;
  }

  function markEnabled(uid) {
    delete state.disabledUids[normalizeUid(uid)];
    persistState();
    renderSavedAccounts();
    if (state.account && normalizeUid(state.account.uid) === normalizeUid(uid)) renderParsed(state.account);
  }

  function stopCurrent() {
    if (!state.account) return;
    var uid = normalizeUid(state.account.uid);
    state.disabledUids[uid] = true;
    state.loading = false;
    sendMessage({ type: 'STOP_POLL' });
    persistState();
    renderSavedAccounts();
    renderParsed(state.account);
    updateLoginButton('Off — আবার paste করলে On হবে', false);
    setProgress('এই ID Off করা হয়েছে', 0);
    showToast('এই ID এখন Off থাকবে। আবার paste করলে Auto On হবে।', '#f59e0b');
  }

  function getFacebookTab(callback) {
    chrome.tabs.query({ url: ['https://www.facebook.com/*', 'https://m.facebook.com/*'] }, function (tabs) {
      if (tabs && tabs.length) return callback(tabs[0]);
      chrome.tabs.query({ active: true, currentWindow: true }, function (activeTabs) {
        callback(activeTabs && activeTabs[0] ? activeTabs[0] : null);
      });
    });
  }

  function runLogin() {
    if (!state.account || state.loading) return;
    if (isDisabled(state.account.uid)) {
      showToast('এই ID Off আছে — আবার paste করলে On হবে।', '#f59e0b');
      return;
    }
    upsertAccount(state.account, false);
    state.loading = true;
    state.currentTabId = null;
    successBox.style.display = 'none';
    setProgress('Facebook tab প্রস্তুত করছি...', 10);
    updateLoginButton('লগইন হচ্ছে...', true);
    getFacebookTab(function (tab) {
      if (tab && tab.id) {
        state.currentTabId = tab.id;
        chrome.tabs.update(tab.id, { active: true }, function () {});
        if (!String(tab.url || '').includes('facebook.com/login')) {
          chrome.tabs.update(tab.id, { url: 'https://www.facebook.com/login' }, function () {});
        }
        sendMessage({
          type: 'START_LOGIN',
          tabId: tab.id,
          uid: state.account.uid,
          pass: state.account.pass,
          secret: state.account.secret,
          isAuto: true
        }, function (response) {
          if (response && response.ok) setProgress('UID ও Password দেওয়া হচ্ছে...', 35);
        });
        return;
      }
      chrome.tabs.create({ url: 'https://www.facebook.com/login', active: true }, function (newTab) {
        if (!newTab || !newTab.id) {
          state.loading = false;
          updateLoginButton('আবার চেষ্টা করুন', false);
          showToast('Facebook tab খোলা যায়নি।', '#e53e3e');
          return;
        }
        state.currentTabId = newTab.id;
        sendMessage({
          type: 'START_LOGIN',
          tabId: newTab.id,
          uid: state.account.uid,
          pass: state.account.pass,
          secret: state.account.secret,
          isAuto: true
        });
      });
    });
  }

  function handleParsedInput(autoStart) {
    var account = parseCredentials(comboInput.value);
    renderParsed(account);
    if (!account) {
      saveBtn.disabled = true;
      successBox.style.display = 'none';
      return;
    }
    var wasDisabled = isDisabled(account.uid);
    if (wasDisabled) {
      delete state.disabledUids[normalizeUid(account.uid)];
      showToast('এই ID আবার Auto On হয়েছে ✅', '#25D366');
    }
    upsertAccount(account, false);
    persistState();
    renderSavedAccounts();
    if (autoStart && !state.loading) {
      clearTimeout(state.autoStartTimer);
      state.autoStartTimer = setTimeout(function () {
        if (state.account && sameAccount(state.account, account)) runLogin();
      }, 450);
    }
  }

  function renderSavedAccounts() {
    savedList.textContent = '';
    if (!state.accounts.length) {
      savedWrap.style.display = 'none';
      return;
    }
    savedWrap.style.display = 'block';
    state.accounts.forEach(function (account) {
      var off = isDisabled(account.uid);
      var chip = document.createElement('div');
      chip.className = 'saved-chip' + (off ? ' saved-chip-off' : '');

      var main = document.createElement('button');
      main.type = 'button';
      main.className = 'chip-main';
      main.title = off ? 'On করতে আবার এই ID paste করুন' : 'এই ID ব্যবহার করুন';
      var uidEl = document.createElement('span');
      uidEl.className = 'chip-uid';
      uidEl.textContent = account.uid;
      var meta = document.createElement('span');
      meta.className = 'chip-meta';
      meta.textContent = off ? 'OFF · আবার paste করলে ON' : 'Saved · password محفوظ';
      if (account.secret) {
        var badge = document.createElement('span');
        badge.className = 'chip-2fa-badge';
        badge.textContent = '2FA';
        meta.appendChild(badge);
      }
      main.appendChild(uidEl);
      main.appendChild(meta);
      main.addEventListener('click', function () {
        comboInput.value = account.uid + '\t' + account.pass + (account.secret ? '\t' + account.secret : '');
        handleParsedInput(!off);
      });

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'chip-toggle' + (off ? ' is-off' : '');
      toggle.textContent = off ? 'ON' : 'OFF';
      toggle.title = off ? 'এই ID চালু করুন' : 'এই ID বন্ধ করুন';
      toggle.addEventListener('click', function () {
        if (off) {
          markEnabled(account.uid);
          showToast('ID আবার On হয়েছে।', '#25D366');
        } else {
          state.disabledUids[normalizeUid(account.uid)] = true;
          if (state.account && sameAccount(state.account, account)) {
            sendMessage({ type: 'STOP_POLL' });
            state.loading = false;
            renderParsed(state.account);
          }
          persistState();
          renderSavedAccounts();
          showToast('এই ID Off করা হয়েছে।', '#f59e0b');
        }
      });

      var copyPass = document.createElement('button');
      copyPass.type = 'button';
      copyPass.className = 'chip-copy-btn';
      copyPass.textContent = 'Pass';
      copyPass.addEventListener('click', function () { copyText(account.pass); });
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-del';
      remove.textContent = '×';
      remove.title = 'এই ID মুছুন';
      remove.addEventListener('click', function () {
        state.accounts = state.accounts.filter(function (item) { return !sameAccount(item, account); });
        delete state.disabledUids[normalizeUid(account.uid)];
        persistState();
        renderSavedAccounts();
      });

      chip.appendChild(main);
      chip.appendChild(toggle);
      chip.appendChild(copyPass);
      chip.appendChild(remove);
      savedList.appendChild(chip);
    });
  }

  function restoreState(data) {
    var rawAccounts = Array.isArray(data.savedAccounts) ? data.savedAccounts : [];
    state.accounts = rawAccounts.filter(function (item) {
      return item && item.uid && item.pass;
    }).map(function (item) {
      return { uid: normalizeUid(item.uid), pass: String(item.pass), secret: String(item.secret || ''), updatedAt: item.updatedAt || 0 };
    });
    if (!state.accounts.length && data.savedCreds && data.savedCreds.uid && data.savedCreds.pass) {
      state.accounts = [{
        uid: normalizeUid(data.savedCreds.uid),
        pass: String(data.savedCreds.pass),
        secret: String(data.savedCreds.secret || ''),
        updatedAt: Date.now()
      }];
    }
    state.disabledUids = data.disabledUids && typeof data.disabledUids === 'object' ? data.disabledUids : {};
    var draft = data.comboDraft;
    if (!draft && state.accounts[0]) {
      draft = state.accounts[0].uid + '\t' + state.accounts[0].pass + (state.accounts[0].secret ? '\t' + state.accounts[0].secret : '');
    }
    if (draft) {
      comboInput.value = draft;
      handleParsedInput(false);
    } else {
      saveBtn.disabled = true;
    }
    renderSavedAccounts();
    sendMessage({ type: 'GET_SESSION' }, function (response) {
      if (response && response.session && response.session.active) {
        state.loading = true;
        state.currentTabId = response.session.tabId;
        var sessionAccount = {
          uid: response.session.uid,
          pass: response.session.pass,
          secret: response.session.secret || ''
        };
        comboInput.value = sessionAccount.uid + '\t' + sessionAccount.pass + (sessionAccount.secret ? '\t' + sessionAccount.secret : '');
        renderParsed(sessionAccount);
        setProgress('লগইন চলছে...', 45);
        updateLoginButton('লগইন চলছে...', true);
      }
    });
  }

  function handleBackgroundMessage(message) {
    if (!message) return;
    if (message.type === 'AUTO_LOGIN_STARTED') {
      state.loading = true;
      state.currentTabId = message.tabId || state.currentTabId;
      setProgress('UID ও Password দেওয়া হয়েছে...', 40);
      updateLoginButton('লগইন হচ্ছে...', true);
      return;
    }
    if (message.tabId && state.currentTabId && message.tabId !== state.currentTabId) return;
    if (message.type === 'STATUS') {
      var labels = {
        trust_device: ['Trust device সমাধান হচ্ছে...', 55],
        trust_device_clicked: ['Trust device সম্পন্ন...', 65],
        sign_in_as_dialog: ['Login dialog বন্ধ হচ্ছে...', 45],
        device_approval: ['অন্য verification method বাছাই হচ্ছে...', 58],
        choosing_auth_app: ['Authentication app বাছাই হচ্ছে...', 65],
        twofa_filled: ['2FA code দেওয়া হয়েছে ✅', 88],
        recaptcha: ['reCAPTCHA পাওয়া গেছে...', 68],
        captcha_manual: ['reCAPTCHA manual ভাবে শেষ করুন', 70],
        need_secret: ['2FA secret দরকার', 70]
      };
      var status = labels[message.msg];
      if (status) setProgress(status[0], status[1]);
      if (message.msg === 'need_secret') {
        state.loading = false;
        updateLoginButton('2FA Secret দিন', false);
        showToast('এই login-এর জন্য UID[Tab]Pass[Tab]2FA Secret দিন।', '#f59e0b');
      }
      if (message.msg === 'captcha_manual') showToast('reCAPTCHA manual ভাবে শেষ করুন।', '#f59e0b');
      if (message.msg === 'twofa_filled' && message.code) {
        usedCodeEl.textContent = '2FA: ' + message.code;
      }
      if (message.msg === 'success') {
        state.loading = false;
        setProgress('লগইন সম্পন্ন! ✅', 100);
        updateLoginButton('লগইন সম্পন্ন ✅', false);
        usedCodeEl.textContent = 'Login Success ✅';
        successBox.style.display = 'block';
        if (state.account) upsertAccount(state.account, false);
        showToast('লগইন সফল! UID/Password সেভ আছে ✅', '#25D366');
      }
    }
  }

  function tickClock() {
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    var bd = new Date(utc + 6 * 3600000);
    var hour = bd.getHours();
    var ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    $('bdClock').textContent =
      ('0' + hour).slice(-2) + ':' +
      ('0' + bd.getMinutes()).slice(-2) + ':' +
      ('0' + bd.getSeconds()).slice(-2) + ' ' + ampm;
  }

  comboInput.addEventListener('input', function () {
    successBox.style.display = 'none';
    handleParsedInput(true);
  });
  comboInput.addEventListener('paste', function () {
    setTimeout(function () { handleParsedInput(true); }, 20);
  });
  loginBtn.addEventListener('click', runLogin);
  stopBtn.addEventListener('click', stopCurrent);
  saveBtn.addEventListener('click', function () {
    var account = parseCredentials(comboInput.value);
    if (!account) return showToast('UID ও Password দিন।', '#e53e3e');
    upsertAccount(account);
    showToast('ID স্থায়ীভাবে সেভ হয়েছে ✅', '#25D366');
  });
  $('pasteBtn').addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      return showToast('Clipboard permission পাওয়া যায়নি।', '#e53e3e');
    }
    navigator.clipboard.readText().then(function (text) {
      comboInput.value = text;
      handleParsedInput(true);
    }).catch(function () {
      showToast('Clipboard থেকে Paste করা যায়নি।', '#e53e3e');
    });
  });
  $('clearAllBtn').addEventListener('click', function () {
    if (!window.confirm('সব সেভ করা ID মুছে ফেলবেন?')) return;
    state.accounts = [];
    state.disabledUids = {};
    storageSet({ savedAccounts: [], disabledUids: {}, comboDraft: '' });
    comboInput.value = '';
    renderParsed(null);
    renderSavedAccounts();
  });
  $('copyUid').addEventListener('click', function () { if (state.account) copyText(state.account.uid); });
  $('copyPass').addEventListener('click', function () { if (state.account) copyText(state.account.pass); });
  $('copySecret').addEventListener('click', function () { if (state.account) copyText(state.account.secret); });
  $('copyTotp').addEventListener('click', function () { copyText(state.totpCode); });

  try {
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
  } catch (e) {}
  tickClock();
  setInterval(tickClock, 1000);
  storageGet(STORAGE_KEYS, restoreState);
})();