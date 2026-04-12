import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  {
    icon: "⚡",
    title: "Auto Login",
    desc: "UID ও Password paste করলেই Facebook এ auto login হয়ে যাবে।",
  },
  {
    icon: "🔐",
    title: "2FA Support",
    desc: "2FA থাকুক বা না থাকুক — দুই ক্ষেত্রেই কাজ করে। TOTP auto-generate।",
  },
  {
    icon: "🤖",
    title: "CAPTCHA Auto-Click",
    desc: "CAPTCHA আসলে auto-click করার চেষ্টা করে — ম্যানুয়াল ঝামেলা নেই।",
  },
  {
    icon: "🕐",
    title: "BD সময় ঘড়ি",
    desc: "Live বাংলাদেশ সময় দেখায় — সর্বদা আপডেট।",
  },
  {
    icon: "🛡️",
    title: "Protected Code",
    desc: "Extension এর কোড সম্পূর্ণ obfuscate করা — কেউ পড়তে পারবে না।",
  },
  {
    icon: "🇧🇩",
    title: "বাংলায় তৈরি",
    desc: "সম্পূর্ণ বাংলায় interface — সহজে বোঝা যায়।",
  },
];

const steps = [
  {
    num: "১",
    title: "Extension ডাউনলোড করুন",
    desc: 'নিচের "Add to Chrome" বাটনে ক্লিক করুন — ZIP file ডাউনলোড হবে।',
  },
  {
    num: "২",
    title: "ZIP extract করুন",
    desc: "ডাউনলোড করা ZIP file যেকোনো একটি ফোল্ডারে extract করুন।",
  },
  {
    num: "৩",
    title: "Chrome Extensions খুলুন",
    desc: 'Chrome এ যান → Address bar এ লিখুন: chrome://extensions',
  },
  {
    num: "৪",
    title: "Developer Mode চালু করুন",
    desc: 'উপরে ডানদিকে "Developer mode" toggle চালু করুন।',
  },
  {
    num: "৫",
    title: "Load Unpacked দিয়ে Add করুন",
    desc: '"Load unpacked" বাটনে ক্লিক করে extract করা ফোল্ডারটি select করুন।',
  },
  {
    num: "৬",
    title: "Done! Extension চালু হয়ে গেছে",
    desc: 'Chrome toolbar এ "Shourov FB" আইকন দেখা যাবে — ক্লিক করে ব্যবহার করুন।',
  },
];

export default function App() {
  const [showModal, setShowModal] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [particles, setParticles] = useState<{x:number;y:number;s:number;d:number}[]>([]);

  useEffect(() => {
    const ps = Array.from({length: 18}, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 0.4 + Math.random() * 0.8,
      d: 6 + Math.random() * 14,
    }));
    setParticles(ps);
  }, []);

  function handleAddToChrome() {
    const a = document.createElement("a");
    a.href = `${BASE}/api/extension/download`;
    a.click();
    setDownloaded(true);
    setShowModal(true);
  }

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0a0f1e 0%,#0d1b3e 40%,#091428 100%)",fontFamily:"'Segoe UI',Arial,sans-serif",color:"#fff",overflowX:"hidden"}}>

      {/* SEO hidden text for search engines */}
      <span style={{position:"absolute",width:1,height:1,overflow:"hidden",opacity:0,pointerEvents:"none"}}>
        নুসাইবা আইটি সেন্টার২৪৭৮ Nusaiba IT Center 2478 Nusaiba IT Shourov FB AutoLogin Facebook Auto Login Chrome Extension
      </span>

      {/* Floating particles */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {particles.map((p,i)=>(
          <div key={i} style={{
            position:"absolute",left:`${p.x}%`,top:`${p.y}%`,
            width:`${p.s*8}px`,height:`${p.s*8}px`,borderRadius:"50%",
            background:`rgba(24,119,242,${0.08+p.s*0.1})`,
            animation:`float ${p.d}s ease-in-out infinite alternate`,
            animationDelay:`${i*0.4}s`,
          }}/>
        ))}
      </div>

      <style>{`
        @keyframes float { 0%{transform:translateY(0) scale(1)} 100%{transform:translateY(-30px) scale(1.1)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(24,119,242,.5)} 50%{box-shadow:0 0 0 18px rgba(24,119,242,0)} }
        @keyframes shine { 0%{left:-100%} 100%{left:200%} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .add-btn:hover { transform:translateY(-2px) scale(1.03); box-shadow:0 12px 40px rgba(24,119,242,.55)!important; }
        .add-btn:active { transform:scale(0.98); }
        .feature-card:hover { transform:translateY(-4px); border-color:rgba(24,119,242,.5)!important; }
        .step-item:hover .step-num { background:#1877f2!important; }
        .modal-overlay { animation:fadeIn .2s ease; }
      `}</style>

      {/* HERO */}
      <section style={{position:"relative",zIndex:1,textAlign:"center",padding:"80px 24px 60px",animation:"fadeIn .8s ease"}}>

        {/* Logo */}
        <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:90,height:90,borderRadius:"22px",background:"linear-gradient(135deg,#1877f2,#0d5fc7)",boxShadow:"0 8px 32px rgba(24,119,242,.5)",marginBottom:28,animation:"pulse 3s infinite"}}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>

        {/* Brand Name */}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:"clamp(0.9rem,2vw,1.1rem)",fontWeight:800,color:"#6ab0ff",letterSpacing:1,marginBottom:4}}>
            নুসাইবা আইটি সেন্টার২৪৭৮
          </div>
          <div style={{fontSize:"clamp(0.75rem,1.5vw,0.85rem)",color:"rgba(255,255,255,.35)",letterSpacing:2}}>
            NUSAIBA IT CENTER 2478
          </div>
        </div>

        <div style={{display:"inline-block",background:"rgba(24,119,242,.15)",border:"1px solid rgba(24,119,242,.3)",borderRadius:"100px",padding:"5px 18px",fontSize:13,color:"#6ab0ff",marginBottom:20,letterSpacing:1}}>
          Chrome Extension
        </div>

        <h1 style={{fontSize:"clamp(2rem,5vw,3.5rem)",fontWeight:900,margin:"0 0 16px",lineHeight:1.1,background:"linear-gradient(135deg,#fff 40%,#6ab0ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Shourov-Fb-AutoLogin
        </h1>

        <p style={{fontSize:"clamp(1rem,2.5vw,1.25rem)",color:"rgba(255,255,255,.65)",maxWidth:560,margin:"0 auto 40px",lineHeight:1.7}}>
          Facebook এ auto login করুন মুহূর্তের মধ্যে — 2FA, CAPTCHA সব কিছু handle করে।
          Developed by <strong style={{color:"#6ab0ff"}}>Alihsan Shourov</strong>
        </p>

        {/* ADD TO CHROME BUTTON */}
        <button
          className="add-btn"
          onClick={handleAddToChrome}
          style={{
            display:"inline-flex",alignItems:"center",gap:12,
            background:"linear-gradient(135deg,#1877f2,#0d5fc7)",
            border:"none",borderRadius:14,padding:"16px 36px",
            color:"#fff",fontSize:18,fontWeight:700,cursor:"pointer",
            boxShadow:"0 6px 28px rgba(24,119,242,.45)",
            transition:"all .25s ease",position:"relative",overflow:"hidden",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Add to Chrome
          <span style={{position:"absolute",top:0,left:"-100%",width:"60%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent)",animation:"shine 2.5s infinite"}}/>
        </button>

        <p style={{marginTop:14,fontSize:13,color:"rgba(255,255,255,.35)"}}>
          ✓ Free &nbsp;·&nbsp; ✓ Protected &nbsp;·&nbsp; ✓ বাংলায় তৈরি
        </p>

        {/* Developer card */}
        <div style={{display:"inline-flex",alignItems:"center",gap:12,marginTop:36,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"10px 20px"}}>
          <img src="https://i.postimg.cc/JhXVqB55/IMG-8019.jpg" alt="Shourov"
            style={{width:38,height:38,borderRadius:"50%",objectFit:"cover",border:"2px solid #1877f2"}}
            onError={e=>{(e.target as HTMLImageElement).src="https://ui-avatars.com/api/?name=Alihsan+Shourov&background=1877F2&color=fff&size=38";}}
          />
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>Alihsan Shourov</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.45)"}}>Developer</div>
          </div>
          <a href="https://wa.me/8801709281334" target="_blank" rel="noreferrer"
            style={{display:"flex",alignItems:"center",gap:6,background:"rgba(37,211,102,.15)",border:"1px solid rgba(37,211,102,.3)",borderRadius:8,padding:"5px 12px",color:"#25D366",fontSize:12,fontWeight:600}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{position:"relative",zIndex:1,maxWidth:960,margin:"0 auto",padding:"0 24px 80px"}}>
        <h2 style={{textAlign:"center",fontSize:"clamp(1.4rem,3vw,2rem)",fontWeight:800,marginBottom:40,color:"#fff"}}>
          কী কী সুবিধা আছে?
        </h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:20}}>
          {features.map((f,i)=>(
            <div key={i} className="feature-card" style={{
              background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",
              borderRadius:16,padding:"24px 22px",transition:"all .25s ease",cursor:"default",
            }}>
              <div style={{fontSize:32,marginBottom:12}}>{f.icon}</div>
              <div style={{fontSize:16,fontWeight:700,marginBottom:8,color:"#fff"}}>{f.title}</div>
              <div style={{fontSize:13.5,color:"rgba(255,255,255,.55)",lineHeight:1.7}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* INSTALL STEPS */}
      <section style={{position:"relative",zIndex:1,maxWidth:720,margin:"0 auto",padding:"0 24px 100px"}}>
        <h2 style={{textAlign:"center",fontSize:"clamp(1.4rem,3vw,2rem)",fontWeight:800,marginBottom:40,color:"#fff"}}>
          কিভাবে install করবেন?
        </h2>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {steps.map((s,i)=>(
            <div key={i} className="step-item" style={{
              display:"flex",gap:16,alignItems:"flex-start",
              background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",
              borderRadius:14,padding:"18px 20px",
            }}>
              <div className="step-num" style={{
                minWidth:40,height:40,borderRadius:10,
                background:"rgba(24,119,242,.2)",border:"1px solid rgba(24,119,242,.3)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:16,fontWeight:800,color:"#1877f2",transition:"background .2s",
              }}>{s.num}</div>
              <div>
                <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:"#fff"}}>{s.title}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.5)",lineHeight:1.7}}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{textAlign:"center",marginTop:40}}>
          <button
            className="add-btn"
            onClick={handleAddToChrome}
            style={{
              display:"inline-flex",alignItems:"center",gap:10,
              background:"linear-gradient(135deg,#1877f2,#0d5fc7)",
              border:"none",borderRadius:12,padding:"14px 30px",
              color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",
              boxShadow:"0 4px 20px rgba(24,119,242,.4)",
              transition:"all .25s ease",position:"relative",overflow:"hidden",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            এখনই Add করুন
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{position:"relative",zIndex:1,borderTop:"1px solid rgba(255,255,255,.07)",padding:"28px 24px",textAlign:"center",color:"rgba(255,255,255,.35)",fontSize:13}}>
        <div style={{marginBottom:6,fontSize:15,fontWeight:700,color:"rgba(255,255,255,.5)"}}>
          নুসাইবা আইটি সেন্টার২৪৭৮ &nbsp;|&nbsp; Nusaiba IT Center 2478
        </div>
        <strong style={{color:"rgba(255,255,255,.6)"}}>Shourov-Fb-AutoLogin</strong>
        &nbsp;·&nbsp; Dev: <a href="https://www.facebook.com/profile.php?id=61588161951831" target="_blank" rel="noreferrer" style={{color:"#6ab0ff"}}>Alihsan Shourov</a>
        &nbsp;·&nbsp; <a href="https://wa.me/8801709281334" target="_blank" rel="noreferrer" style={{color:"#25D366"}}>01709281334</a>
      </footer>

      {/* INSTALL MODAL */}
      {showModal && (
        <div className="modal-overlay" style={{
          position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,
          display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)",
        }} onClick={()=>setShowModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:"linear-gradient(135deg,#0d1b3e,#0a1228)",
            border:"1px solid rgba(24,119,242,.35)",borderRadius:20,
            padding:"32px 28px",maxWidth:500,width:"100%",
            boxShadow:"0 20px 60px rgba(0,0,0,.6)",
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <div style={{fontSize:22,fontWeight:800,color:"#fff"}}>✅ ডাউনলোড শুরু হয়েছে!</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.45)",marginTop:4}}>এখন নিচের ধাপগুলো follow করুন</div>
              </div>
              <button onClick={()=>setShowModal(false)} style={{background:"rgba(255,255,255,.08)",border:"none",borderRadius:8,width:34,height:34,color:"#fff",fontSize:18,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {steps.map((s,i)=>(
                <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{minWidth:28,height:28,borderRadius:7,background:"rgba(24,119,242,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#6ab0ff"}}>{s.num}</div>
                  <div>
                    <div style={{fontSize:13.5,fontWeight:700,color:"#fff"}}>{s.title}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.45)",lineHeight:1.6}}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowModal(false)} style={{
              marginTop:24,width:"100%",background:"linear-gradient(135deg,#1877f2,#0d5fc7)",
              border:"none",borderRadius:10,padding:"12px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",
            }}>বুঝেছি, ধন্যবাদ!</button>
          </div>
        </div>
      )}
    </div>
  );
}
