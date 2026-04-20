'use strict';

// ── Base32 / TOTP (Service Worker compatible — no SubtleCrypto async issue) ──
var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input) {
  var clean = input.toUpperCase().replace(/\s/g,'').replace(/=+$/,'');
  var bits=0,value=0,idx=0;
  var out = new Uint8Array(Math.floor(clean.length*5/8));
  for(var i=0;i<clean.length;i++){
    var ci=B32.indexOf(clean[i]); if(ci===-1) continue;
    value=(value<<5)|ci; bits+=5;
    if(bits>=8){out[idx++]=(value>>>(bits-8))&255;bits-=8;}
  }
  return out.slice(0,idx);
}
async function generateTOTP(secret){
  try{
    var keyBytes=base32Decode(secret);
    if(keyBytes.length===0) return null;
    var counter=Math.floor(Date.now()/1000/30);
    var buf=new ArrayBuffer(8); new DataView(buf).setUint32(4,counter,false);
    var key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-1'},false,['sign']);
    var sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,buf));
    var o=sig[sig.length-1]&0x0f;
    var code=(((sig[o]&0x7f)<<24)|((sig[o+1]&0xff)<<16)|((sig[o+2]&0xff)<<8)|(sig[o+3]&0xff))%1000000;
    return String(code).padStart(6,'0');
  }catch(e){return null;}
}

// ── Send message to popup (silently fails if popup closed) ────────
function notifyPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(function() {});
}

// ── Detect page type in a tab ─────────────────────────────────────
function detectPageType(tabId, cb) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function() {
      var url = location.href;
      var bodyText = '';
      try { bodyText = (document.body.innerText || '').toLowerCase(); } catch(e) {}

      // ── PRIORITY 1: Visible code input = DEFINITELY twofa ─────────
      // Check this first so "Try Another Way" on auth-app page doesn't confuse detection
      var tfaSels = [
        'input[name="approvals_code"]','input[name="mfa_code"]','input[name="code"]',
        'input[autocomplete="one-time-code"]',
        'input[placeholder="Code"]','input[placeholder="code"]',
        'input[placeholder*="code" i]','input[aria-label*="code" i]'
      ];
      for(var i=0;i<tfaSels.length;i++){
        var el=document.querySelector(tfaSels[i]);
        if(el&&el.type!=='hidden'&&el.offsetParent!==null) return 'twofa';
      }

      // ── PRIORITY 2: 2FA URL keywords ──────────────────────────────
      var tfaUrlKw = ['two_step','two-factor','two_factor','login/two','mfa','otp','verify_id'];
      for(var u=0;u<tfaUrlKw.length;u++){
        if(url.includes(tfaUrlKw[u])) return 'twofa';
      }

      // ── PRIORITY 3: Device notification approval (NO "try another way" — that's on 2FA pages too) ──
      if (
        bodyText.includes('waiting for approval') ||
        bodyText.includes('check your notifications on another device') ||
        bodyText.includes('we sent a notification to your') ||
        url.includes('device_based_two_factor') ||
        url.includes('approvals_required')
      ) {
        // Check if there's a "Choose confirmation method" modal open
        var modal = document.querySelector('[role="dialog"]') || document.querySelector('[aria-modal="true"]');
        if (modal) {
          var modalText = (modal.innerText || '').toLowerCase();
          if (modalText.includes('authentication app') || modalText.includes('choose a way')) {
            return 'choose_method_modal';
          }
        }
        return 'device_approval';
      }

      // ── PRIORITY 4: 2FA body text keywords ────────────────────────
      var tfaTxtKw = ['go to your authentication app','6-digit','two-factor','two factor',
        'verification code','enter the code','enter code','approvals code',
        'confirmation code','security code','কোড লিখুন','কোড দিন'];
      for(var t=0;t<tfaTxtKw.length;t++){
        if(bodyText.includes(tfaTxtKw[t])) return 'twofa';
      }

      // Checkpoint with visible number/text inputs
      if(url.includes('checkpoint')||url.includes('approvals')){
        var ins=document.querySelectorAll('input[type="tel"],input[type="number"],input[type="text"]');
        for(var j=0;j<ins.length;j++){
          if(ins[j].offsetParent!==null&&!ins[j].name.match(/email|pass|user/i)) return 'twofa';
        }
        return 'checkpoint';
      }

      // reCAPTCHA
      if(
        document.querySelector('iframe[src*="recaptcha"]') ||
        document.querySelector('.g-recaptcha') ||
        document.querySelector('[data-sitekey]')
      ) return 'recaptcha';

      if(url.includes('captcha')||url.includes('integrity')) return 'checkpoint';
      if(url.includes('/login')||url.match(/facebook\.com\/login/)) return 'login';

      // Success — logged-in home page signals
      if(url.match(/facebook\.com/)){
        var tfaStill = document.querySelector('input[placeholder="Code"]') ||
                       bodyText.includes('6-digit');
        if(tfaStill) return 'twofa';
        var home = document.querySelector('[aria-label="Home"]') ||
                   document.querySelector('[data-pagelet="LeftRail"]') ||
                   document.querySelector('[role="feed"]') ||
                   document.querySelector('[aria-label="News Feed"]');
        if(home) return 'success';
      }
      return 'unknown';
    }
  }, function(results) {
    if(chrome.runtime.lastError){ cb('unknown'); return; }
    var r = results && results[0] && results[0].result;
    cb(r || 'unknown');
  });
}

// ── Handle "device notification" screen: click "Try Another Way" ──
function handleDeviceApproval(tabId, cb) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function() {
      var allBtns = Array.from(document.querySelectorAll('button,a,[role="button"]'));
      var tryBtn = null;
      for(var i=0;i<allBtns.length;i++){
        var txt = (allBtns[i].textContent || allBtns[i].getAttribute('aria-label') || '').toLowerCase().trim();
        if(
          txt.includes('try another way') ||
          txt.includes('অন্য উপায়') ||
          txt.includes('another way') ||
          txt.includes('use another method')
        ){
          tryBtn = allBtns[i];
          break;
        }
      }
      if(tryBtn && tryBtn.offsetParent !== null){
        tryBtn.click();
        return 'clicked_try_another';
      }
      return 'not_found';
    }
  }, function(results){
    if(chrome.runtime.lastError){ cb(false); return; }
    var r = results && results[0] && results[0].result;
    cb(r === 'clicked_try_another');
  });
}

// ── Handle "Choose method" modal: select Authentication App → Continue ──
function handleChooseMethodModal(tabId, cb) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function() {
      // Find the modal
      var modal = document.querySelector('[role="dialog"]') ||
                  document.querySelector('[aria-modal="true"]') ||
                  document.body;

      // Find all radio buttons / list items inside the modal
      var radios = Array.from(modal.querySelectorAll('input[type="radio"]'));
      var authRadio = null;

      // Try by label text
      for(var r=0;r<radios.length;r++){
        var label = '';
        if(radios[r].labels && radios[r].labels.length){
          label = (radios[r].labels[0].textContent || '').toLowerCase();
        }
        // Also check sibling text
        var parent = radios[r].closest('label') || radios[r].parentElement;
        if(parent) label += ' ' + (parent.textContent || '').toLowerCase();
        if(label.includes('authentication app') || label.includes('authenticator')){
          authRadio = radios[r];
          break;
        }
      }

      // Fallback: find clickable row with "Authentication app" text
      if(!authRadio){
        var rows = Array.from(modal.querySelectorAll('[role="radio"],[role="option"],[role="listitem"],label,li'));
        for(var i=0;i<rows.length;i++){
          var rowTxt = (rows[i].textContent || '').toLowerCase();
          if(rowTxt.includes('authentication app') || rowTxt.includes('authenticator')){
            rows[i].click();
            // small delay then find Continue
            var cont = null;
            var btns = Array.from(modal.querySelectorAll('button,[role="button"]'));
            for(var b=0;b<btns.length;b++){
              var bTxt = (btns[b].textContent || '').toLowerCase().trim();
              if(bTxt.includes('continue') || bTxt.includes('next') || bTxt.includes('পরবর্তী')){
                cont = btns[b]; break;
              }
            }
            if(cont) setTimeout(function(){ cont.click(); }, 400);
            return 'clicked_row';
          }
        }
      }

      if(authRadio){
        authRadio.click();
        authRadio.checked = true;
        authRadio.dispatchEvent(new Event('change', {bubbles: true}));
        // Now find and click Continue
        setTimeout(function(){
          var allBtns = Array.from(modal.querySelectorAll('button,[role="button"]'));
          for(var b=0;b<allBtns.length;b++){
            var bTxt = (allBtns[b].textContent || '').toLowerCase().trim();
            if(bTxt.includes('continue') || bTxt.includes('next') || bTxt.includes('পরবর্তী')){
              allBtns[b].click(); break;
            }
          }
        }, 400);
        return 'selected_auth_app';
      }

      return 'modal_not_found';
    }
  }, function(results){
    if(chrome.runtime.lastError){ cb(false); return; }
    var r = results && results[0] && results[0].result;
    cb(r === 'selected_auth_app' || r === 'clicked_row');
  });
}

// ── Fill 2FA TOTP code ────────────────────────────────────────────
function inject2FA(tabId, code, cb) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function(c) {
      var sels = [
        'input[name="approvals_code"]','input[name="mfa_code"]','input[name="code"]',
        'input[autocomplete="one-time-code"]','input[placeholder*="code" i]',
        'input[aria-label*="code" i]','input[type="tel"]','input[type="number"]'
      ];
      var inp = null;
      for(var i=0;i<sels.length;i++){
        var el=document.querySelector(sels[i]);
        if(el&&el.type!=='hidden'&&el.offsetParent!==null){inp=el;break;}
      }
      if(!inp){
        var all=document.querySelectorAll('input[type="text"],input[type="tel"],input[type="number"],input:not([type])');
        for(var j=0;j<all.length;j++){
          if(all[j].offsetParent!==null&&!all[j].name.match(/email|pass|user|search/i)){inp=all[j];break;}
        }
      }
      if(!inp) return 'not_found';

      var nativeSetter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
      function setNative(el,val){
        if(nativeSetter&&nativeSetter.set) nativeSetter.set.call(el,val);
        else el.value=val;
      }
      inp.focus();
      setNative(inp,'');
      inp.dispatchEvent(new Event('input',{bubbles:true}));

      var delay=0;
      for(var k=0;k<c.length;k++){
        (function(ch,idx){
          setTimeout(function(){
            setNative(inp,c.slice(0,idx+1));
            inp.dispatchEvent(new KeyboardEvent('keydown',{key:ch,bubbles:true,cancelable:true}));
            inp.dispatchEvent(new KeyboardEvent('keypress',{key:ch,bubbles:true,cancelable:true}));
            inp.dispatchEvent(new Event('input',{bubbles:true}));
            inp.dispatchEvent(new KeyboardEvent('keyup',{key:ch,bubbles:true,cancelable:true}));
            if(idx===c.length-1){
              setTimeout(function(){
                inp.dispatchEvent(new Event('change',{bubbles:true}));
                var btn=document.querySelector('[data-testid="two_factor_auth_confirm_button"]');
                if(!btn){
                  var allBtns=Array.from(document.querySelectorAll('button,[role="button"]'));
                  var kws=['continue','submit','confirm','verify','next','ok','done'];
                  for(var b=0;b<allBtns.length;b++){
                    var bTxt=(allBtns[b].textContent||'').toLowerCase().trim();
                    if(allBtns[b].offsetParent!==null&&kws.some(function(k){return bTxt.includes(k);})){btn=allBtns[b];break;}
                  }
                }
                if(!btn) btn=document.querySelector('button[type="submit"],input[type="submit"]');
                if(btn&&btn.offsetParent!==null) btn.click();
              },600);
            }
          },delay);
          delay+=80;
        })(c[k],k);
      }
      return 'injected';
    },
    args: [code]
  }, function(results){
    if(chrome.runtime.lastError){ cb(false); return; }
    var r = results && results[0] && results[0].result;
    cb(r === 'injected');
  });
}

// ── Auto-fill login form ──────────────────────────────────────────
function autoFillLogin(tabId, uid, pass, secret) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function(email, pw) {
      function setVal(el, val) {
        try {
          var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
          if(d&&d.set) d.set.call(el,val); else el.value=val;
        } catch(e) { el.value=val; }
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
        el.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true}));
      }
      var emailEl=document.querySelector('input[name="email"]')||document.getElementById('email');
      var passEl=document.querySelector('input[name="pass"]')||document.getElementById('pass');
      if(!emailEl||!passEl) return 'not_found';
      emailEl.focus(); setVal(emailEl, email);
      setTimeout(function(){
        passEl.focus(); setVal(passEl, pw);
        setTimeout(function(){
          var btn=document.querySelector('[data-testid="royal_login_button"]')||
                  document.querySelector('button[name="login"]')||
                  document.querySelector('button[type="submit"]')||
                  document.querySelector('input[type="submit"]');
          if(btn) btn.click();
        },400);
      },250);
      return 'filled';
    },
    args: [uid, pass]
  }, function() {
    if(chrome.runtime.lastError) return;
    // Save session and start alarm polling
    chrome.storage.session.set({
      loginSession: { active: true, uid: uid, pass: pass, secret: secret, tabId: tabId, twoFaDone: false, deviceHandled: false }
    });
    chrome.alarms.clear('loginPoll', function() {
      chrome.alarms.create('loginPoll', { periodInMinutes: 0.034 }); // ~2 seconds
    });
    notifyPopup({ type: 'AUTO_LOGIN_STARTED', tabId: tabId, uid: uid, pass: pass, secret: secret });
  });
}

// ── Core handler: runs on every poll + nav event ──────────────────
function handlePageState(tabId, session) {
  detectPageType(tabId, function(type) {
    notifyPopup({ type: 'PAGE_TYPE', pageType: type, tabId: tabId });

    if(type === 'device_approval') {
      // Facebook is waiting for device notification — click "Try Another Way"
      if(!session.deviceHandled){
        chrome.storage.session.set({ loginSession: Object.assign({}, session, { deviceHandled: true }) });
        notifyPopup({ type: 'STATUS', msg: 'device_approval' });
        setTimeout(function(){
          handleDeviceApproval(tabId, function(clicked){
            if(!clicked){
              // Try again after a moment — modal may not have appeared yet
              chrome.storage.session.set({ loginSession: Object.assign({}, session, { deviceHandled: false }) });
            }
          });
        }, 800);
      }

    } else if(type === 'choose_method_modal') {
      // Modal is open — select Authentication App → Continue
      notifyPopup({ type: 'STATUS', msg: 'choosing_auth_app' });
      handleChooseMethodModal(tabId, function(ok){
        // After selecting, poll will pick up the next state
      });

    } else if(type === 'twofa') {
      if(session.twoFaDone) return;
      if(!session.secret) {
        notifyPopup({ type: 'STATUS', msg: 'need_secret' });
        return;
      }
      chrome.storage.session.set({ loginSession: Object.assign({}, session, { twoFaDone: true }) });
      generateTOTP(session.secret).then(function(code){
        if(!code) return;
        inject2FA(tabId, code, function(ok){
          if(!ok){
            // Reset so it retries
            chrome.storage.session.set({ loginSession: Object.assign({}, session, { twoFaDone: false }) });
          } else {
            notifyPopup({ type: 'STATUS', msg: 'twofa_filled', code: code });
          }
        });
      });

    } else if(type === 'recaptcha') {
      var captchaAttempts = session.captchaAttempts || 0;
      if(captchaAttempts >= 2) {
        // Gave up — notify popup, keep polling in case it resolves
        notifyPopup({ type: 'STATUS', msg: 'captcha_manual' });
        return;
      }
      chrome.storage.session.set({ loginSession: Object.assign({}, session, { captchaAttempts: captchaAttempts + 1 }) });
      notifyPopup({ type: 'STATUS', msg: 'recaptcha' });
      // Step 1: Click "I'm not a robot" checkbox
      chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        func: function(){
          var cb = document.querySelector('#recaptcha-anchor,.recaptcha-checkbox-border,.recaptcha-checkbox,[aria-label*="not a robot" i]');
          if(cb && cb.offsetParent !== null){ cb.click(); return 'clicked'; }
          return null;
        }
      }, function(){
        // Step 2: Wait then try audio challenge button
        setTimeout(function(){
          chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            func: function(){
              var audioBtn = document.querySelector('#recaptcha-audio-button,button[aria-labelledby*="audio" i],button.rc-button-audio');
              if(audioBtn && audioBtn.offsetParent !== null){ audioBtn.click(); return 'audio'; }
              return null;
            }
          }, function(){
            // Step 3: Get audio URL and transcribe
            setTimeout(function(){
              chrome.scripting.executeScript({
                target: { tabId: tabId, allFrames: true },
                func: function(){
                  var src = document.querySelector('#audio-source,audio source,audio');
                  if(src){ return src.src || src.getAttribute('src') || null; }
                  return null;
                }
              }, function(res){
                var audioUrl = null;
                if(res){ for(var i=0;i<res.length;i++){ if(res[i]&&res[i].result){ audioUrl=res[i].result; break; } } }
                if(!audioUrl) return;
                fetch(audioUrl)
                  .then(function(r){ return r.arrayBuffer(); })
                  .then(function(ab){
                    return fetch(
                      'https://www.google.com/speech-api/v2/recognize?output=json&lang=en-us&key=AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgY',
                      { method:'POST', headers:{'Content-Type':'audio/mp3; rate=8000'}, body: ab }
                    );
                  })
                  .then(function(r){ return r.text(); })
                  .then(function(txt){
                    var lines = txt.trim().split('\n'), transcript = '';
                    for(var i=0;i<lines.length;i++){
                      try{ var obj=JSON.parse(lines[i]); if(obj.result&&obj.result[0]){ transcript=obj.result[0].alternative[0].transcript; break; } }catch(e){}
                    }
                    if(!transcript) return;
                    var answer = transcript.trim().toLowerCase().replace(/[^a-z0-9\s]/g,'');
                    chrome.scripting.executeScript({
                      target: { tabId: tabId, allFrames: true },
                      func: function(ans){
                        var inp = document.querySelector('#audio-response,input[aria-label*="answer" i]');
                        if(inp){
                          inp.value = ans;
                          inp.dispatchEvent(new Event('input',{bubbles:true}));
                          inp.dispatchEvent(new Event('change',{bubbles:true}));
                          var btn = document.querySelector('#recaptcha-verify-button,button[type="submit"]');
                          if(btn) btn.click();
                        }
                      },
                      args: [answer]
                    }, function(){});
                  })
                  .catch(function(){});
              });
            }, 1500);
          });
        }, 1200);
      });

    } else if(type === 'checkpoint') {
      // Click any continue/approve button
      // Reset captchaAttempts if we moved past captcha
      chrome.storage.session.set({ loginSession: Object.assign({}, session, { captchaAttempts: 0 }) });
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function(){
          var kw=['continue','ok','confirm','this was me','approve','next','skip','done'];
          var btns=Array.from(document.querySelectorAll('button,[role="button"],input[type="submit"]'));
          for(var i=0;i<btns.length;i++){
            if(btns[i].offsetParent===null) continue;
            var txt=(btns[i].textContent||btns[i].value||'').toLowerCase().trim();
            if(kw.some(function(k){return txt.includes(k);})){btns[i].click();return true;}
          }
          return false;
        }
      }, function(){});

    } else if(type === 'success') {
      // Login complete — stop everything
      chrome.alarms.clear('loginPoll');
      chrome.storage.session.remove(['loginSession']);
      notifyPopup({ type: 'STATUS', msg: 'success' });

    } else if(type === 'login') {
      // Back on login page — maybe session expired, refill
      if(session.uid && session.pass && !session.twoFaDone){
        setTimeout(function(){
          autoFillLogin(tabId, session.uid, session.pass, session.secret || '');
        }, 600);
      }
    }
    // 'unknown' — just wait for next poll
  });
}

// ── Tab navigation listener: fires when Facebook page fully loads ──
chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
  if(info.status !== 'complete') return;
  if(!tab || !tab.url || !tab.url.includes('facebook.com')) return;

  var url = tab.url;
  var isLoginPage = url.includes('facebook.com/login');
  var isHomepage  = !!url.match(/^https:\/\/(www\.)?facebook\.com\/?(\?.*)?$/);

  chrome.storage.session.get(['loginSession'], function(data) {
    var session = data.loginSession;

    // Auto-login: no active session, on login page, creds saved
    if(isLoginPage && (!session || !session.active)){
      chrome.storage.local.get(['savedCreds'], function(d){
        if(!d.savedCreds) return;
        setTimeout(function(){
          autoFillLogin(tabId, d.savedCreds.uid, d.savedCreds.pass, d.savedCreds.secret || '');
        }, 800);
      });
      return;
    }

    // If on homepage and no active session, redirect to /login so auto-login can trigger
    if(isHomepage && (!session || !session.active)){
      chrome.storage.local.get(['savedCreds'], function(d){
        if(!d.savedCreds) return;
        // Navigate to /login page which will then trigger auto-fill above
        chrome.tabs.update(tabId, { url: 'https://www.facebook.com/login' });
      });
      return;
    }

    // Active session: handle page state
    if(!session || !session.active || session.tabId !== tabId) return;

    // Reset device/2fa flags on new page load so re-detection works
    var updatedSession = Object.assign({}, session, { deviceHandled: false, twoFaDone: false });
    chrome.storage.session.set({ loginSession: updatedSession });

    setTimeout(function(){
      handlePageState(tabId, updatedSession);
    }, 800);
  });
});

// ── Alarm-based polling (~every 2s) — survives popup close ────────
chrome.alarms.onAlarm.addListener(function(alarm) {
  if(alarm.name !== 'loginPoll') return;
  chrome.storage.session.get(['loginSession'], function(data) {
    var session = data.loginSession;
    if(!session || !session.active){
      chrome.alarms.clear('loginPoll');
      return;
    }
    handlePageState(session.tabId, session);
  });
});

// ── Messages from popup ───────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, respond) {
  if(msg.type === 'START_LOGIN') {
    var tabId = msg.tabId;
    var uid = msg.uid;
    var pass = msg.pass;
    var secret = msg.secret || '';
    autoFillLogin(tabId, uid, pass, secret);
    respond({ ok: true });

  } else if(msg.type === 'START_POLL') {
    chrome.alarms.clear('loginPoll', function(){
      chrome.alarms.create('loginPoll', { periodInMinutes: 0.034 });
    });
    respond({ ok: true });

  } else if(msg.type === 'STOP_POLL') {
    chrome.alarms.clear('loginPoll');
    chrome.storage.session.remove(['loginSession']);
    respond({ ok: true });

  } else if(msg.type === 'GET_SESSION') {
    chrome.storage.session.get(['loginSession'], function(data){
      respond({ session: data.loginSession || null });
    });
    return true; // async

  } else if(msg.type === 'SAVE_CREDS') {
    chrome.storage.local.set({ savedCreds: { uid: msg.uid, pass: msg.pass, secret: msg.secret || '' } });
    respond({ ok: true });
  }

  return true;
});
