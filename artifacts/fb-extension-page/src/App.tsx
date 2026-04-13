import { useState, useEffect } from "react";

const WA_LINK = "https://wa.me/8801709281334?text=Assalamu%20Alaikum%2C%20Shourov%20FB%20AutoLogin%20extension%20ta%20diben%20please%20%F0%9F%99%8F";
const FB_LINK = "https://www.facebook.com/profile.php?id=61588161951831";
const PROFILE_PIC = "https://i.postimg.cc/tTbRxNQF/IMG-20260325-WA0011.jpg";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  {
    icon: "⚡",
    titleBn: "Auto Login",
    titleEn: "Auto Login",
    descBn: "UID ও Password দিলেই মুহূর্তে Facebook এ login হয়ে যাবে।",
    descEn: "Enter UID & Password — it logs into Facebook instantly.",
  },
  {
    icon: "🔐",
    titleBn: "2FA Support",
    titleEn: "2FA Support",
    descBn: "2FA থাকুক বা না থাকুক — দুই ক্ষেত্রেই কাজ করে।",
    descEn: "Works with or without 2FA — TOTP auto-generated.",
  },
  {
    icon: "🤖",
    titleBn: "CAPTCHA Auto-Click",
    titleEn: "CAPTCHA Auto-Click",
    descBn: "CAPTCHA আসলে auto-click করে — ম্যানুয়াল ঝামেলা নেই।",
    descEn: "Auto-clicks CAPTCHA when it appears — fully automatic.",
  },
];

const steps = [
  {
    num: "১",
    numEn: "1",
    titleBn: "Extension ডাউনলোড করুন",
    titleEn: "Download the Extension",
    descBn: '"Extension ডাউনলোড করুন" বাটনে ক্লিক করুন — ZIP file আপনার device এ চলে আসবে।',
    descEn: 'Click "Extension ডাউনলোড করুন" — the ZIP file will download to your device.',
  },
  {
    num: "২",
    numEn: "2",
    titleBn: "ZIP file Extract করুন",
    titleEn: "Extract the ZIP File",
    descBn: "ডাউনলোড হওয়া ZIP file যেকোনো একটি ফোল্ডারে extract করুন।",
    descEn: "Extract the downloaded ZIP file into any folder on your device.",
  },
  {
    num: "৩",
    numEn: "3",
    titleBn: "Chrome Extensions খুলুন",
    titleEn: "Open Chrome Extensions",
    descBn: "Chrome এ address bar এ লিখুন: chrome://extensions — তারপর Enter দিন।",
    descEn: "In Chrome address bar, type: chrome://extensions — then press Enter.",
  },
  {
    num: "৪",
    numEn: "4",
    titleBn: "Developer Mode চালু করুন",
    titleEn: "Enable Developer Mode",
    descBn: "উপরে ডানদিকে Developer mode toggle চালু করুন।",
    descEn: "Toggle on Developer Mode at the top right corner.",
  },
  {
    num: "৫",
    numEn: "5",
    titleBn: "Load Unpacked দিয়ে Add করুন",
    titleEn: "Load Unpacked & Done!",
    descBn: '"Load unpacked" বাটনে ক্লিক করে extract করা ফোল্ডারটি select করুন — Extension চালু!',
    descEn: 'Click "Load unpacked", select your extracted folder — Extension is ready!',
  },
];

export default function App() {
  const [particles, setParticles] = useState<{x:number;y:number;s:number;d:number}[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = `${BASE}/api/extension/download`;
    a.download = "Shourov-Fb-AutoLogin.zip";
    a.click();
    setDownloaded(true);
    setShowModal(true);
  }

  function handleDownloadCrx() {
    const a = document.createElement("a");
    a.href = `${BASE}/api/extension/download-crx`;
    a.download = "Shourov-Fb-AutoLogin.crx";
    a.click();
    setDownloaded(true);
    setShowModal(true);
  }

  useEffect(() => {
    const ps = Array.from({length: 16}, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 0.4 + Math.random() * 0.8,
      d: 7 + Math.random() * 14,
    }));
    setParticles(ps);
  }, []);

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#07101f 0%,#0d1e42 50%,#07101f 100%)",fontFamily:"'Segoe UI',Arial,sans-serif",color:"#fff",overflowX:"hidden"}}>

      {/* SEO hidden */}
      <span style={{position:"absolute",width:1,height:1,overflow:"hidden",opacity:0,pointerEvents:"none"}}>
        Shourov FB AutoLogin Facebook Auto Login Chrome Extension Alihsan Shourov
      </span>

      {/* Particles */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {particles.map((p,i)=>(
          <div key={i} style={{
            position:"absolute",left:`${p.x}%`,top:`${p.y}%`,
            width:`${p.s*9}px`,height:`${p.s*9}px`,borderRadius:"50%",
            background:`rgba(24,119,242,${0.07+p.s*0.09})`,
            animation:`floatP ${p.d}s ease-in-out infinite alternate`,
            animationDelay:`${i*0.35}s`,
          }}/>
        ))}
      </div>

      <style>{`
        @keyframes floatP { 0%{transform:translateY(0) scale(1)} 100%{transform:translateY(-28px) scale(1.12)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(24,119,242,.5)} 50%{box-shadow:0 0 0 20px rgba(24,119,242,0)} }
        @keyframes shine { 0%{left:-100%} 100%{left:220%} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(24,119,242,.5),0 0 40px rgba(24,119,242,.2)} 50%{box-shadow:0 0 30px rgba(24,119,242,.8),0 0 60px rgba(24,119,242,.4)} }
        .wa-btn:hover { transform:translateY(-2px) scale(1.04); box-shadow:0 12px 40px rgba(37,211,102,.55)!important; }
        .wa-btn:active { transform:scale(0.97); }
        .add-btn:hover { transform:translateY(-2px) scale(1.03); box-shadow:0 12px 40px rgba(24,119,242,.6)!important; }
        .add-btn:active { transform:scale(0.97); }
        .feature-card:hover { transform:translateY(-5px); border-color:rgba(24,119,242,.45)!important; background:rgba(24,119,242,.06)!important; }
        .step-row:hover .step-num { background:rgba(24,119,242,.4)!important; }
      `}</style>

      {/* ─── HERO ─── */}
      <section style={{position:"relative",zIndex:1,textAlign:"center",padding:"70px 24px 60px",animation:"fadeIn .8s ease"}}>

        {/* FB icon */}
        <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:84,height:84,borderRadius:"20px",background:"linear-gradient(135deg,#1877f2,#0d5fc7)",marginBottom:22,animation:"pulse 3s infinite"}}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>

        <div style={{display:"inline-block",background:"rgba(24,119,242,.15)",border:"1px solid rgba(24,119,242,.3)",borderRadius:"100px",padding:"4px 16px",fontSize:12,color:"#6ab0ff",margin:"12px 0 16px",letterSpacing:1}}>
          Chrome Extension
        </div>

        <h1 style={{fontSize:"clamp(2rem,5vw,3.4rem)",fontWeight:900,margin:"0 0 10px",lineHeight:1.1,background:"linear-gradient(135deg,#fff 40%,#6ab0ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Shourov-Fb-AutoLogin
        </h1>

        <p style={{fontSize:"clamp(0.95rem,2vw,1.1rem)",color:"rgba(255,255,255,.55)",maxWidth:520,margin:"0 auto 10px",lineHeight:1.8}}>
          Facebook এ auto login করুন মুহূর্তের মধ্যে
        </p>
        <p style={{fontSize:"clamp(0.82rem,1.6vw,0.95rem)",color:"rgba(255,255,255,.35)",maxWidth:520,margin:"0 auto 38px",lineHeight:1.7}}>
          Log into Facebook instantly — 2FA, CAPTCHA all handled automatically
        </p>

        {/* Download buttons */}
        <div style={{display:"flex",flexWrap:"wrap",gap:12,justifyContent:"center",alignItems:"center"}}>
          {/* PC / Laptop — ZIP */}
          <div style={{textAlign:"center"}}>
            <button
              onClick={handleDownload}
              className="add-btn"
              style={{
                display:"inline-flex",alignItems:"center",gap:10,
                background:"linear-gradient(135deg,#1877f2,#0d5fc7)",
                border:"none",borderRadius:14,padding:"15px 30px",
                color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",
                boxShadow:"0 6px 30px rgba(24,119,242,.45)",
                transition:"all .25s ease",position:"relative",overflow:"hidden",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              💻 Laptop / PC
              <span style={{position:"absolute",top:0,left:"-100%",width:"55%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent)",animation:"shine 2.5s infinite"}}/>
            </button>
            <div style={{marginTop:5,fontSize:11,color:"rgba(255,255,255,.3)"}}>ZIP file · Load Unpacked</div>
          </div>

          {/* Mobile / Phone — CRX */}
          <div style={{textAlign:"center"}}>
            <button
              onClick={handleDownloadCrx}
              className="add-btn"
              style={{
                display:"inline-flex",alignItems:"center",gap:10,
                background:"linear-gradient(135deg,#25D366,#128C7E)",
                border:"none",borderRadius:14,padding:"15px 30px",
                color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",
                boxShadow:"0 6px 30px rgba(37,211,102,.4)",
                transition:"all .25s ease",position:"relative",overflow:"hidden",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              📱 Mobile / Phone
              <span style={{position:"absolute",top:0,left:"-100%",width:"55%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)",animation:"shine 2.5s infinite"}}/>
            </button>
            <div style={{marginTop:5,fontSize:11,color:"rgba(255,255,255,.3)"}}>CRX file · Kiwi Browser</div>
          </div>
        </div>
      </section>

      {/* ─── DEVELOPER CARD ─── */}
      <section style={{position:"relative",zIndex:1,maxWidth:480,margin:"0 auto 70px",padding:"0 24px",animation:"fadeIn 1s ease"}}>
        <div style={{
          background:"rgba(255,255,255,.04)",
          border:"1px solid rgba(24,119,242,.25)",
          borderRadius:20,padding:"28px 24px",textAlign:"center",
        }}>
          {/* Profile Pic — Big */}
          <div style={{position:"relative",display:"inline-block",marginBottom:16}}>
            <img
              src={PROFILE_PIC}
              alt="Alihsan Shourov"
              style={{
                width:110,height:110,borderRadius:"50%",objectFit:"cover",
                border:"3px solid #1877f2",display:"block",
                animation:"glow 3s ease-in-out infinite",
              }}
              onError={e=>{
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=Alihsan+Shourov&background=1877F2&color=fff&size=110`;
              }}
            />
            {/* Online badge */}
            <div style={{position:"absolute",bottom:6,right:6,width:18,height:18,borderRadius:"50%",background:"#25D366",border:"2.5px solid #07101f"}}/>
          </div>

          <div style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:20}}>Alihsan Shourov</div>

          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noreferrer"
              className="wa-btn"
              style={{
                display:"inline-flex",alignItems:"center",gap:7,
                background:"linear-gradient(135deg,#25D366,#128C7E)",
                borderRadius:10,padding:"10px 20px",
                color:"#fff",fontSize:14,fontWeight:700,textDecoration:"none",
                boxShadow:"0 4px 18px rgba(37,211,102,.35)",
                transition:"all .25s ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp করুন / Chat
            </a>

            <a
              href={FB_LINK}
              target="_blank"
              rel="noreferrer"
              style={{
                display:"inline-flex",alignItems:"center",gap:7,
                background:"rgba(24,119,242,.15)",
                border:"1px solid rgba(24,119,242,.35)",
                borderRadius:10,padding:"10px 20px",
                color:"#6ab0ff",fontSize:14,fontWeight:600,textDecoration:"none",
                transition:"all .25s ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#6ab0ff">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </a>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section style={{position:"relative",zIndex:1,maxWidth:960,margin:"0 auto",padding:"0 24px 80px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <h2 style={{fontSize:"clamp(1.4rem,3vw,2rem)",fontWeight:800,margin:"0 0 6px",color:"#fff"}}>
            কী কী সুবিধা আছে?
          </h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.35)",margin:0}}>What does this extension do?</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:18}}>
          {features.map((f,i)=>(
            <div key={i} className="feature-card" style={{
              background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",
              borderRadius:16,padding:"22px 20px",transition:"all .28s ease",cursor:"default",
            }}>
              <div style={{fontSize:30,marginBottom:10}}>{f.icon}</div>
              <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:2}}>{f.titleBn}</div>
              <div style={{fontSize:11,color:"#6ab0ff",marginBottom:10,fontWeight:500}}>{f.titleEn}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.5)",lineHeight:1.75,marginBottom:4}}>{f.descBn}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",lineHeight:1.65}}>{f.descEn}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW TO INSTALL ─── */}
      <section style={{position:"relative",zIndex:1,maxWidth:680,margin:"0 auto",padding:"0 24px 100px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <h2 style={{fontSize:"clamp(1.4rem,3vw,2rem)",fontWeight:800,margin:"0 0 6px",color:"#fff"}}>
            কিভাবে Add করবেন?
          </h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.35)",margin:0}}>How to Add to Chrome?</p>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {steps.map((s,i)=>(
            <div key={i} className="step-row" style={{
              display:"flex",gap:16,alignItems:"flex-start",
              background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",
              borderRadius:14,padding:"18px 20px",
            }}>
              <div className="step-num" style={{
                minWidth:42,height:42,borderRadius:11,
                background:"rgba(24,119,242,.18)",border:"1px solid rgba(24,119,242,.3)",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                transition:"background .2s",flexShrink:0,
              }}>
                <div style={{fontSize:15,fontWeight:800,color:"#1877f2",lineHeight:1}}>{s.num}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,.3)",lineHeight:1}}>{s.numEn}</div>
              </div>
              <div>
                <div style={{fontSize:14.5,fontWeight:700,color:"#fff",marginBottom:2}}>{s.titleBn}</div>
                <div style={{fontSize:11.5,color:"#6ab0ff",fontWeight:500,marginBottom:7}}>{s.titleEn}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.48)",lineHeight:1.7,marginBottom:3}}>{s.descBn}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.28)",lineHeight:1.6}}>{s.descEn}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{display:"flex",flexWrap:"wrap",gap:12,justifyContent:"center",marginTop:40}}>
          <div style={{textAlign:"center"}}>
            <button onClick={handleDownload} className="add-btn" style={{display:"inline-flex",alignItems:"center",gap:9,background:"linear-gradient(135deg,#1877f2,#0d5fc7)",border:"none",borderRadius:13,padding:"14px 28px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 28px rgba(24,119,242,.4)",transition:"all .25s ease",position:"relative",overflow:"hidden"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              💻 Laptop / PC Download
              <span style={{position:"absolute",top:0,left:"-100%",width:"55%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)",animation:"shine 2.5s infinite"}}/>
            </button>
            <div style={{marginTop:5,fontSize:11,color:"rgba(255,255,255,.3)"}}>ZIP · Load Unpacked</div>
          </div>
          <div style={{textAlign:"center"}}>
            <button onClick={handleDownloadCrx} className="add-btn" style={{display:"inline-flex",alignItems:"center",gap:9,background:"linear-gradient(135deg,#25D366,#128C7E)",border:"none",borderRadius:13,padding:"14px 28px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 28px rgba(37,211,102,.35)",transition:"all .25s ease",position:"relative",overflow:"hidden"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              📱 Mobile / Phone Download
              <span style={{position:"absolute",top:0,left:"-100%",width:"55%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)",animation:"shine 2.5s infinite"}}/>
            </button>
            <div style={{marginTop:5,fontSize:11,color:"rgba(255,255,255,.3)"}}>CRX · Kiwi Browser</div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{position:"relative",zIndex:1,borderTop:"1px solid rgba(255,255,255,.06)",padding:"30px 24px",textAlign:"center"}}>
        <div style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>
          Developed by&nbsp;
          <a href={FB_LINK} target="_blank" rel="noreferrer" style={{color:"#6ab0ff",textDecoration:"none"}}>Alihsan Shourov</a>
          &nbsp;·&nbsp;
          <a href={WA_LINK} target="_blank" rel="noreferrer" style={{color:"#25D366",textDecoration:"none"}}>WhatsApp: 01709281334</a>
        </div>
      </footer>

      {/* ─── INSTALL MODAL ─── */}
      {showModal && (
        <div
          onClick={()=>setShowModal(false)}
          style={{
            position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:2000,
            display:"flex",alignItems:"center",justifyContent:"center",padding:20,
            backdropFilter:"blur(8px)",animation:"fadeIn .2s ease",
            overflowY:"auto",
          }}
        >
          <div onClick={e=>e.stopPropagation()} style={{
            background:"linear-gradient(135deg,#0d1b3e,#0a1228)",
            border:"1px solid rgba(24,119,242,.4)",borderRadius:22,
            padding:"26px 22px",maxWidth:460,width:"100%",
            boxShadow:"0 24px 70px rgba(0,0,0,.7)",
          }}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <div>
                <div style={{fontSize:19,fontWeight:800,color:"#25D366",marginBottom:2}}>
                  ✅ ডাউনলোড শুরু হয়েছে!
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>Download started! Now follow the steps below.</div>
              </div>
              <button
                onClick={()=>setShowModal(false)}
                style={{background:"rgba(255,255,255,.08)",border:"none",borderRadius:8,width:32,height:32,color:"#fff",fontSize:16,cursor:"pointer",flexShrink:0,marginLeft:10}}
              >✕</button>
            </div>

            {/* Install steps */}
            <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.5)",marginBottom:10,letterSpacing:.5}}>
              CHROME এ ADD করতে / TO ADD TO CHROME:
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {[
                {n:"১",nEn:"1",bn:"ZIP file Extract করুন",en:"Extract the downloaded ZIP file",sub:"ডাউনলোড হওয়া ZIP টি যেকোনো ফোল্ডারে extract করুন · Extract the ZIP to any folder"},
                {n:"২",nEn:"2",bn:"Chrome এ chrome://extensions লিখুন",en:"Type chrome://extensions in Chrome",sub:"Address bar এ এটি লিখে Enter দিন · Type this in the address bar and press Enter"},
                {n:"৩",nEn:"3",bn:"Developer Mode চালু করুন",en:"Enable Developer Mode",sub:"উপরে ডানদিকে Developer mode toggle চালু করুন · Toggle on Developer Mode (top right)"},
                {n:"৪",nEn:"4",bn:"Load Unpacked ক্লিক করুন",en:"Click Load Unpacked",sub:'"Load unpacked" বাটনে ক্লিক করে extract করা ফোল্ডার select করুন · Click "Load unpacked" and select your folder'},
                {n:"৫",nEn:"5",bn:"Done! Extension চালু হয়ে গেছে",en:"Done! Extension is ready",sub:'Toolbar এ "Shourov FB" আইকন দেখা যাবে · You\'ll see "Shourov FB" icon in the toolbar'},
              ].map((s,i)=>(
                <div key={i} style={{display:"flex",gap:11,alignItems:"flex-start"}}>
                  <div style={{minWidth:28,height:28,borderRadius:7,background:"rgba(24,119,242,.2)",border:"1px solid rgba(24,119,242,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#1877f2",flexShrink:0}}>
                    {s.nEn}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{s.bn}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.35)",lineHeight:1.6,marginTop:2}}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Re-download + close */}
            <div style={{display:"flex",gap:10}}>
              <button
                onClick={handleDownload}
                style={{
                  flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                  background:"rgba(24,119,242,.15)",border:"1px solid rgba(24,119,242,.35)",
                  borderRadius:10,padding:"11px",color:"#6ab0ff",fontSize:13,fontWeight:600,cursor:"pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                আবার ডাউনলোড / Re-download
              </button>
              <button
                onClick={()=>setShowModal(false)}
                style={{
                  flex:1,background:"linear-gradient(135deg,#1877f2,#0d5fc7)",
                  border:"none",borderRadius:10,padding:"11px",
                  color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",
                }}
              >
                বুঝেছি, ধন্যবাদ! / Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
