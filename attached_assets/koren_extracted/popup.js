
  // BD Time Clock (UTC+6)
  (function(){
    function tick(){
      var el=document.getElementById('bdClock');if(!el)return;
      var now=new Date(),utc=now.getTime()+now.getTimezoneOffset()*60000;
      var bd=new Date(utc+6*3600000);
      var h=bd.getHours(),m=bd.getMinutes(),s=bd.getSeconds();
      var ampm=h>=12?'PM':'AM';h=h%12||12;
      el.textContent=('0'+h).slice(-2)+':'+('0'+m).slice(-2)+':'+('0'+s).slice(-2)+' '+ampm;
    }
    tick();setInterval(tick,1000);
  })();

  // === TOTP ===
  const B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  function base32Decode(input){
    const clean=input.toUpperCase().replace(/\s/g,"").replace(/=+$/,"");
    let bits=0,value=0,idx=0;
    const out=new Uint8Array(Math.floor((clean.length*5)/8));
    for(const ch of clean){const ci=B32.indexOf(ch);if(ci===-1)continue;value=(value<<5)|ci;bits+=5;if(bits>=8){out[idx++]=(value>>>(bits-8))&255;bits-=8;}}
    return out.slice(0,idx);
  }
  async function generateTOTP(secret){
    try{
      const keyBytes=base32Decode(secret);
      if(keyBytes.length===0)return"------";
      const counter=Math.floor(Date.now()/1000/30);
      const buf=new ArrayBuffer(8);new DataView(buf).setUint32(4,counter,false);
      const key=await crypto.subtle.importKey("raw",keyBytes,{name:"HMAC",hash:"SHA-1"},false,["sign"]);
      const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,buf));
      const o=sig[sig.length-1]&0x0f;
      const code=(((sig[o]&0x7f)<<24)|((sig[o+1]&0xff)<<16)|((sig[o+2]&0xff)<<8)|(sig[o+3]&0xff))%1000000;
      return String(code).padStart(6,"0");
    }catch{return"------";}
  }
  function secsLeft(){return 30-(Math.floor(Date.now()/1000)%30);}

  let uid="",pass="",secret="",totpCode="------";
  let loading=false,done=false,autoTimer=null,loginTabId=null,pollTimer=null;

  const comboInput=document.getElementById("comboInput");
  const parsedRow=document.getElementById("parsedRow");
  const pUid=document.getElementById("pUid");
  const pPass=document.getElementById("pPass");
  const pSecret=document.getElementById("pSecret");
  const totpBox=document.getElementById("totpBox");
  const totpCodeEl=document.getElementById("totpCode");
  const countdownArc=document.getElementById("countdownArc");
  const countdownNum=document.getElementById("countdownNum");
  const progressWrap=document.getElementById("progressWrap");
  const progressFill=document.getElementById("progressFill");
  const stageLabel=document.getElementById("stageLabel");
  const stagePct=document.getElementById("stagePct");
  const loginBtn=document.getElementById("loginBtn");
  const loginBtnText=document.getElementById("loginBtnText");
  const successBox=document.getElementById("successBox");
  const usedCodeEl=document.getElementById("usedCode");
  const toastEl=document.getElementById("toast");

  let toastTimer=null;
  function showToast(msg,color="#1877F2"){
    toastEl.textContent=msg;toastEl.style.background=color+"e8";toastEl.style.display="block";
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toastEl.style.display="none";},4000);
  }
  function setProgress(label,pct){
    progressWrap.style.display="flex";stageLabel.textContent=label;
    stagePct.textContent=pct+"%";progressFill.style.width=pct+"%";
  }
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  function stopPoll(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}

  // UID+Pass ২টা দিলেও চলবে, 2FA optional
  function parseLine(line){
    const parts=line.split("\t");
    if(parts.length>=2 && parts[0].trim() && parts[1].trim()){
      uid=parts[0].replace(/\s/g,"");
      pass=parts[1].replace(/\s/g,"");
      secret=parts.length>=3 ? parts.slice(2).join(" ").replace(/\s/g,"") : "";
      parsedRow.style.display="grid";
      pUid.textContent=uid||"—";
      pPass.textContent=pass?"••••••":"—";
      pSecret.textContent=secret?secret.slice(0,6)+"…":"নেই";
      if(secret){ startTOTP(); } else { totpBox.style.display="none"; }
      loginBtn.disabled=false;
      return true;
    }
    parsedRow.style.display="none";totpBox.style.display="none";loginBtn.disabled=true;return false;
  }
  async function refreshTOTP(){if(!secret)return;totpCode=await generateTOTP(secret);totpCodeEl.textContent=totpCode;}
  function updateCountdown(){const s=secsLeft();countdownNum.textContent=s;countdownArc.setAttribute("stroke-dasharray",`${(s/30)*94.2} 94.2`);if(s===30)refreshTOTP();}
  function startTOTP(){if(!secret)return;totpBox.style.display="flex";refreshTOTP();updateCountdown();}

  // === CAPTCHA Auto-Click (checkbox type) ===
  const CAPTCHA_CLICKER = function(){
    var clicked = false;

    // reCAPTCHA checkbox iframe এ click করার চেষ্টা
    try {
      var frames = document.querySelectorAll('iframe[src*="recaptcha"]');
      frames.forEach(function(frame){
        try{
          var cb = frame.contentDocument && frame.contentDocument.querySelector('.recaptcha-checkbox');
          if(cb && !clicked){ cb.click(); clicked=true; }
        }catch(e){}
      });
    } catch(e){}

    // সরাসরি checkbox খোঁজা
    if(!clicked){
      var checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(function(cb){
        if(!clicked && cb.offsetParent !== null){
          try{ cb.click(); clicked=true; }catch(e){}
        }
      });
    }

    // "I'm not a robot" বা similar div/span ক্লিক করা
    if(!clicked){
      var allEls = document.querySelectorAll('div,span,label');
      allEls.forEach(function(el){
        if(!clicked){
          var txt = (el.textContent||'').trim().toLowerCase();
          if((txt === "i'm not a robot" || txt === "not a robot" || txt === "আমি রোবট নই") && el.offsetParent!==null){
            try{ el.click(); clicked=true; }catch(e){}
          }
        }
      });
    }

    // .rc-anchor-center-item বা .recaptcha-checkbox-border
    if(!clicked){
      var rcEl = document.querySelector('.rc-anchor-center-item') ||
                 document.querySelector('.recaptcha-checkbox-border') ||
                 document.querySelector('[id*="recaptcha-anchor"]');
      if(rcEl){ try{ rcEl.click(); clicked=true; }catch(e){} }
    }

    return clicked ? 'clicked' : 'not_found';
  };

  // === PAGE DETECTOR: runs inside the Facebook tab ===
  const PAGE_DETECTOR = function(){
    var url = window.location.href;

    if(url.match(/facebook\.com\/?$/) || url.includes('/home')){
      if(!document.querySelector('input[name="email"]') && !document.querySelector('input[name="pass"]')){
        return 'success';
      }
    }

    if(document.querySelector('input[name="email"]') && document.querySelector('input[name="pass"]')){
      return 'login';
    }

    var hasCaptcha = !!document.querySelector('iframe[src*="recaptcha"]') ||
                     !!document.querySelector('.g-recaptcha') ||
                     !!document.querySelector('[data-testid="captcha"]') ||
                     (document.body.innerHTML||'').includes('not a robot') ||
                     (document.body.innerHTML||'').includes('reCAPTCHA');

    var codeInput = document.querySelector('input[aria-label="Code"]') ||
                    document.querySelector('input[placeholder="Code"]') ||
                    document.querySelector('input[name="approvals_code"]') ||
                    document.querySelector('input[autocomplete="one-time-code"]');

    if(codeInput) return '2fa';
    if(hasCaptcha) return 'captcha';

    // 2FA fallback
    var all2fa = Array.from(document.querySelectorAll('input[type="text"],input[type="number"]'));
    var found2fa = all2fa.find(function(el){
      return el.offsetParent!==null &&
             !el.name.includes('email') &&
             !el.name.includes('pass') &&
             (document.body.textContent||'').match(/authentication|2FA|two.factor|6.digit|code/i);
    });
    if(found2fa) return '2fa';

    return 'unknown';
  };

  // === Inject 2FA code ===
  function inject2FACode(tabId, otp, cb){
    chrome.scripting.executeScript({
      target:{tabId},
      func:function(otp){
        function setVal(el,val){
          try{var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(d&&d.set)d.set.call(el,val);}catch(e){el.value=val;}
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
        var codeEl = document.querySelector('input[aria-label="Code"]') ||
                     document.querySelector('input[placeholder="Code"]') ||
                     document.querySelector('input[name="approvals_code"]') ||
                     document.querySelector('input[autocomplete="one-time-code"]') ||
                     (function(){
                       var all=Array.from(document.querySelectorAll('input[type="text"],input[type="number"]'));
                       return all.find(function(el){
                         return el.offsetParent!==null&&!el.name.includes('email')&&!el.name.includes('pass');
                       });
                     })();
        if(!codeEl) return 'no_input';
        codeEl.focus();
        setVal(codeEl, otp);
        setTimeout(function(){
          var btn = document.querySelector('button[type="submit"]') ||
                    (function(){
                      var btns=Array.from(document.querySelectorAll('button,div[role="button"]'));
                      return btns.find(function(b){
                        var t=(b.textContent||'').trim().toLowerCase();
                        return t==='continue'||t==='submit'||t==='confirm'||t==='next';
                      });
                    })();
          if(btn) btn.click();
        }, 500);
        return 'ok';
      },
      args:[otp]
    }, function(r){ if(cb) cb(r&&r[0]&&r[0].result); });
  }

  // === CAPTCHA auto-click করা ===
  function tryCaptchaAutoClick(tabId, onDone){
    chrome.scripting.executeScript({
      target:{tabId, allFrames:true},
      func: CAPTCHA_CLICKER
    }, function(results){
      var clicked = results && results.some(function(r){ return r && r.result === 'clicked'; });
      if(onDone) onDone(clicked);
    });
  }

  // === Start polling after login click ===
  function startPolling(tabId){
    var pollCount=0;
    var maxPolls=80;
    var captchaNotified=false;
    var captchaClickTry=0;

    pollTimer=setInterval(function(){
      pollCount++;
      if(pollCount>maxPolls||done){stopPoll();return;}

      chrome.scripting.executeScript({
        target:{tabId},
        func: PAGE_DETECTOR
      }, function(results){
        if(chrome.runtime.lastError||!results||!results[0])return;
        var pageType=results[0].result;

        if(pageType==='captcha'){
          // Auto-click CAPTCHA (প্রতি ৩ poll এ একবার try করব)
          captchaClickTry++;
          if(captchaClickTry % 3 === 1){
            tryCaptchaAutoClick(tabId, function(clicked){
              if(clicked){
                setProgress("CAPTCHA auto-click করা হয়েছে! অপেক্ষা করুন...",65);
                loginBtnText.innerHTML='⏳ CAPTCHA solve হচ্ছে...';
                showToast("CAPTCHA auto-click করা হয়েছে! ✅","#f59e0b");
              } else {
                if(!captchaNotified){
                  captchaNotified=true;
                  setProgress("CAPTCHA আছে — auto-click চেষ্টা চলছে...",60);
                  loginBtnText.innerHTML='⏳ CAPTCHA solve করার চেষ্টা...';
                  showToast("CAPTCHA দেখা যাচ্ছে, auto-click চেষ্টা চলছে...","#f59e0b");
                }
              }
            });
          }
        } else if(pageType==='2fa'){
          captchaNotified=false;

          // 2FA key না থাকলে জানাবে
          if(!secret){
            stopPoll();
            setProgress("2FA চাইছে কিন্তু key নেই!",75);
            loginBtnText.innerHTML='⚠️ 2FA key দেওয়া হয়নি';
            showToast("এই ID তে 2FA আছে কিন্তু key দেননি!","#e53e3e");
            loading=false;
            loginBtn.disabled=false;
            return;
          }

          setProgress("2FA code দেওয়া হচ্ছে...",80);
          loginBtnText.innerHTML='<div class="spinner"></div> 2FA: '+totpCode;
          showToast("2FA page! Code: "+totpCode,"#25D366");
          stopPoll();
          generateTOTP(secret).then(function(newCode){
            totpCode=newCode;totpCodeEl.textContent=newCode;
            inject2FACode(tabId, newCode, function(res){
              if(res==='ok'){
                setProgress("2FA দেওয়া হয়েছে! ✅",95);
                loginBtnText.innerHTML='✅ 2FA সম্পন্ন!';
                usedCodeEl.textContent="2FA: "+newCode;
                successBox.style.display="block";
                showToast("2FA কোড "+newCode+" দেওয়া হয়েছে! ✅","#25D366");
                loading=false;done=true;
              } else {
                startPolling(tabId);
              }
            });
          });
        } else if(pageType==='success'){
          stopPoll();
          setProgress("লগইন সম্পন্ন! ✅",100);
          loginBtnText.innerHTML='✅ লগইন সম্পন্ন!';
          usedCodeEl.textContent="Login Success ✅";
          successBox.style.display="block";
          showToast("লগইন সফল! ✅","#25D366");
          loading=false;done=true;
        }
      });
    }, 1500);
  }

  // === Fill login form ===
  function injectLoginForm(tabId){
    chrome.scripting.executeScript({
      target:{tabId},
      func:function(email,pw){
        function setVal(el,val){
          try{var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(d&&d.set)d.set.call(el,val);}catch(e){el.value=val;}
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
        var emailEl=document.querySelector('input[name="email"]')||document.getElementById('email');
        var passEl=document.querySelector('input[name="pass"]')||document.getElementById('pass');
        if(!emailEl||!passEl)return 'not_found';
        emailEl.focus();setVal(emailEl,email);
        setTimeout(function(){passEl.focus();setVal(passEl,pw);
          setTimeout(function(){
            var btn=document.querySelector('[data-testid="royal_login_button"]')||
                    document.querySelector('button[name="login"]')||
                    document.querySelector('button[type="submit"]')||
                    document.querySelector('input[type="submit"]');
            if(btn)btn.click();
          },400);
        },150);
        return 'filled';
      },
      args:[uid,pass]
    }, function(results){
      var res=results&&results[0]&&results[0].result;
      if(res==='filled'){
        var msg = secret ? "Email ও Password দেওয়া হয়েছে ✅" : "Email ও Password দেওয়া হয়েছে (2FA নেই) ✅";
        setProgress("Login হচ্ছে... CAPTCHA থাকলে auto-click হবে",50);
        loginBtnText.innerHTML='<div class="spinner"></div> Login হচ্ছে...';
        showToast(msg,"#1877F2");
        startPolling(tabId);
      } else {
        showToast("Login form পাওয়া যায়নি! Facebook page আছে?","#e53e3e");
        loading=false;loginBtn.disabled=false;loginBtnText.textContent="Auto Login করুন";
      }
    });
  }

  // === Main ===
  async function runLogin(){
    if(loading||done)return;
    // শুধু UID আর Pass থাকলেই চলবে, secret optional
    if(!uid||!pass){showToast("আগে UID ও Password paste করুন","#e53e3e");return;}
    loading=true;loginBtn.disabled=true;successBox.style.display="none";
    stopPoll();

    if(secret){
      totpCode=await generateTOTP(secret);
      totpCodeEl.textContent=totpCode;
    }
    setProgress("Facebook tab খোঁজা হচ্ছে...",10);
    loginBtnText.innerHTML='<div class="spinner"></div> Tab খোঁজা হচ্ছে...';

    chrome.tabs.query({url:"https://www.facebook.com/*"},function(fbTabs){
      if(fbTabs&&fbTabs.length>0){
        loginTabId=fbTabs[0].id;
        chrome.tabs.update(loginTabId,{active:true});
        var url=fbTabs[0].url||'';
        showToast("খোলা Facebook tab পাওয়া গেছে!","#1877F2");

        if(url.includes('checkpoint')||url.includes('approvals')){
          setProgress("Checkpoint page... auto-click চেষ্টা করছি",55);
          loginBtnText.innerHTML='⏳ CAPTCHA solve করার চেষ্টা...';
          showToast("CAPTCHA দেখা যাচ্ছে, auto-click চেষ্টা করছি!","#f59e0b");
          startPolling(loginTabId);
        } else if(url.includes('/login')||url.match(/facebook\.com\/?$/)){
          setTimeout(function(){injectLoginForm(loginTabId);},400);
        } else {
          chrome.tabs.update(loginTabId,{url:"https://www.facebook.com/login"},function(){
            setProgress("Login page এ যাচ্ছি...",15);
            chrome.tabs.onUpdated.addListener(function navL(id,info){
              if(id===loginTabId&&info.status==='complete'){
                chrome.tabs.onUpdated.removeListener(navL);
                setTimeout(function(){injectLoginForm(loginTabId);},500);
              }
            });
          });
        }
      } else {
        chrome.tabs.query({active:true,currentWindow:true},function(active){
          if(!active||!active.length){loading=false;showToast("Tab পাওয়া যায়নি","#e53e3e");return;}
          loginTabId=active[0].id;
          chrome.tabs.update(loginTabId,{url:"https://www.facebook.com/login"},function(){
            setProgress("Facebook login page খোলা হচ্ছে...",15);
            chrome.tabs.onUpdated.addListener(function navL(id,info){
              if(id===loginTabId&&info.status==='complete'){
                chrome.tabs.onUpdated.removeListener(navL);
                setTimeout(function(){injectLoginForm(loginTabId);},500);
              }
            });
          });
        });
      }
    });
  }

  comboInput.addEventListener("input",()=>{
    done=false;loading=false;successBox.style.display="none";
    loginBtnText.textContent="Auto Login করুন";progressWrap.style.display="none";
    stopPoll();clearTimeout(autoTimer);
    if(parseLine(comboInput.value.trim())){autoTimer=setTimeout(()=>runLogin(),300);}
  });
  loginBtn.addEventListener("click",runLogin);
  setInterval(updateCountdown,1000);
