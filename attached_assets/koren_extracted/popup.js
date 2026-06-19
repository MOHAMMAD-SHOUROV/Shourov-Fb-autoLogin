(function () {

  // ── BD Clock ──────────────────────────────────────────────
  function tick() {
    var el = document.getElementById('bdClock');
    if (!el) return;
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    var bd  = new Date(utc + 6 * 3600000);
    var h = bd.getHours(), m = bd.getMinutes(), s = bd.getSeconds();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    el.textContent = ('0'+h).slice(-2)+':'+('0'+m).slice(-2)+':'+('0'+s).slice(-2)+' '+ampm;
  }
  tick(); setInterval(tick, 1000);

  // ── TOTP / Base32 ─────────────────────────────────────────
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
      if(keyBytes.length===0) return '------';
      var counter=Math.floor(Date.now()/1000/30);
      var buf=new ArrayBuffer(8); new DataView(buf).setUint32(4,counter,false);
      var key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-1'},false,['sign']);
      var sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,buf));
      var o=sig[sig.length-1]&0x0f;
      var code=(((sig[o]&0x7f)<<24)|((sig[o+1]&0xff)<<16)|((sig[o+2]&0xff)<<8)|(sig[o+3]&0xff))%1000000;
      return String(code).padStart(6,'0');
    }catch(e){return '------';}
  }
  function secsLeft(){return 30-(Math.floor(Date.now()/1000)%30);}

  // ── State ─────────────────────────────────────────────────
  var uid='',pass='',secret='',totpCode='------';
  var loading=false,done=false,autoTimer=null,loginTabId=null,pollTimer=null;
  var toastTimer=null,navListener=null,twoFaInjected=false,pollAttempts=0;
  var captchaAttempts=0;
  var userName='';

  // ── DOM ───────────────────────────────────────────────────
  var comboInput   = document.getElementById('comboInput');
  var parsedRow    = document.getElementById('parsedRow');
  var pUid         = document.getElementById('pUid');
  var pPass        = document.getElementById('pPass');
  var pSecret      = document.getElementById('pSecret');
  var totpBox      = document.getElementById('totpBox');
  var totpCodeEl   = document.getElementById('totpCode');
  var countdownArc = document.getElementById('countdownArc');
  var countdownNum = document.getElementById('countdownNum');
  var progressWrap = document.getElementById('progressWrap');
  var progressFill = document.getElementById('progressFill');
  var stageLabel   = document.getElementById('stageLabel');
  var stagePct     = document.getElementById('stagePct');
  var loginBtn     = document.getElementById('loginBtn');
  var loginBtnText = document.getElementById('loginBtnText');
  var successBox   = document.getElementById('successBox');
  var usedCodeEl   = document.getElementById('usedCode');
  var toastEl      = document.getElementById('toast');
  var notifBannerEl = document.getElementById('notifBanner');

  // ── Helpers ───────────────────────────────────────────────
  function showToast(msg,color){
    color=color||'#1877F2';
    toastEl.textContent=msg;
    toastEl.style.background=color+'e8';
    toastEl.style.display='block';
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){toastEl.style.display='none';},1500);
  }
  function showAdminNotif(msg,color){
    if(!notifBannerEl) return;
    color=color||'#1877F2';
    notifBannerEl.innerHTML='<span style="flex:1;">'+msg+'</span><button onclick="this.parentElement.style.display=\'none\'" style="background:rgba(255,255,255,0.18);border:none;border-radius:50%;width:22px;height:22px;color:#fff;font-size:14px;cursor:pointer;line-height:1;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;">✕</button>';
    notifBannerEl.style.background='linear-gradient(135deg,'+color+','+color+'bb)';
    notifBannerEl.style.display='flex';
  }
  function setProgress(label,pct){
    progressWrap.style.display='flex';
    stageLabel.textContent=label;
    stagePct.textContent=pct+'%';
    progressFill.style.width=pct+'%';
  }
  function stopPoll(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
  function removeNavListener(){
    if(navListener){chrome.tabs.onUpdated.removeListener(navListener);navListener=null;}
  }

  // ── Copy to clipboard helper ──────────────────────────────
  function copyToClipboard(text, label) {
    if(!text || text === '—' || text === '------') { showToast('কিছু নেই copy করার', '#e53e3e'); return; }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){
        showToast('✅ ' + (label||'') + ' copied!', '#25D366');
      }).catch(function(){
        fallbackCopy(text, label);
      });
    } else {
      fallbackCopy(text, label);
    }
  }
  function fallbackCopy(text, label){
    var ta=document.createElement('textarea');
    ta.value=text; ta.style.cssText='position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); showToast('✅ '+(label||'')+' copied!','#25D366'); }
    catch(e){ showToast('Copy failed','#e53e3e'); }
    document.body.removeChild(ta);
  }

  // Setup copy buttons in parsedRow
  function setupParsedCopyBtns(){
    var cUid=document.getElementById('copyUid');
    var cPass=document.getElementById('copyPass');
    var cSecret=document.getElementById('copySecret');
    var cTotp=document.getElementById('copyTotp');
    if(cUid) cUid.onclick=function(){ copyToClipboard(uid,'UID'); };
    if(cPass) cPass.onclick=function(){ copyToClipboard(pass,'Password'); };
    if(cSecret) cSecret.onclick=function(){ copyToClipboard(secret,'2FA Secret'); };
    if(cTotp) cTotp.onclick=function(){ copyToClipboard(totpCode,'2FA Code'); };
  }
  setupParsedCopyBtns();

  // ── One-time auto-login tracking ──────────────────────────
  function isAutoLoginDone(theUid, cb){
    chrome.storage.local.get(['autoLoginedUids'], function(d){
      var done = d.autoLoginedUids || {};
      cb(!!done[theUid]);
    });
  }
  function markAutoLoginDone(theUid){
    chrome.storage.local.get(['autoLoginedUids'], function(d){
      var done = d.autoLoginedUids || {};
      done[theUid] = true;
      chrome.storage.local.set({ autoLoginedUids: done });
    });
  }

  // ── Parse input line ──────────────────────────────────────
  function parseLine(line){
    var trimmed=line.trim(); if(!trimmed) return false;
    var parts;
    if(trimmed.indexOf('\t')!==-1){
      parts=trimmed.split(/\t+/).map(function(p){return p.trim();}).filter(Boolean);
    }
    if(!parts||parts.length<2){
      parts=trimmed.split(/[ \t]{2,}/).map(function(p){return p.trim();}).filter(Boolean);
    }
    if(!parts||parts.length<2){
      parts=trimmed.split(/\s{2,}/).map(function(p){return p.trim();}).filter(Boolean);
    }
    if(parts.length>=2&&parts[0]&&parts[1]){
      uid=parts[0].replace(/\s/g,'');
      pass=parts[1].trim();
      secret=parts.length>=3?parts.slice(2).join('').replace(/\s/g,''):'';
      parsedRow.style.display='grid';
      pUid.textContent=uid||'—';
      pPass.textContent=pass?'••••••':'—';
      pSecret.textContent=secret?secret.slice(0,6)+'…':'নেই';
      if(secret){startTOTP();}else{totpBox.style.display='none';}
      loginBtn.disabled=false;
      chrome.storage.local.set({ savedCreds: { uid: uid, pass: pass, secret: secret } });
      return true;
    }
    parsedRow.style.display='none';
    totpBox.style.display='none';
    loginBtn.disabled=true;
    return false;
  }

  // ── TOTP display ──────────────────────────────────────────
  function startTOTP(){
    totpBox.style.display='flex';
    generateTOTP(secret).then(function(c){totpCode=c;totpCodeEl.textContent=c;});
    updateCountdown();
  }
  function updateCountdown(){
    var secs=secsLeft(),frac=secs/30,circ=94.2;
    if(countdownArc)countdownArc.style.strokeDasharray=(frac*circ)+' '+circ;
    if(countdownNum)countdownNum.textContent=secs;
    if(secs===30&&secret){generateTOTP(secret).then(function(c){totpCode=c;totpCodeEl.textContent=c;});}
  }

  // ── detectPageType — comprehensive, layered detection ─────
  function detectPageType(tabId,cb){
    chrome.scripting.executeScript({
      target:{tabId:tabId},
      func:function(){
        var url=location.href;
        var bodyText='';
        try{bodyText=(document.body.innerText||'').toLowerCase();}catch(e){}

        // ① "Trust this device" page — auto-click to save device
        if(
          url.includes('remember_browser')||
          url.includes('trust_this_device')||
          (bodyText.includes('trust this device')&&(url.includes('two_factor')||url.includes('checkpoint')||url.includes('login')))
        ){
          return 'trust_device';
        }

        // ① "Sign in as" multi-account chooser dialog — detect and auto-close
        var dialogs=Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"]'));
        for(var d=0;d<dialogs.length;d++){
          var dTxt=(dialogs[d].innerText||'').toLowerCase();
          if(dTxt.includes('sign in as')){return 'sign_in_as_dialog';}
        }
        // Also check heading text on page (non-modal variant)
        if(bodyText.includes('sign in as')&&(document.querySelector('[role="listbox"]')||document.querySelector('[role="list"]'))){
          return 'sign_in_as_dialog';
        }

        // ② PRIORITY: Visible code input = DEFINITELY twofa
        var tfaSels=[
          'input[name="approvals_code"]','input[name="mfa_code"]','input[name="code"]',
          'input[id*="approvals"]','input[id*="mfa"]',
          'input[autocomplete="one-time-code"]',
          'input[placeholder="Code"]','input[placeholder="code"]',
          'input[placeholder*="code" i]','input[placeholder*="কোড"]',
          'input[aria-label*="code" i]','input[aria-label*="authentication" i]',
        ];
        for(var i=0;i<tfaSels.length;i++){
          var el=document.querySelector(tfaSels[i]);
          if(el&&el.type!=='hidden'&&el.offsetParent!==null) return 'twofa';
        }

        // ③ Device notification approval
        if(
          bodyText.includes('waiting for approval')||
          bodyText.includes('check your notifications on another device')||
          bodyText.includes('we sent a notification to your')||
          bodyText.includes('check your facebook notifications')||
          url.includes('device_based_two_factor')||
          url.includes('approvals_required')
        ){
          var modal=document.querySelector('[role="dialog"]')||document.querySelector('[aria-modal="true"]');
          if(modal){
            var mt=(modal.innerText||'').toLowerCase();
            if(mt.includes('authentication app')||mt.includes('choose a way')) return 'choose_method_modal';
          }
          return 'device_approval';
        }

        // ④ URL contains 2FA-specific patterns
        var tfaUrlKeywords=['two_step','two-factor','two_factor',
          'login/two','mfa','otp','verify_id'];
        for(var u=0;u<tfaUrlKeywords.length;u++){
          if(url.includes(tfaUrlKeywords[u])) return 'twofa';
        }

        // ⑤ Body text contains 2FA keywords
        var tfaTextKw=['go to your authentication app','6-digit','two-factor','two factor',
          'verification code','enter the code','enter code','approvals code',
          'confirmation code','security code','কোড লিখুন','কোড দিন'];
        for(var t=0;t<tfaTextKw.length;t++){
          if(bodyText.includes(tfaTextKw[t])) return 'twofa';
        }

        // ⑥ Checkpoint URL
        if(url.includes('checkpoint')||url.includes('approvals')){
          var ins=document.querySelectorAll('input[type="tel"],input[type="number"],input[type="text"]');
          for(var j=0;j<ins.length;j++){
            if(ins[j].offsetParent!==null&&!ins[j].name.match(/email|pass|user/i)) return 'twofa';
          }
          return 'checkpoint';
        }

        // ⑦ reCAPTCHA iframe
        if(document.querySelector('iframe[src*="recaptcha"]')) return 'recaptcha';

        if(url.includes('captcha')||url.includes('integrity')) return 'checkpoint';

        // ⑧ Still on login page
        if(url.includes('/login')||url.match(/facebook\.com\/login/)){
          var lIns=document.querySelectorAll('input[type="text"],input[type="tel"],input[type="number"]');
          for(var li=0;li<lIns.length;li++){
            if(lIns[li].offsetParent!==null&&!lIns[li].name.match(/email|pass|user/i)) return 'twofa';
          }
          return 'unknown';
        }

        // ⑨ Success — STRICT: require positive home page signals
        if(url.match(/facebook\.com/)){
          var tfaStillVisible=document.querySelector('input[placeholder="Code"]')||
            (bodyText.includes('authentication app'))||
            (bodyText.includes('6-digit'));
          if(tfaStillVisible) return 'twofa';

          var homeSigs=document.querySelector('[aria-label="Home"]')||
            document.querySelector('[data-pagelet="LeftRail"]')||
            document.querySelector('[role="feed"]')||
            document.querySelector('[aria-label="News Feed"]')||
            document.querySelector('[data-pagelet="Stories"]');
          if(homeSigs) return 'success';
        }

        return 'unknown';
      }
    },function(results){
      var r=results&&results[0]&&results[0].result;
      cb(r||'unknown');
    });
  }

  // ── Simulate realistic keyboard typing for 2FA ───────────
  function inject2FA(tabId,code,cb){
    chrome.scripting.executeScript({
      target:{tabId:tabId},
      func:function(c){
        var sels=[
          'input[name="approvals_code"]','input[name="mfa_code"]','input[name="code"]',
          'input[id*="approvals"]','input[id*="mfa"]',
          'input[autocomplete="one-time-code"]',
          'input[placeholder*="code" i]','input[placeholder*="কোড"]',
          'input[aria-label*="code" i]','input[type="tel"]','input[type="number"]',
        ];
        var inp=null;
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
              inp.dispatchEvent(new KeyboardEvent('keydown',{key:ch,code:'Digit'+ch,bubbles:true,cancelable:true}));
              inp.dispatchEvent(new KeyboardEvent('keypress',{key:ch,code:'Digit'+ch,bubbles:true,cancelable:true}));
              inp.dispatchEvent(new Event('input',{bubbles:true}));
              inp.dispatchEvent(new KeyboardEvent('keyup',{key:ch,code:'Digit'+ch,bubbles:true,cancelable:true}));
              if(idx===c.length-1){
                setTimeout(function(){
                  inp.dispatchEvent(new Event('change',{bubbles:true}));
                  var btn=document.querySelector('[data-testid="two_factor_auth_confirm_button"]');
                  if(!btn){
                    var allBtns=Array.from(document.querySelectorAll('button,[role="button"]'));
                    var kws=['continue','submit','confirm','verify','next','ok','done'];
                    for(var b=0;b<allBtns.length;b++){
                      var bTxt=(allBtns[b].textContent||'').toLowerCase().trim();
                      if(allBtns[b].offsetParent!==null&&kws.some(function(k){return bTxt.includes(k);})){
                        btn=allBtns[b];break;
                      }
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
      args:[code]
    },function(results){
      var r=results&&results[0]&&results[0].result;
      cb(r==='injected');
    });
  }

  // ── reCAPTCHA auto-solver (audio challenge + STT) ─────────
  function solveRecaptcha(tabId){
    setProgress('reCAPTCHA সমাধান করছি...', 62);
    loginBtnText.innerHTML='⏳ reCAPTCHA চেষ্টা করছি...';
    showToast('reCAPTCHA পাওয়া গেছে — audio challenge চেষ্টা করছি!','#f59e0b');

    chrome.scripting.executeScript({
      target:{tabId:tabId,allFrames:true},
      func:function(){
        var cb=document.querySelector('#recaptcha-anchor,.recaptcha-checkbox-border,.recaptcha-checkbox');
        if(cb&&cb.offsetParent!==null){cb.click();return 'clicked';}
        return null;
      }
    },function(res1){
      setTimeout(function(){
        chrome.scripting.executeScript({
          target:{tabId:tabId,allFrames:true},
          func:function(){
            var audioBtn=document.querySelector('#recaptcha-audio-button,button[aria-labelledby*="audio-instructions"],button.rc-button-audio');
            if(audioBtn&&audioBtn.offsetParent!==null){audioBtn.click();return 'audio_clicked';}
            return null;
          }
        },function(res2){
          setTimeout(function(){
            chrome.scripting.executeScript({
              target:{tabId:tabId,allFrames:true},
              func:function(){
                var src=document.querySelector('#audio-source,audio source,audio');
                if(src){
                  var url=src.src||src.getAttribute('src')||null;
                  if(url) return url;
                }
                return null;
              }
            },function(res3){
              var audioUrl=null;
              if(res3){for(var i=0;i<res3.length;i++){if(res3[i]&&res3[i].result){audioUrl=res3[i].result;break;}}}
              if(!audioUrl){
                showToast('reCAPTCHA audio URL পাওয়া যায়নি — manual করুন','#e53e3e');
                captchaAttempts=0;
                return;
              }
              setProgress('Audio ডাউনলোড করছি...', 68);
              fetch(audioUrl)
                .then(function(r){return r.arrayBuffer();})
                .then(function(ab){
                  setProgress('Speech-to-Text চলছে...', 74);
                  return fetch(
                    'https://www.google.com/speech-api/v2/recognize?output=json&lang=en-us&key=AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgY',
                    {method:'POST',headers:{'Content-Type':'audio/mp3; rate=8000'},body:ab}
                  );
                })
                .then(function(r){return r.text();})
                .then(function(txt){
                  var lines=txt.trim().split('\n');
                  var transcript='';
                  for(var i=0;i<lines.length;i++){
                    try{
                      var obj=JSON.parse(lines[i]);
                      if(obj.result&&obj.result[0]&&obj.result[0].alternative){
                        transcript=obj.result[0].alternative[0].transcript;
                        break;
                      }
                    }catch(e){}
                  }
                  if(!transcript){showToast('Audio transcribe হয়নি','#e53e3e');return;}
                  var answer=transcript.trim().toLowerCase().replace(/[^a-z0-9\s]/g,'');
                  showToast('reCAPTCHA উত্তর: "'+answer+'"','#25D366');
                  chrome.scripting.executeScript({
                    target:{tabId:tabId,allFrames:true},
                    func:function(ans){
                      var inp=document.querySelector('#audio-response,input[aria-label*="answer" i],input[id*="response"]');
                      if(inp){
                        inp.value=ans;
                        inp.dispatchEvent(new Event('input',{bubbles:true}));
                        inp.dispatchEvent(new Event('change',{bubbles:true}));
                        var verifyBtn=document.querySelector('#recaptcha-verify-button,button[type="submit"]');
                        if(verifyBtn) verifyBtn.click();
                        return 'submitted';
                      }
                      return null;
                    },
                    args:[answer]
                  },function(res5){
                    setProgress('reCAPTCHA জমা দেওয়া হয়েছে ✅',78);
                    showToast('reCAPTCHA সমাধান হয়েছে ✅','#25D366');
                    captchaAttempts=0;
                  });
                })
                .catch(function(){
                  showToast('reCAPTCHA transcribe error — manual করুন','#e53e3e');
                  captchaAttempts=0;
                });
            });
          },1500);
        });
      },1200);
    });
  }

  // ── Facebook checkpoint button auto-click ─────────────────
  function injectCheckpointClick(tabId,cb){
    chrome.scripting.executeScript({
      target:{tabId:tabId},
      func:function(){
        var kw=['continue','ok','confirm','approve','this was me','এটা আমি','আমি ছিলাম',
          'continue as','yes, it was me','সঠিক','পরবর্তী','next','submit','i approve',
          'secure account','skip','done','got it','বুঝেছি','not now','এখন না'];
        var allBtns=Array.from(document.querySelectorAll('button,input[type="submit"],a[role="button"],[role="button"]'));
        for(var i=0;i<allBtns.length;i++){
          var el=allBtns[i];
          if(el.offsetParent===null) continue;
          var txt=(el.textContent||el.value||el.getAttribute('aria-label')||'').toLowerCase().trim();
          if(kw.some(function(k){return txt.includes(k);})){el.click();return true;}
        }
        var primary=document.querySelector('[data-testid="royal_login_button"]')||
                    document.querySelector('button[type="submit"]')||
                    document.querySelector('input[type="submit"]');
        if(primary&&primary.offsetParent!==null){primary.click();return true;}
        return false;
      }
    },function(results){cb(results&&results[0]&&results[0].result);});
  }

  // ── Auto-click "Trust this device" + block notification popup ──
  function handleTrustDevice(tabId, cb){
    // First, block the notification permission popup via contentSettings
    try{
      chrome.contentSettings.notifications.set({
        primaryPattern:'https://www.facebook.com/*',
        setting:'block'
      });
      chrome.contentSettings.notifications.set({
        primaryPattern:'https://m.facebook.com/*',
        setting:'block'
      });
    }catch(e){}

    // Dismiss the browser notification infobar by injecting script to deny
    chrome.scripting.executeScript({
      target:{tabId:tabId},
      func:function(){
        // Override Notification API to prevent future popups
        try{
          Object.defineProperty(Notification,'permission',{get:function(){return 'denied';},configurable:true});
          window.Notification={permission:'denied',requestPermission:function(){return Promise.resolve('denied');}};
        }catch(e){}

        // Click "Trust this device" button
        var allBtns=Array.from(document.querySelectorAll('button,input[type="submit"],[role="button"],a'));
        var trustBtn=null;
        var kw=['trust this device','এই ডিভাইস বিশ্বাস করুন','trust device','remember this device','remember browser'];
        for(var i=0;i<allBtns.length;i++){
          var txt=(allBtns[i].textContent||allBtns[i].value||allBtns[i].getAttribute('aria-label')||'').toLowerCase().trim();
          if(kw.some(function(k){return txt.includes(k);})){trustBtn=allBtns[i];break;}
        }
        if(!trustBtn){
          // Fallback: look for the main CTA button on the page
          trustBtn=document.querySelector('[data-testid*="trust"],[data-testid*="remember"]');
        }
        if(!trustBtn){
          // Last fallback: any prominent submit/continue button
          var btns=Array.from(document.querySelectorAll('button[type="submit"],button'));
          for(var j=0;j<btns.length;j++){
            if(btns[j].offsetParent!==null){trustBtn=btns[j];break;}
          }
        }
        if(trustBtn&&trustBtn.offsetParent!==null){trustBtn.click();return 'clicked';}
        return 'not_found';
      }
    },function(results){
      var r=results&&results[0]&&results[0].result;
      if(cb) cb(r==='clicked');
    });
  }

  // ── Close "Sign in as" dialog ─────────────────────────────
  function closeSignInAsDialog(tabId, cb){
    chrome.scripting.executeScript({
      target:{tabId:tabId},
      func:function(){
        // Find close button in the dialog
        var btns=Array.from(document.querySelectorAll('button,[role="button"]'));
        for(var i=0;i<btns.length;i++){
          var txt=(btns[i].textContent||btns[i].getAttribute('aria-label')||'').toLowerCase().trim();
          if(txt==='close'||txt==='বন্ধ'||txt==='বন্ধ করুন'){
            btns[i].click(); return 'closed_by_text';
          }
        }
        // Try aria-label="Close"
        var closeBtn=document.querySelector('[aria-label="Close"],[aria-label="close"],[aria-label="বন্ধ করুন"]');
        if(closeBtn&&closeBtn.offsetParent!==null){closeBtn.click();return 'closed_by_aria';}
        // Try pressing Escape key
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true,cancelable:true}));
        return 'escape_sent';
      }
    },function(results){
      var r=results&&results[0]&&results[0].result;
      cb(r);
    });
  }

  // ── Handle a completed page navigation ────────────────────
  function handlePageLoad(tabId){
    detectPageType(tabId,function(type){
      if(type==='trust_device'){
        // Block notification permission popup + click "Trust this device"
        setProgress('"Trust this device" ক্লিক করছি...',92);
        loginBtnText.innerHTML='⏳ Trust this device ক্লিক করছি...';
        showToast('"Trust this device" পাওয়া গেছে — ক্লিক করছি...','#25D366');
        handleTrustDevice(tabId,function(clicked){
          if(clicked){
            setProgress('"Trust this device" সম্পন্ন ✅',96);
            showToast('"Trust this device" ক্লিক হয়েছে ✅','#25D366');
          }else{
            showToast('Trust device button পাওয়া যায়নি, retry...','#f59e0b');
          }
        });
      }else if(type==='sign_in_as_dialog'){
        // Auto-close the "Sign in as" chooser and then fill the login form
        setProgress('"Sign in as" dialog বন্ধ করছি...',15);
        loginBtnText.innerHTML='⏳ Account chooser বন্ধ করছি...';
        showToast('"Sign in as" dialog পাওয়া গেছে — বন্ধ করছি...','#f59e0b');
        closeSignInAsDialog(tabId, function(){
          setTimeout(function(){
            // After closing, navigate to clean login page and fill
            chrome.tabs.update(tabId,{url:'https://www.facebook.com/login'},function(){
              chrome.tabs.onUpdated.addListener(function navL(id,info,tab){
                if(id!==tabId||info.status!=='complete') return;
                var tabUrl=(tab&&tab.url)||'';
                if(isRedirectHop(tabUrl)) return;
                chrome.tabs.onUpdated.removeListener(navL);
                setTimeout(function(){injectLoginForm(tabId);},800);
              });
            });
          },600);
        });
      }else if(type==='device_approval'){
        setProgress('Device approval — অন্য উপায় খুঁজছি...',55);
        loginBtnText.innerHTML='⏳ "Try Another Way" ক্লিক করছি...';
        showToast('"Try Another Way" ক্লিক করছি...','#f59e0b');
        chrome.scripting.executeScript({
          target:{tabId:tabId},
          func:function(){
            var allBtns=Array.from(document.querySelectorAll('button,a,[role="button"]'));
            for(var i=0;i<allBtns.length;i++){
              var txt=(allBtns[i].textContent||allBtns[i].getAttribute('aria-label')||'').toLowerCase().trim();
              if(txt.includes('try another way')||txt.includes('another way')||txt.includes('অন্য উপায়')){
                allBtns[i].click(); return 'clicked';
              }
            }
            return 'not_found';
          }
        },function(res){
          var r=res&&res[0]&&res[0].result;
          if(r==='clicked') showToast('"Try Another Way" ক্লিক! ✅','#25D366');
        });
      }else if(type==='choose_method_modal'){
        setProgress('Authentication App সিলেক্ট করছি...',62);
        loginBtnText.innerHTML='⏳ Auth App সিলেক্ট করছি...';
        showToast('"Authentication app" সিলেক্ট করছি...','#f59e0b');
        chrome.scripting.executeScript({
          target:{tabId:tabId},
          func:function(){
            var modal=document.querySelector('[role="dialog"]')||document.querySelector('[aria-modal="true"]')||document.body;
            var radios=Array.from(modal.querySelectorAll('input[type="radio"]'));
            var authRadio=null;
            for(var r=0;r<radios.length;r++){
              var label='';
              if(radios[r].labels&&radios[r].labels.length) label=(radios[r].labels[0].textContent||'').toLowerCase();
              var parent=radios[r].closest('label')||radios[r].parentElement;
              if(parent) label+=' '+(parent.textContent||'').toLowerCase();
              if(label.includes('authentication app')||label.includes('authenticator')){authRadio=radios[r];break;}
            }
            if(!authRadio){
              var rows=Array.from(modal.querySelectorAll('[role="radio"],[role="option"],[role="listitem"],label,li'));
              for(var i=0;i<rows.length;i++){
                var rowTxt=(rows[i].textContent||'').toLowerCase();
                if(rowTxt.includes('authentication app')||rowTxt.includes('authenticator')){
                  rows[i].click();
                  setTimeout(function(){
                    var btns=Array.from(modal.querySelectorAll('button,[role="button"]'));
                    for(var b=0;b<btns.length;b++){
                      var bTxt=(btns[b].textContent||'').toLowerCase().trim();
                      if(bTxt.includes('continue')||bTxt.includes('next')){btns[b].click();break;}
                    }
                  },400);
                  return 'clicked_row';
                }
              }
            }
            if(authRadio){
              authRadio.click(); authRadio.checked=true;
              authRadio.dispatchEvent(new Event('change',{bubbles:true}));
              setTimeout(function(){
                var btns=Array.from(modal.querySelectorAll('button,[role="button"]'));
                for(var b=0;b<btns.length;b++){
                  var bTxt=(btns[b].textContent||'').toLowerCase().trim();
                  if(bTxt.includes('continue')||bTxt.includes('next')){btns[b].click();break;}
                }
              },400);
              return 'selected';
            }
            return 'not_found';
          }
        },function(res){
          var r=res&&res[0]&&res[0].result;
          if(r==='selected'||r==='clicked_row') showToast('Authentication App সিলেক্ট হয়েছে ✅','#25D366');
        });
      }else if(type==='twofa'){
        if(twoFaInjected) return;
        if(!secret){
          stopPoll(); loading=false;
          setProgress('2FA দরকার! Secret দিন',70);
          showToast('2FA চাওয়া হচ্ছে — UID[Tab]Pass[Tab]2FA_Secret দিয়ে আবার দিন','#f59e0b');
          loginBtnText.textContent='Auto Login করুন';
          return;
        }
        twoFaInjected=true;
        setProgress('2FA কোড টাইপ করা হচ্ছে...',80);
        loginBtnText.innerHTML='⏳ 2FA দেওয়া হচ্ছে...';
        generateTOTP(secret).then(function(newCode){
          inject2FA(tabId,newCode,function(ok){
            if(ok){
              setProgress('2FA দেওয়া হয়েছে ✅',90);
              loginBtnText.innerHTML='✅ 2FA সম্পন্ন!';
              usedCodeEl.textContent='2FA: '+newCode;
              successBox.style.display='block';
              showToast('2FA কোড '+newCode+' দেওয়া হয়েছে ✅','#25D366');
            }else{
              twoFaInjected=false;
              showToast('2FA input পাওয়া যায়নি, retry...','#f59e0b');
            }
          });
        });
      }else if(type==='recaptcha'){
        if(captchaAttempts>0) return;
        captchaAttempts++;
        solveRecaptcha(tabId);
      }else if(type==='checkpoint'){
        captchaAttempts=0;
        setProgress('Checkpoint — button ক্লিক করছি...',60);
        loginBtnText.innerHTML='⏳ Checkpoint সমাধান করছি...';
        injectCheckpointClick(tabId,function(clicked){
          if(clicked) showToast('Checkpoint button ক্লিক! ⏳','#f59e0b');
        });
      }else if(type==='success'){
        stopPoll(); removeNavListener();
        // Save UID so it cannot auto-login again
        chrome.storage.local.get(['loginedUids'], function(d){ var l=d.loginedUids||[]; if(l.indexOf(uid)===-1){l.push(uid);} chrome.storage.local.set({loginedUids:l}); });
        fetch('https://nusaiba-it-center-2478.onrender.com/api/extension/ping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:uid,name:userName})}).catch(function(){});
        setProgress('লগইন সম্পন্ন! ✅',100);
        loginBtnText.innerHTML='✅ লগইন সম্পন্ন!';
        usedCodeEl.textContent='Login Success ✅';
        successBox.style.display='block';
        showToast('লগইন সফল! ✅','#25D366');
        // Mark this UID as auto-login done
        if(uid) markAutoLoginDone(uid);
        loading=false; done=true;
      }
    });
  }

  // ── Tab navigation listener for instant detection ─────────
  function attachNavListener(tabId){
    removeNavListener();
    navListener=function(id,info){
      if(id!==tabId||info.status!=='complete') return;
      setTimeout(function(){handlePageLoad(tabId);},600);
    };
    chrome.tabs.onUpdated.addListener(navListener);
  }

  // ── Polling (fallback every 2s) ───────────────────────────
  function startPolling(tabId){
    stopPoll(); pollAttempts=0;
    pollTimer=setInterval(function(){
      pollAttempts++;
      if(pollAttempts>40){
        stopPoll(); removeNavListener(); loading=false;
        showToast('Timeout — আবার চেষ্টা করুন','#e53e3e');
        loginBtnText.textContent='Auto Login করুন';
        return;
      }
      detectPageType(tabId,function(type){
        if(type==='trust_device'){handlePageLoad(tabId);}
        else if(type==='sign_in_as_dialog'){handlePageLoad(tabId);}
        else if(type==='device_approval'){handlePageLoad(tabId);}
        else if(type==='choose_method_modal'){handlePageLoad(tabId);}
        else if(type==='twofa'&&!twoFaInjected){handlePageLoad(tabId);}
        else if(type==='recaptcha'&&captchaAttempts===0){handlePageLoad(tabId);}
        else if(type==='checkpoint'){handlePageLoad(tabId);}
        else if(type==='success'){handlePageLoad(tabId);}
      });
    },2000);
  }

  // ── Fill login form and submit ────────────────────────────
  function injectLoginForm(tabId){
    chrome.scripting.executeScript({
      target:{tabId:tabId},
      func:function(email,pw){
        function setVal(el,val){
          try{
            var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
            if(d&&d.set)d.set.call(el,val); else el.value=val;
          }catch(e){el.value=val;}
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
          el.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true}));
        }
        var emailEl=document.querySelector('input[name="email"]')||document.getElementById('email');
        var passEl=document.querySelector('input[name="pass"]')||document.getElementById('pass');
        if(!emailEl||!passEl) return 'not_found';
        emailEl.focus(); setVal(emailEl,email);
        setTimeout(function(){
          passEl.focus(); setVal(passEl,pw);
          setTimeout(function(){
            var btn=document.querySelector('[data-testid="royal_login_button"]')||
                    document.querySelector('button[name="login"]')||
                    document.querySelector('button[type="submit"]')||
                    document.querySelector('input[type="submit"]');
            if(btn) btn.click();
          },400);
        },200);
        return 'filled';
      },
      args:[uid,pass]
    },function(results){
      if(chrome.runtime.lastError){
        // Script injection failed (likely a redirect page without permission) — retry after a moment
        showToast('Redirect page — আবার চেষ্টা করছি...','#f59e0b');
        setTimeout(function(){
          chrome.tabs.get(tabId, function(t){
            if(chrome.runtime.lastError) return;
            if(t && t.url && (t.url.includes('www.facebook.com/login')||t.url.includes('m.facebook.com/login')||t.url.includes('web.facebook.com/login'))){
              injectLoginForm(tabId);
            }
          });
        },1500);
        return;
      }
      var res=results&&results[0]&&results[0].result;
      if(res==='not_found'){
        showToast('Login form পাওয়া যায়নি!','#e53e3e');
        loading=false; loginBtnText.textContent='Auto Login করুন'; return;
      }
      setProgress('Email & Password দেওয়া হয়েছে ✅',40);
      loginBtnText.innerHTML='⏳ লগইন হচ্ছে...';
      showToast('Email & Password দেওয়া হয়েছে ✅','#1877F2');
      chrome.storage.session.set({
        loginSession: { active: true, uid: uid, pass: pass, secret: secret, tabId: tabId, twoFaDone: false, deviceHandled: false }
      });
      chrome.runtime.sendMessage({ type: 'START_POLL' }).catch(function(){});
      attachNavListener(tabId);
      setTimeout(function(){startPolling(tabId);},3000);
    });
  }

  // ── Main login flow ───────────────────────────────────────
  function runLogin(){
    if(loading||!uid||!pass) return;
    // Block if this UID was already auto-logged in once
    chrome.storage.local.get(['loginedUids'], function(d) {
      var used = d.loginedUids || [];
      if(used.indexOf(uid) !== -1) {
        showToast('⛔ এই ID দিয়ে আগেই Login হয়েছে! একটি ID মাত্র ১ বার কাজ করবে।', '#e53e3e');
        return;
      }
      _doRunLogin();
    });
  }
  function _doRunLogin(){
    if(loading||!uid||!pass) return;
    if(done){
      done=false; successBox.style.display='none';
      progressWrap.style.display='none';
      loginBtnText.textContent='Auto Login করুন';
    }
    loading=true; twoFaInjected=false; captchaAttempts=0;
    stopPoll(); removeNavListener();
    setProgress('শুরু হচ্ছে...',5);
    loginBtnText.innerHTML='⏳ Tab খোঁজা হচ্ছে...';

    var currentUid=uid, currentPass=pass, currentSecret=secret;
    chrome.storage.session.remove(['loginSession'], function(){
      chrome.storage.local.set({ savedCreds: { uid: currentUid, pass: currentPass, secret: currentSecret } }, function(){
        var SERVER_CHECK = 'https://nusaiba-it-center-2478.onrender.com/api/extension/check';
        fetch(SERVER_CHECK + '?uid=' + encodeURIComponent(currentUid), { signal: AbortSignal.timeout(2500) })
          .then(function(r){ return r.json(); })
          .then(function(d){
            if(d.allowed === false){
              showToast('⛔ ' + (d.reason || 'Extension বন্ধ আছে'), '#e53e3e');
              loading = false;
              loginBtnText.textContent = 'Auto Login করুন';
              return;
            }
            startLoginFlow();
          })
          .catch(function(){ startLoginFlow(); });
      });
    });
  }

  // Called from manual button / chip click (always runs, ignores one-time tracking)
  function runLoginForced(){
    runLogin();
  }

  var FB_URL_PATTERNS = ['https://www.facebook.com/*','https://m.facebook.com/*','https://web.facebook.com/*'];
  // Returns true if this URL is the web.facebook.com redirect hop (not the real login page)
  function isRedirectHop(url){ return url && url.includes('web.facebook.com') && (url.includes('_rdr') || url.includes('_rdc')); }

  function startLoginFlow(){
    chrome.tabs.query({url: FB_URL_PATTERNS},function(fbTabs){
      if(fbTabs&&fbTabs.length>0){
        loginTabId=fbTabs[0].id;
        chrome.tabs.update(loginTabId,{active:true});
        var url=fbTabs[0].url||'';
        showToast('খোলা Facebook tab পাওয়া গেছে!','#1877F2');

        if(url.includes('checkpoint')||url.includes('approvals')||url.includes('captcha')){
          setProgress('Checkpoint/2FA page পাওয়া গেছে',55);
          attachNavListener(loginTabId);
          startPolling(loginTabId);
          handlePageLoad(loginTabId);
        }else if(url.includes('/login')){
          // Check for "Sign in as" first
          setTimeout(function(){
            detectPageType(loginTabId,function(type){
              if(type==='sign_in_as_dialog'){
                handlePageLoad(loginTabId);
              }else{
                injectLoginForm(loginTabId);
              }
            });
          },400);
        }else{
          setProgress('Login page এ যাচ্ছি...',15);
          loginBtnText.innerHTML='⏳ Login page এ যাচ্ছি...';
          chrome.tabs.update(loginTabId,{url:'https://www.facebook.com/login'},function(){
            chrome.tabs.onUpdated.addListener(function navL(id,info,tab){
              if(id!==loginTabId||info.status!=='complete') return;
              var tabUrl=(tab&&tab.url)||'';
              if(isRedirectHop(tabUrl)) return; // skip the web.facebook.com redirect page
              chrome.tabs.onUpdated.removeListener(navL);
              setTimeout(function(){
                detectPageType(loginTabId,function(type){
                  if(type==='sign_in_as_dialog'){
                    handlePageLoad(loginTabId);
                  }else{
                    injectLoginForm(loginTabId);
                  }
                });
              },800);
            });
          });
        }
      }else{
        chrome.tabs.query({active:true,currentWindow:true},function(active){
          if(!active||!active.length){
            loading=false;showToast('Tab পাওয়া যায়নি','#e53e3e');return;
          }
          loginTabId=active[0].id;
          setProgress('Facebook login page খোলা হচ্ছে...',15);
          chrome.tabs.update(loginTabId,{url:'https://www.facebook.com/login'},function(){
            chrome.tabs.onUpdated.addListener(function navL(id,info,tab){
              if(id!==loginTabId||info.status!=='complete') return;
              var tabUrl=(tab&&tab.url)||'';
              if(isRedirectHop(tabUrl)) return; // skip the web.facebook.com redirect page
              chrome.tabs.onUpdated.removeListener(navL);
              setTimeout(function(){
                detectPageType(loginTabId,function(type){
                  if(type==='sign_in_as_dialog'){
                    handlePageLoad(loginTabId);
                  }else{
                    injectLoginForm(loginTabId);
                  }
                });
              },600);
            });
          });
        });
      }
    });
  }

  // ── Restore state when popup is reopened ─────────────────
  (function restoreState(){
    chrome.storage.local.get(['savedCreds'], function(d){
      if(!d.savedCreds) return;
      var creds = d.savedCreds;
      var line = creds.uid + '\t' + creds.pass + (creds.secret ? '\t' + creds.secret : '');
      comboInput.value = line;
      parseLine(line);

      chrome.storage.session.get(['loginSession'], function(s){
        var session = s.loginSession;
        if(!session || !session.active) return;
        loginTabId = session.tabId;
        loading = true;

        setProgress('Background এ চলছে... (resumed)', 30);
        loginBtnText.innerHTML = '⏳ Background এ login চলছে...';
        showToast('Background এ login চলছে — popup খোলা থাকলে update দেখবেন', '#1877F2');

        stopPoll(); pollAttempts = 0;
        pollTimer = setInterval(function(){
          pollAttempts++;
          if(pollAttempts > 120){ stopPoll(); return; }
          chrome.storage.session.get(['loginSession'], function(sd){
            if(!sd.loginSession || !sd.loginSession.active){
              stopPoll();
              setProgress('লগইন সম্পন্ন হয়েছে ✅', 100);
              loginBtnText.innerHTML = '✅ লগইন সম্পন্ন!';
              usedCodeEl.textContent = 'Login Success ✅';
              successBox.style.display = 'block';
              loading = false; done = true;
            }
          });
        }, 2000);
      });
    });
  })();

  // ── Broadcast + Extension status check on popup open ──────
  var adminBannerEl = document.getElementById('adminBanner');
  var updateBannerEl = document.getElementById('updateBanner');

  function showUpdateBanner(latestVer) {
    if(!updateBannerEl) return;
    var downloadUrl = 'https://nusaiba-it-center-2478.onrender.com/api/extension/download';
    updateBannerEl.innerHTML = '🆕 নতুন version আছে! (v' + latestVer + ') — <a href="' + downloadUrl + '" target="_blank" style="color:#fff;font-weight:900;text-decoration:underline;">Download করুন ↗</a>';
    updateBannerEl.style.display = 'block';
    updateBannerEl.style.background = 'linear-gradient(135deg,#7c3aed,#5b21b6)';
    updateBannerEl.style.color = '#fff';
    updateBannerEl.style.padding = '9px 14px';
    updateBannerEl.style.borderRadius = '8px';
    updateBannerEl.style.fontSize = '12px';
    updateBannerEl.style.fontWeight = '700';
    updateBannerEl.style.textAlign = 'center';
    updateBannerEl.style.margin = '6px 0 2px';
    updateBannerEl.style.lineHeight = '1.5';
    updateBannerEl.style.cursor = 'pointer';
  }

  function showAdminBanner(msg, color){
    if(!adminBannerEl) return;
    adminBannerEl.textContent = msg;
    adminBannerEl.style.display = 'block';
    adminBannerEl.style.background = color || '#e53e3e';
    adminBannerEl.style.color = '#fff';
    adminBannerEl.style.padding = '8px 14px';
    adminBannerEl.style.borderRadius = '8px';
    adminBannerEl.style.fontSize = '12px';
    adminBannerEl.style.fontWeight = '700';
    adminBannerEl.style.textAlign = 'center';
    adminBannerEl.style.margin = '6px 0 2px';
    adminBannerEl.style.lineHeight = '1.4';
  }

  function hideAdminBanner(){
    if(adminBannerEl) adminBannerEl.style.display = 'none';
  }

  // ── Name Modal ────────────────────────────────────────────
  function showNameModal(onDone) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:9999;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#0d1e3a;border:1px solid rgba(24,119,242,0.5);border-radius:16px;padding:28px 22px;width:270px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.7);';
    var title = document.createElement('div');
    title.style.cssText = 'color:#fff;font-size:16px;font-weight:800;margin-bottom:6px;';
    title.textContent = '👋 আপনার নাম দিন';
    var sub = document.createElement('div');
    sub.style.cssText = 'color:rgba(255,255,255,0.45);font-size:12px;margin-bottom:18px;line-height:1.5;';
    sub.textContent = 'Admin আপনার নাম দেখতে পাবে। একবারই লাগবে।';
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'আপনার নাম লিখুন...';
    input.style.cssText = 'width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:10px;padding:10px 14px;color:#fff;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:14px;font-family:inherit;';
    var btn = document.createElement('button');
    btn.textContent = '✅ সেভ করুন';
    btn.style.cssText = 'width:100%;background:linear-gradient(135deg,#1877F2,#0d5fc7);border:none;border-radius:10px;padding:11px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;';
    function save() {
      var n = input.value.trim();
      if(!n){ input.style.border='1px solid #e53e3e'; input.focus(); return; }
      userName = n;
      chrome.storage.local.set({ userName: n });
      overlay.remove();
      if(onDone) onDone();
    }
    btn.onclick = save;
    input.addEventListener('keydown', function(e){ if(e.key==='Enter') save(); });
    box.appendChild(title); box.appendChild(sub); box.appendChild(input); box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(function(){ input.focus(); }, 80);
  }

  // ── Startup: load name + UID, then check server ───────────
  chrome.storage.local.get(['userName', 'savedCreds'], function(stored) {
    if(stored.userName) {
      userName = stored.userName;
    }
    var checkUid = (stored.savedCreds && stored.savedCreds.uid) ? stored.savedCreds.uid : '';

    function doServerCheck() {
      var url = 'https://nusaiba-it-center-2478.onrender.com/api/extension/check';
      var params = [];
      if(checkUid) params.push('uid=' + encodeURIComponent(checkUid));
      if(userName) params.push('name=' + encodeURIComponent(userName));
      if(params.length) url += '?' + params.join('&');
      fetch(url, { signal: AbortSignal.timeout(3000) })
        .then(function(r){ return r.json(); })
        .then(function(d){
          if(d.allowed === false){
            loginBtn.disabled = true;
            loginBtn.style.opacity = '0.45';
            loginBtn.style.cursor = 'not-allowed';
            showAdminBanner('🔴 ' + (d.reason || 'Extension বন্ধ আছে'), '#c0392b');
          } else {
            hideAdminBanner();
          }
          if(d.notification){
            setTimeout(function(){ showAdminNotif('⚡ ' + d.notification, '#7c3aed'); }, 400);
          } else if(d.broadcastMessage){
            setTimeout(function(){ showAdminNotif('📢 ' + d.broadcastMessage, '#1877F2'); }, 600);
          }
          if(d.latestVersion) {
            var myVersion = '1.6.3';
            if(d.latestVersion !== myVersion) {
              showUpdateBanner(d.latestVersion);
            }
          }
        })
        .catch(function(){});
    }

    if(!stored.userName) {
      showNameModal(doServerCheck);
    } else {
      doServerCheck();
    }
  });

  // ── Event listeners ───────────────────────────────────────
  comboInput.addEventListener('input',function(){
    done=false;loading=false;twoFaInjected=false;captchaAttempts=0;
    successBox.style.display='none';
    loginBtnText.textContent='Auto Login করুন';
    progressWrap.style.display='none';
    stopPoll();removeNavListener();clearTimeout(autoTimer);
    if(parseLine(comboInput.value.trim())){
      // Only auto-login if this UID hasn't been logged in before (check both systems)
      (function(capturedUid){
        chrome.storage.local.get(['loginedUids','autoLoginedUids'], function(d){
          var loggedList = d.loginedUids || [];
          var loggedMap  = d.autoLoginedUids || {};
          var alreadyDone = loggedList.indexOf(capturedUid) !== -1 || !!loggedMap[capturedUid];
          if(!alreadyDone){
            autoTimer=setTimeout(function(){runLogin();},350);
          } else {
            showToast('✅ এই ID ইতিমধ্যে লগইন হয়েছে — আবার লগইন হবে না', '#25D366');
          }
        });
      })(uid);
    }
  });

  loginBtn.addEventListener('click', runLoginForced);
  setInterval(updateCountdown,1000);

  // ── Saved Accounts (Multi-ID) Management ─────────────────
  var saveBtn = document.getElementById('saveBtn');
  var savedAccountsWrap = document.getElementById('savedAccountsWrap');
  var savedAccountsList = document.getElementById('savedAccountsList');
  var clearAllBtn = document.getElementById('clearAllBtn');
  var MAX_SAVED = 10;

  function loadSavedAccounts(cb){
    chrome.storage.local.get(['savedAccounts'], function(d){
      cb(Array.isArray(d.savedAccounts) ? d.savedAccounts : []);
    });
  }

  function persistSavedAccounts(arr){
    chrome.storage.local.set({ savedAccounts: arr }, function(){
      renderSavedAccounts();
    });
  }

  // Copy SVG icon
  var COPY_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  function renderSavedAccounts(){
    loadSavedAccounts(function(arr){
      if(!arr.length){
        savedAccountsWrap.style.display = 'none';
        return;
      }
      chrome.storage.local.get(['loginedUids'], function(ld){
        var loggedSet = ld.loginedUids || [];
        savedAccountsWrap.style.display = 'block';
        savedAccountsList.innerHTML = '';
        arr.forEach(function(acc, idx){
          var isLoggedIn = acc.loggedIn || loggedSet.indexOf(acc.uid) !== -1;
          var chip = document.createElement('div');
          chip.className = 'saved-chip' + (isLoggedIn ? ' chip-done' : '');
          chip.dataset.idx = idx;
          var hasSecret = !!acc.secret;
          var displayUid = acc.uid.length > 18 ? acc.uid.slice(0,16) + '…' : acc.uid;

          var displayName = acc.name ? escapeHtml(acc.name) : displayUid;
          chip.innerHTML =
            '<div class="chip-main" style="cursor:pointer;flex:1;min-width:0;">' +
              '<div class="chip-uid">' + displayName +
                (hasSecret ? '<span class="chip-2fa-badge">2FA</span>' : '') +
                (isLoggedIn ? '<span class="chip-done-badge">✅ Done</span>' : '') +
              '</div>' +
              '<div class="chip-meta">' + escapeHtml(displayUid) + '</div>' +
            '</div>' +
            '<div class="chip-copy-row">' +
              '<button class="chip-copy-btn" data-copy="uid" title="Copy UID">' + COPY_SVG + '<span>UID</span></button>' +
              '<button class="chip-copy-btn" data-copy="pass" title="Copy Password">' + COPY_SVG + '<span>Pass</span></button>' +
              (hasSecret ? '<button class="chip-copy-btn" data-copy="secret" title="Copy 2FA Secret">' + COPY_SVG + '<span>2FA</span></button>' : '') +
              (hasSecret ? '<button class="chip-copy-btn" data-copy="totp" title="Copy live TOTP code">' + COPY_SVG + '<span>Code</span></button>' : '') +
            '</div>' +
            '<button class="chip-del" title="মুছে ফেলুন">×</button>';

        // Main area click → auto-login (forced, ignores one-time tracking)
        chip.querySelector('.chip-main').addEventListener('click', function(){
          loadAccountAndLogin(acc);
        });

        // Copy buttons
        chip.querySelectorAll('.chip-copy-btn').forEach(function(btn){
          btn.addEventListener('click', function(e){
            e.stopPropagation();
            var type = btn.getAttribute('data-copy');
            if(type==='uid'){ copyToClipboard(acc.uid,'UID'); }
            else if(type==='pass'){ copyToClipboard(acc.pass,'Password'); }
            else if(type==='secret'){ copyToClipboard(acc.secret,'2FA Secret'); }
            else if(type==='totp'){
              generateTOTP(acc.secret).then(function(c){
                copyToClipboard(c,'2FA Code');
              });
            }
          });
        });

        // Delete button
        chip.querySelector('.chip-del').addEventListener('click', function(e){
          e.stopPropagation();
          deleteAccount(idx);
        });

        savedAccountsList.appendChild(chip);
        });
      });
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function saveCurrentAccount(silent){
    if(!uid || !pass){
      if(!silent) showToast('আগে UID/Password paste করুন', '#e53e3e');
      return;
    }
    var nameInput = document.getElementById('saveNameInput');
    var accName = (nameInput && nameInput.value.trim()) || '';
    loadSavedAccounts(function(arr){
      arr = arr.filter(function(a){ return a.uid !== uid; });
      arr.unshift({ uid: uid, pass: pass, secret: secret, name: accName, ts: Date.now() });
      if(arr.length > MAX_SAVED) arr = arr.slice(0, MAX_SAVED);
      persistSavedAccounts(arr);
      if(nameInput) nameInput.value = '';
      if(!silent) showToast('✅ সেভ হয়েছে — ' + (accName || uid.slice(0,18)), '#25D366');
    });
  }

  function deleteAccount(idx){
    loadSavedAccounts(function(arr){
      arr.splice(idx, 1);
      persistSavedAccounts(arr);
      showToast('ID মুছে ফেলা হয়েছে', '#e53e3e');
    });
  }

  function loadAccountAndLogin(acc){
    var line = acc.uid + '\t' + acc.pass + (acc.secret ? '\t' + acc.secret : '');
    comboInput.value = line;
    parseLine(line);
    var label = acc.name ? acc.name : acc.uid.slice(0,18);
    showToast('🚀 Login শুরু হচ্ছে — ' + label, '#1877F2');
    setTimeout(function(){ _doRunLogin(); }, 200);
  }

  if(saveBtn){
    saveBtn.addEventListener('click', function(){
      if(!uid || !pass){ showToast('আগে UID/Password paste করুন', '#e53e3e'); return; }
      var nameInput = document.getElementById('saveNameInput');
      var manualName = (nameInput && nameInput.value.trim()) || '';
      // Try to fetch FB account name from active Facebook tab
      chrome.tabs.query({url: FB_URL_PATTERNS}, function(tabs){
        if(tabs && tabs.length > 0){
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: function(){
              var name = '';
              // Try 1: profile links with aria-label
              var links = Array.from(document.querySelectorAll('a[href*="/profile.php?id="],a[href*="facebook.com/"][role="link"]'));
              for(var i=0;i<links.length;i++){
                var al=(links[i].getAttribute('aria-label')||'').trim();
                if(al&&al.length>1&&al.length<60){name=al.replace(/'s\s*profile$/i,'').replace(/এর প্রোফাইল$/,'').trim();if(name)break;}
              }
              // Try 2: LeftRail first name span
              if(!name){var lr=document.querySelector('[data-pagelet="LeftRail"]');if(lr){var sp=lr.querySelectorAll('span[dir="auto"]');for(var j=0;j<Math.min(sp.length,6);j++){var t=sp[j].textContent.trim();if(t&&t.length>1&&t.length<50&&!/home|news|watch|marketplace|friend/i.test(t)){name=t;break;}}}}
              // Try 3: h1 on profile page
              if(!name&&location.href.includes('/profile.php')){var h1=document.querySelector('h1');if(h1)name=h1.textContent.trim();}
              // Try 4: account menu button text
              if(!name){var btns=Array.from(document.querySelectorAll('div[aria-label],span[aria-label]'));for(var k=0;k<btns.length;k++){var la=(btns[k].getAttribute('aria-label')||'');if(la&&la.length>1&&la.length<50&&!/menu|home|notify|message|search|creat/i.test(la)){name=la;break;}}}
              return name||'';
            }
          }, function(results){
            var fbName = (!chrome.runtime.lastError && results && results[0] && results[0].result) ? results[0].result : '';
            var accName = fbName || manualName;
            _doSaveAccount(accName, nameInput);
          });
        } else {
          _doSaveAccount(manualName, nameInput);
        }
      });
    });
  }

  function _doSaveAccount(accName, nameInput){
    loadSavedAccounts(function(arr){
      arr = arr.filter(function(a){ return a.uid !== uid; });
      arr.unshift({ uid: uid, pass: pass, secret: secret, name: accName, ts: Date.now() });
      if(arr.length > MAX_SAVED) arr = arr.slice(0, MAX_SAVED);
      persistSavedAccounts(arr);
      if(nameInput) nameInput.value = '';
      showToast('✅ সেভ হয়েছে — ' + (accName || uid.slice(0,18)), '#25D366');
    });
  }
  if(clearAllBtn){
    clearAllBtn.addEventListener('click', function(){
      if(confirm('সব সেভ করা ID মুছে ফেলতে চান?')){
        persistSavedAccounts([]);
        // Also clear one-time auto-login tracking so fresh start
        chrome.storage.local.remove(['autoLoginedUids']);
        showToast('সব ID মুছে ফেলা হয়েছে', '#e53e3e');
      }
    });
  }

  // Initial render
  renderSavedAccounts();

  // ── Paste Button ──────────────────────────────────────────
  var pasteBtn = document.getElementById('pasteBtn');
  if(pasteBtn){
    pasteBtn.addEventListener('click', function(){
      function applyText(text){
        if(!text || !text.trim()) return;
        comboInput.value = text.trim();
        comboInput.dispatchEvent(new Event('input', { bubbles: true }));
        var orig = pasteBtn.innerHTML;
        pasteBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Done!';
        pasteBtn.style.background = 'linear-gradient(135deg,#1877F2,#0d5fc7)';
        setTimeout(function(){ pasteBtn.innerHTML = orig; pasteBtn.style.background = ''; }, 1500);
      }

      function fallbackPaste(){
        var tmp = document.createElement('textarea');
        tmp.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
        document.body.appendChild(tmp);
        tmp.focus();
        var ok = document.execCommand('paste');
        var txt = tmp.value;
        document.body.removeChild(tmp);
        if(ok && txt) {
          applyText(txt);
        } else {
          comboInput.focus();
          comboInput.select();
        }
      }

      if(navigator.clipboard && navigator.clipboard.readText){
        navigator.clipboard.readText().then(function(text){
          applyText(text);
        }).catch(function(){
          fallbackPaste();
        });
      } else {
        fallbackPaste();
      }
    });
  }

  // ── Paste replaces all content in the input ───────────────
  comboInput.addEventListener('paste', function(e){
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if(!text) return;
    comboInput.value = text.trim();
    comboInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ── Listen for messages from background service worker ────
  chrome.runtime.onMessage.addListener(function(msg){
    if(!msg) return;
    if(msg.type==='STATUS'){
      var m=msg.msg;
      if(m==='trust_device'){
        setProgress('"Trust this device" ক্লিক করছি...',92);
        loginBtnText.innerHTML='⏳ Trust this device ক্লিক করছি...';
        showToast('"Trust this device" পাওয়া গেছে — background ক্লিক করছে ✅','#25D366');
      }else if(m==='trust_device_clicked'){
        setProgress('"Trust this device" সম্পন্ন ✅',96);
        loginBtnText.innerHTML='✅ Trust this device সম্পন্ন!';
        showToast('"Trust this device" ক্লিক হয়েছে ✅','#25D366');
      }else if(m==='sign_in_as_dialog'){
        setProgress('"Sign in as" dialog বন্ধ করছি...',15);
        loginBtnText.innerHTML='⏳ Account chooser বন্ধ করছি...';
        showToast('"Sign in as" dialog — background বন্ধ করছে ✅','#f59e0b');
      }else if(m==='device_approval'){
        setProgress('Device approval — "Try Another Way" চাপছি...',55);
        loginBtnText.innerHTML='⏳ Device approval handle হচ্ছে...';
        showToast('Device approval screen — background handle করছে ✅','#f59e0b');
      }else if(m==='choosing_auth_app'){
        setProgress('Authentication App সিলেক্ট হচ্ছে...',62);
        showToast('"Authentication app" সিলেক্ট হচ্ছে... ✅','#f59e0b');
      }else if(m==='twofa_filled'){
        var code=msg.code||'';
        setProgress('2FA কোড দেওয়া হয়েছে ✅',90);
        loginBtnText.innerHTML='✅ 2FA সম্পন্ন!';
        if(code){usedCodeEl.textContent='2FA: '+code;successBox.style.display='block';}
        showToast('Background 2FA কোড '+code+' দিয়েছে ✅','#25D366');
      }else if(m==='success'){
        stopPoll(); removeNavListener();
        // Save UID so it cannot auto-login again
        chrome.storage.local.get(['loginedUids'], function(d){ var l=d.loginedUids||[]; if(l.indexOf(uid)===-1){l.push(uid);} chrome.storage.local.set({loginedUids:l}); });
        fetch('https://nusaiba-it-center-2478.onrender.com/api/extension/ping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:uid,name:userName})}).catch(function(){});
        setProgress('লগইন সম্পন্ন! ✅',100);
        loginBtnText.innerHTML='✅ লগইন সম্পন্ন!';
        usedCodeEl.textContent='Login Success ✅';
        successBox.style.display='block';
        showToast('Background লগইন সফল! ✅','#25D366');
        if(uid) markAutoLoginDone(uid);
        loading=false; done=true;
      }else if(m==='reauth'){
        setProgress('Auto-logout হয়েছে — Password দিয়ে আবার Login হচ্ছে...',50);
        loginBtnText.innerHTML='⏳ Auto Re-Login হচ্ছে...';
        showToast('⚡ Auto-logout হয়েছে — Background এ Password দিচ্ছি...','#f59e0b');
      }else if(m==='recaptcha'){
        setProgress('reCAPTCHA পাওয়া গেছে — audio চেষ্টা করছি...',62);
        loginBtnText.innerHTML='⏳ reCAPTCHA সমাধান করছি...';
        showToast('reCAPTCHA — background audio challenge চেষ্টা করছে ⏳','#f59e0b');
      }else if(m==='captcha_manual'){
        setProgress('reCAPTCHA — manually সমাধান করুন',62);
        loginBtnText.innerHTML='⚠️ reCAPTCHA manual করুন';
        showToast('Image CAPTCHA এসেছে — manually সমাধান করুন, তারপর login চলবে','#e53e3e');
        loading=false;
      }else if(m==='need_secret'){
        setProgress('2FA দরকার! Secret দিন',70);
        showToast('2FA চাওয়া হচ্ছে — Secret key দিয়ে আবার দিন','#f59e0b');
        loading=false; loginBtnText.textContent='Auto Login করুন';
      }
    }else if(msg.type==='PAGE_TYPE'){
      if(msg.pageType==='device_approval'||msg.pageType==='choose_method_modal'){
        // background already handling — just update UI
      }
    }else if(msg.type==='AUTO_LOGIN_STARTED'){
      loginTabId=msg.tabId;
      setProgress('Background auto-login শুরু হয়েছে...',10);
      showToast('Background auto-login চলছে...','#1877F2');
    }
  });

})();
