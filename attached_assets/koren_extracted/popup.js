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

  // ── Helpers ───────────────────────────────────────────────
  function showToast(msg,color){
    color=color||'#1877F2';
    toastEl.textContent=msg;
    toastEl.style.background=color+'e8';
    toastEl.style.display='block';
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){toastEl.style.display='none';},4000);
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
      // Save credentials so background can auto-login even when popup is closed
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

        // ① PRIORITY: Visible code input = DEFINITELY twofa (check before everything)
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

        // ② URL contains 2FA-specific patterns
        var tfaUrlKeywords=['two_step','two-factor','two_factor',
          'login/two','mfa','otp','verify_id'];
        for(var u=0;u<tfaUrlKeywords.length;u++){
          if(url.includes(tfaUrlKeywords[u])) return 'twofa';
        }

        // ③ Device notification approval screen (NO "try another way" — that button also appears on auth app page)
        if(
          bodyText.includes('waiting for approval')||
          bodyText.includes('check your notifications on another device')||
          bodyText.includes('we sent a notification to your')||
          url.includes('device_based_two_factor')||
          url.includes('approvals_required')
        ){
          // Check if modal is already open
          var modal=document.querySelector('[role="dialog"]')||document.querySelector('[aria-modal="true"]');
          if(modal){
            var mt=(modal.innerText||'').toLowerCase();
            if(mt.includes('authentication app')||mt.includes('choose a way')) return 'choose_method_modal';
          }
          return 'device_approval';
        }

        // ④ Body text contains 2FA keywords
        var tfaTextKw=['go to your authentication app','6-digit','two-factor','two factor',
          'verification code','enter the code','enter code','approvals code',
          'confirmation code','security code','কোড লিখুন','কোড দিন'];
        for(var t=0;t<tfaTextKw.length;t++){
          if(bodyText.includes(tfaTextKw[t])) return 'twofa';
        }

        // ④ Checkpoint URL — any visible non-email/pass input → likely 2FA
        if(url.includes('checkpoint')||url.includes('approvals')){
          var ins=document.querySelectorAll('input[type="tel"],input[type="number"],input[type="text"]');
          for(var j=0;j<ins.length;j++){
            if(ins[j].offsetParent!==null&&!ins[j].name.match(/email|pass|user/i)) return 'twofa';
          }
          return 'checkpoint';
        }

        // ⑤ reCAPTCHA iframe
        if(document.querySelector('iframe[src*="recaptcha"]')) return 'recaptcha';

        // ⑥ Other checkpoint/captcha URLs
        if(url.includes('captcha')||url.includes('integrity')) return 'checkpoint';

        // ⑦ Still on login page
        if(url.includes('/login')||url.match(/facebook\.com\/login/)){
          // Maybe a 2FA variant under /login path
          var lIns=document.querySelectorAll('input[type="text"],input[type="tel"],input[type="number"]');
          for(var li=0;li<lIns.length;li++){
            if(lIns[li].offsetParent!==null&&!lIns[li].name.match(/email|pass|user/i)) return 'twofa';
          }
          return 'unknown';
        }

        // ⑧ Success — STRICT: require positive home page signals
        if(url.match(/facebook\.com/)){
          // If any 2FA content still visible, not success
          var tfaStillVisible=document.querySelector('input[placeholder="Code"]')||
            (bodyText.includes('authentication app'))||
            (bodyText.includes('6-digit'));
          if(tfaStillVisible) return 'twofa';

          // Require actual logged-in home page elements
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
  // Facebook's React form requires real keyboard events per character
  function inject2FA(tabId,code,cb){
    chrome.scripting.executeScript({
      target:{tabId:tabId},
      func:function(c){
        // Selector list for 2FA input
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

        // Use native value setter so React knows the value changed
        var nativeSetter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
        function setNative(el,val){
          if(nativeSetter&&nativeSetter.set) nativeSetter.set.call(el,val);
          else el.value=val;
        }

        inp.focus();
        // Clear field first
        setNative(inp,'');
        inp.dispatchEvent(new Event('input',{bubbles:true}));

        // Type each digit one by one with full keyboard event sequence
        var delay=0;
        for(var k=0;k<c.length;k++){
          (function(ch,idx){
            setTimeout(function(){
              setNative(inp,c.slice(0,idx+1));
              inp.dispatchEvent(new KeyboardEvent('keydown',{key:ch,code:'Digit'+ch,bubbles:true,cancelable:true}));
              inp.dispatchEvent(new KeyboardEvent('keypress',{key:ch,code:'Digit'+ch,bubbles:true,cancelable:true}));
              inp.dispatchEvent(new Event('input',{bubbles:true}));
              inp.dispatchEvent(new KeyboardEvent('keyup',{key:ch,code:'Digit'+ch,bubbles:true,cancelable:true}));
              // After last digit, submit
              if(idx===c.length-1){
                setTimeout(function(){
                  inp.dispatchEvent(new Event('change',{bubbles:true}));
                  // Try specific 2FA confirm buttons first
                  var btn=document.querySelector('[data-testid="two_factor_auth_confirm_button"]');
                  // Then find any visible button with "Continue" / "Submit" / "Confirm" text
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
            delay+=80; // 80ms between each digit
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

    // Step 1: Click the checkbox in the anchor iframe
    chrome.scripting.executeScript({
      target:{tabId:tabId,allFrames:true},
      func:function(){
        var cb=document.querySelector('#recaptcha-anchor,.recaptcha-checkbox-border,.recaptcha-checkbox');
        if(cb&&cb.offsetParent!==null){cb.click();return 'clicked';}
        return null;
      }
    },function(res1){
      // Step 2: Wait, then click audio challenge button in bframe
      setTimeout(function(){
        chrome.scripting.executeScript({
          target:{tabId:tabId,allFrames:true},
          func:function(){
            var audioBtn=document.querySelector('#recaptcha-audio-button,button[aria-labelledby*="audio-instructions"],button.rc-button-audio');
            if(audioBtn&&audioBtn.offsetParent!==null){audioBtn.click();return 'audio_clicked';}
            return null;
          }
        },function(res2){
          // Step 3: Get audio source URL
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
              // Step 4: Download audio and transcribe via Google Speech API v2
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
                  // Google Speech API v2 returns two lines; parse second JSON line
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
                  // Step 5: Enter answer in the reCAPTCHA input and submit
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

  // ── Handle a completed page navigation ────────────────────
  function handlePageLoad(tabId){
    detectPageType(tabId,function(type){
      if(type==='device_approval'){
        // Facebook waiting for device notification — click "Try Another Way"
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
        // Modal open — select Authentication app → Continue
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
              var lbl='';
              var p=radios[r].closest('label')||radios[r].parentElement;
              if(p) lbl=(p.textContent||'').toLowerCase();
              if(lbl.includes('authentication app')||lbl.includes('authenticator')){authRadio=radios[r];break;}
            }
            if(!authRadio){
              var rows=Array.from(modal.querySelectorAll('[role="radio"],[role="option"],label,li'));
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
        setProgress('লগইন সম্পন্ন! ✅',100);
        loginBtnText.innerHTML='✅ লগইন সম্পন্ন!';
        usedCodeEl.textContent='Login Success ✅';
        successBox.style.display='block';
        showToast('লগইন সফল! ✅','#25D366');
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

  // ── Polling (fallback every 2s for pages that don't fire nav) ─
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
        if(type==='device_approval'){handlePageLoad(tabId);}
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
      var res=results&&results[0]&&results[0].result;
      if(res==='not_found'){
        showToast('Login form পাওয়া যায়নি!','#e53e3e');
        loading=false; loginBtnText.textContent='Auto Login করুন'; return;
      }
      setProgress('Email & Password দেওয়া হয়েছে ✅',40);
      loginBtnText.innerHTML='⏳ লগইন হচ্ছে...';
      showToast('Email & Password দেওয়া হয়েছে ✅','#1877F2');
      // Save session so background continues even if popup closes
      chrome.storage.session.set({
        loginSession: { active: true, uid: uid, pass: pass, secret: secret, tabId: tabId, twoFaDone: false, deviceHandled: false }
      });
      chrome.runtime.sendMessage({ type: 'START_POLL' }).catch(function(){});
      // Both nav listener + polling for reliability
      attachNavListener(tabId);
      setTimeout(function(){startPolling(tabId);},3000);
    });
  }

  // ── Main login flow ───────────────────────────────────────
  function runLogin(){
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

    chrome.tabs.query({url:['https://www.facebook.com/*','https://m.facebook.com/*']},function(fbTabs){
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
          // Already on login page — fill directly
          setTimeout(function(){injectLoginForm(loginTabId);},400);
        }else{
          // Homepage or any other FB page — always navigate to /login for reliability
          setProgress('Login page এ যাচ্ছি...',15);
          loginBtnText.innerHTML='⏳ Login page এ যাচ্ছি...';
          chrome.tabs.update(loginTabId,{url:'https://www.facebook.com/login'},function(){
            chrome.tabs.onUpdated.addListener(function navL(id,info){
              if(id===loginTabId&&info.status==='complete'){
                chrome.tabs.onUpdated.removeListener(navL);
                setTimeout(function(){injectLoginForm(loginTabId);},800);
              }
            });
          });
        }
      }else{
        chrome.tabs.query({active:true,currentWindow:true},function(active){
          if(!active||!active.length){
            loading=false;showToast('Tab পাওয়া যায়নি','#e53e3e');return;
          }
          loginTabId=active[0].id;
          chrome.tabs.update(loginTabId,{url:'https://www.facebook.com/login'},function(){
            setProgress('Facebook login page খোলা হচ্ছে...',15);
            chrome.tabs.onUpdated.addListener(function navL(id,info){
              if(id===loginTabId&&info.status==='complete'){
                chrome.tabs.onUpdated.removeListener(navL);
                setTimeout(function(){injectLoginForm(loginTabId);},600);
              }
            });
          });
        });
      }
    });
  }

  // ── Restore state when popup is reopened ─────────────────
  (function restoreState(){
    // Restore saved credentials into the input field
    chrome.storage.local.get(['savedCreds'], function(d){
      if(!d.savedCreds) return;
      var creds = d.savedCreds;
      // Rebuild combo line: uid  pass  secret
      var line = creds.uid + '\t' + creds.pass + (creds.secret ? '\t' + creds.secret : '');
      comboInput.value = line;
      parseLine(line);

      // Now check if there's an active login session
      chrome.storage.session.get(['loginSession'], function(s){
        var session = s.loginSession;
        if(!session || !session.active) return;
        loginTabId = session.tabId;
        loading = true;

        // Show resumed state in UI
        setProgress('Background এ চলছে... (resumed)', 30);
        loginBtnText.innerHTML = '⏳ Background এ login চলছে...';
        showToast('Background এ login চলছে — popup খোলা থাকলে update দেখবেন', '#1877F2');

        // Light polling so popup updates if background finishes
        stopPoll(); pollAttempts = 0;
        pollTimer = setInterval(function(){
          pollAttempts++;
          if(pollAttempts > 120){ stopPoll(); return; }
          chrome.storage.session.get(['loginSession'], function(sd){
            if(!sd.loginSession || !sd.loginSession.active){
              stopPoll();
              // Session ended — check if success
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

  // ── Event listeners ───────────────────────────────────────
  comboInput.addEventListener('input',function(){
    done=false;loading=false;twoFaInjected=false;captchaAttempts=0;
    successBox.style.display='none';
    loginBtnText.textContent='Auto Login করুন';
    progressWrap.style.display='none';
    stopPoll();removeNavListener();clearTimeout(autoTimer);
    if(parseLine(comboInput.value.trim())){
      autoTimer=setTimeout(function(){runLogin();},350);
    }
  });

  loginBtn.addEventListener('click',runLogin);
  setInterval(updateCountdown,1000);

  // ── Paste replaces all content in the input ───────────────
  comboInput.addEventListener('paste', function(e){
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if(!text) return;
    // Replace entire content with pasted text
    comboInput.value = text.trim();
    comboInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ── Listen for messages from background service worker ────
  chrome.runtime.onMessage.addListener(function(msg){
    if(!msg) return;
    if(msg.type==='STATUS'){
      var m=msg.msg;
      if(m==='device_approval'){
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
        setProgress('লগইন সম্পন্ন! ✅',100);
        loginBtnText.innerHTML='✅ লগইন সম্পন্ন!';
        usedCodeEl.textContent='Login Success ✅';
        successBox.style.display='block';
        showToast('Background লগইন সফল! ✅','#25D366');
        loading=false; done=true;
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
      // background started auto-login from saved creds
      loginTabId=msg.tabId;
      setProgress('Background auto-login শুরু হয়েছে...',10);
      showToast('Background auto-login চলছে...','#1877F2');
    }
  });

})();
