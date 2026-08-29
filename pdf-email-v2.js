(() => {
  'use strict';

  const PDFMAKE = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
  const VFONTS  = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js';
  let libPromise = null;

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const found=[...document.scripts].find(s=>s.src===src);
      if(found){ if(found.dataset.loaded==='1') return resolve(); found.addEventListener('load',resolve,{once:true}); found.addEventListener('error',reject,{once:true}); return; }
      const s=document.createElement('script'); s.src=src; s.async=true;
      s.onload=()=>{s.dataset.loaded='1';resolve()}; s.onerror=()=>reject(new Error('Ne mogu da učitam PDF biblioteku.'));
      document.head.appendChild(s);
    });
  }
  function loadPdfMake(){
    if(window.pdfMake) return Promise.resolve(window.pdfMake);
    if(!libPromise) libPromise=loadScript(PDFMAKE).then(()=>loadScript(VFONTS)).then(()=>{
      if(!window.pdfMake) throw new Error('PDF biblioteka nije dostupna.');
      return window.pdfMake;
    });
    return libPromise;
  }

  const nf = new Intl.NumberFormat('sr-RS',{minimumFractionDigits:2,maximumFractionDigits:2});
  const money = n => nf.format(+n||0)+' RSD';
  function dmy(v){ if(!v) return ''; const p=String(v).split('-'); return p.length===3?`${p[2]}. ${p[1]}. ${p[0]}.`:String(v); }
  function safeText(v){ return v==null?'':String(v); }

  async function imageData(src){
    if(!src) return null;
    if(/^data:image\//i.test(src)) return src;
    try{
      const r=await fetch(src,{cache:'force-cache'}); if(!r.ok) return null;
      const b=await r.blob();
      return await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>res(null);fr.readAsDataURL(b)});
    }catch(_){return null}
  }

  function totals(inv){
    if(inv.totals && Number.isFinite(+inv.totals.gross)) return inv.totals;
    const vp=Number.isFinite(+inv.vatRate)?+inv.vatRate:20, vr=vp/100;
    let net=0,vat=0,gross=0;
    (inv.items||[]).forEach(x=>{
      const unit=(+x.grossPrice||0)/(1+vr);
      const base=(+x.qty||0)*unit*(1-(+x.discount||0)/100);
      const v=base*vr; net+=base; vat+=v; gross+=base+v;
    });
    return {net,vat,gross};
  }

  function words(v){
    try { return typeof amountWords==='function' ? amountWords(v) : ''; } catch(_){ return ''; }
  }

  async function buildPdfBlob(inv){
    const pdfMake=await loadPdfMake();
    try{ if(typeof buildPrint==='function') buildPrint(inv); }catch(_){ }
    const logoEl=document.querySelector('#printSheet .inv-logo');
    const logo=await imageData(logoEl?.src||'./icon-512.png');
    const s=(typeof settings!=='undefined' && settings)?settings:{};
    const b=inv.buyer||{};
    const vatPct=Number.isFinite(+inv.vatRate)?+inv.vatRate:20;
    const vr=vatPct/100;
    const t=totals(inv);

    const companyMeta=[];
    if(s.address) companyMeta.push(s.address);
    const cityLine=[s.postal,s.city].filter(Boolean).join(' '); if(cityLine) companyMeta.push(cityLine);
    if(s.pib) companyMeta.push('PIB: '+s.pib);
    if(s.mb) companyMeta.push('MB: '+s.mb);
    if(s.bank) companyMeta.push('Tekući račun: '+s.bank);
    if(s.issuePlace) companyMeta.push('Mesto izdavanja: '+s.issuePlace);

    const buyerAddr=[b.address,[b.postal,b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

    const body=[[
      {text:'RB',style:'th'}, {text:'ŠIFRA',style:'th'}, {text:'NAZIV PROIZVODA / USLUGE',style:'th'},
      {text:'J.M.',style:'th'}, {text:'KOL.',style:'th'}, {text:'CENA BEZ PDV',style:'th'},
      {text:'RABAT',style:'th'}, {text:'OSNOVICA',style:'th'}, {text:'PDV '+vatPct+'%',style:'th'}, {text:'UKUPNO',style:'th'}
    ]];
    (inv.items||[]).forEach((x,i)=>{
      const unitNet=(+x.grossPrice||0)/(1+vr);
      const base=(+x.qty||0)*unitNet*(1-(+x.discount||0)/100);
      const vat=base*vr, gross=base+vat;
      body.push([
        {text:String(i+1),alignment:'center'}, safeText(x.code), safeText(x.name),
        {text:safeText(x.jm||'kom'),alignment:'center'}, {text:nf.format(+x.qty||0),alignment:'right'},
        {text:nf.format(unitNet),alignment:'right'}, {text:nf.format(+x.discount||0)+'%',alignment:'right'},
        {text:nf.format(base),alignment:'right'}, {text:nf.format(vat),alignment:'right'}, {text:nf.format(gross),alignment:'right',bold:true}
      ]);
    });

    const headerLeft=[];
    if(logo) headerLeft.push({image:logo,fit:[150,68],margin:[0,0,0,5]});
    if(companyMeta.length) headerLeft.push({text:companyMeta.join('\n'),fontSize:8,color:'#333333',lineHeight:1.25});

    const doc={
      pageSize:'A4', pageMargins:[25,24,25,24],
      defaultStyle:{font:'Roboto',fontSize:8.2,color:'#111111'},
      styles:{
        title:{fontSize:22,bold:true,alignment:'right'},
        docno:{fontSize:13,bold:true,alignment:'right'},
        small:{fontSize:8,color:'#333333'},
        label:{fontSize:7,bold:true,color:'#5f6b77'},
        th:{fontSize:6.5,bold:true,alignment:'center',color:'#111111'}
      },
      content:[
        {columns:[
          {width:'55%',stack:headerLeft},
          {width:'45%',stack:[
            {text:'PREDRAČUN',style:'title'},
            {text:'br. '+inv.number,style:'docno',margin:[0,2,0,7]},
            {table:{widths:['auto','*'],body:[
              [{text:'Datum:',bold:true,alignment:'right'}, {text:dmy(inv.date),alignment:'right'}],
              [{text:'Datum prometa:',bold:true,alignment:'right'}, {text:dmy(inv.trafficDate||inv.date),alignment:'right'}],
              [{text:'Rok plaćanja:',bold:true,alignment:'right'}, {text:dmy(inv.dueDate||inv.date),alignment:'right'}]
            ]},layout:'noBorders'}
          ]}
        ],columnGap:18,margin:[0,0,0,10]},

        {table:{widths:['*'],body:[[{stack:[
          {text:'KUPAC',style:'label',margin:[0,0,0,3]},
          {text:safeText(b.name),fontSize:12,bold:true,margin:[0,0,0,2]},
          {columns:[
            {width:'*',text:buyerAddr||' '},
            {width:'auto',text:[b.pib?'PIB: '+b.pib:'',b.mb?'MB: '+b.mb:''].filter(Boolean).join('   '),alignment:'right'}
          ]},
          b.email?{text:'Email: '+b.email,fontSize:7.5,color:'#555555',margin:[0,2,0,0]}:{text:''}
        ],fillColor:'#fafbfc',margin:[7,6,7,6]}]]},layout:{hLineColor:()=> '#aeb7c2',vLineColor:()=> '#aeb7c2',hLineWidth:()=>0.7,vLineWidth:()=>0.7},margin:[0,0,0,10]},

        {table:{headerRows:1,widths:[18,43,'*',26,28,49,34,48,43,49],body},
          layout:{fillColor:r=>r===0?'#edf1f5':null,hLineColor:()=> '#c7ccd2',vLineColor:()=> '#d8dde3',hLineWidth:r=>r===0?0.8:0.35,vLineWidth:()=>0.35,paddingLeft:()=>3,paddingRight:()=>3,paddingTop:()=>4,paddingBottom:()=>4},
          margin:[0,0,0,10]},

        {columns:[
          {width:'58%',stack:[
            inv.note?{text:[{text:'NAPOMENA / USLOVI\n',bold:true},inv.note],fontSize:8.2,margin:[0,0,0,5]}:{text:''},
            s.taxNote && String(s.taxNote).toUpperCase()!=='NEMA'?{text:'Poreska napomena: '+s.taxNote,fontSize:7.5,margin:[0,0,0,5]}:{text:''},
            {text:[{text:'SLOVIMA: ',bold:true},words(t.gross)],fontSize:8.2}
          ]},
          {width:'42%',table:{widths:['*','auto'],body:[
            ['Poreska osnovica',{text:money(t.net),alignment:'right'}],
            ['PDV '+vatPct+'%',{text:money(t.vat),alignment:'right'}],
            [{text:'ZA PLAĆANJE',bold:true,fontSize:10},{text:money(t.gross),bold:true,fontSize:11,alignment:'right'}]
          ]},layout:{hLineWidth:r=>r===2?0.8:0.3,hLineColor:()=> '#aeb7c2',vLineWidth:()=>0,paddingTop:()=>4,paddingBottom:()=>4}}
        ],columnGap:15,margin:[0,0,0,10]},

        {table:{widths:['*'],body:[[{stack:[
          {text:'UPUTSTVO ZA PLAĆANJE',bold:true,fontSize:10,color:'#b42318',alignment:'center',margin:[0,0,0,4]},
          {text:'Uplatu u iznosu od '+money(t.gross)+' izvršiti na račun '+safeText(s.bank),bold:true,alignment:'center'},
          {text:'Poziv na broj: '+inv.number,bold:true,alignment:'center',margin:[0,3,0,0]}
        ],fillColor:'#fff4f2',margin:[8,7,8,7]}]]},layout:{hLineColor:()=> '#d92d20',vLineColor:()=> '#d92d20',hLineWidth:()=>1,vLineWidth:()=>1},margin:[0,0,0,8]},

        {text:'Ovaj dokument je sačinjen u elektronskom obliku. Elektronskom dokumentu ne može se osporiti punovažnost, dokazna snaga niti pisana forma samo zato što je u elektronskom obliku. Pečat nije obavezan za privredna društva i preduzetnike.',fontSize:6.7,color:'#667085',alignment:'center',margin:[16,0,16,0]}
      ],
      footer:(current,pageCount)=>({text:`Strana ${current}/${pageCount}`,fontSize:6.5,color:'#98a2b3',alignment:'center',margin:[0,8,0,0]})
    };

    return await new Promise((resolve,reject)=>{
      try{ pdfMake.createPdf(doc).getBlob(resolve); }catch(e){reject(e)}
    });
  }

  function removeModal(){ document.getElementById('energetraStablePdfModal')?.remove(); }
  function downloadFile(file){ const u=URL.createObjectURL(file); const a=document.createElement('a'); a.href=u; a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),15000); }

  function showReady(file,inv){
    removeModal();
    const canShare=!!(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]})));
    const el=document.createElement('div'); el.id='energetraStablePdfModal';
    el.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.58);display:grid;place-items:center;padding:18px;font-family:Arial,Helvetica,sans-serif';
    el.innerHTML=`<div style="background:#fff;border-radius:18px;width:min(450px,100%);padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.28);color:#111827">
      <div style="font-size:20px;font-weight:800;margin-bottom:7px">PDF je spreman</div>
      <div style="font-size:14px;color:#475467;line-height:1.5;margin-bottom:12px">Predračun <b>${inv.number}</b> je napravljen kao pravi A4 PDF. Email kupca je: <b style="word-break:break-all">${safeText(inv.buyer?.email)}</b>.</div>
      <div style="font-size:12.5px;background:#f2f4f7;border-radius:10px;padding:10px 12px;line-height:1.45;margin-bottom:13px">Kad izabereš Gmail, PDF će biti prilog. Adresu kupca kopiram automatski — samo je nalepi u polje <b>Za</b>, pa ti pritisneš Send.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <button id="ePdfDownload" style="min-height:46px;border:1px solid #d0d5dd;border-radius:11px;background:#fff;font-weight:800">Preuzmi PDF</button>
        <button id="ePdfShare" style="min-height:46px;border:0;border-radius:11px;background:#2563eb;color:#fff;font-weight:800">${canShare?'Gmail / podeli PDF':'Podeli nije podržano'}</button>
      </div>
      <button id="ePdfClose" style="width:100%;min-height:42px;border:0;background:#f2f4f7;border-radius:10px;font-weight:700">Zatvori</button>
    </div>`;
    document.body.appendChild(el);
    el.querySelector('#ePdfClose').onclick=removeModal;
    el.querySelector('#ePdfDownload').onclick=()=>downloadFile(file);
    const sb=el.querySelector('#ePdfShare');
    if(!canShare){ sb.disabled=true; sb.style.opacity='.55'; }
    else sb.onclick=()=>{
      try{ navigator.clipboard?.writeText(inv.buyer?.email||''); }catch(_){ }
      const payload={files:[file],title:(typeof mailSubject==='function'?mailSubject(inv):`Predračun br. ${inv.number}`),text:(typeof mailBody==='function'?mailBody(inv):`Poštovani,\n\nU prilogu je predračun br. ${inv.number}.`)};
      navigator.share(payload).catch(err=>{ if(err?.name!=='AbortError'){ console.error(err); alert('Telefon nije prihvatio deljenje PDF-a. PDF možeš preuzeti dugmetom „Preuzmi PDF“.'); }});
    };
  }

  async function stableEmailInvoice(inv){
    if(!inv?.buyer?.email){ alert('Kod kupca nije upisan email.'); try{showView('buyers')}catch(_){} return; }
    const btn=document.getElementById('sendInvoice'), old=btn?.textContent;
    if(btn){btn.disabled=true;btn.textContent='Pravim PDF…'}
    try{
      const blob=await buildPdfBlob(inv);
      const file=new File([blob],`Predracun-${inv.number}.pdf`,{type:'application/pdf'});
      showReady(file,inv);
    }catch(e){ console.error(e); alert('Greška pri pravljenju PDF-a: '+(e?.message||e)); }
    finally{ if(btn){btn.disabled=false;btn.textContent=old||'Pošalji PDF'} }
  }

  try{
    emailInvoice=stableEmailInvoice;
    const b=document.getElementById('sendInvoice'); if(b)b.textContent='Pošalji PDF';
    console.log('ENERGETRA: stabilni PDF za slanje aktivan');
  }catch(e){console.error(e)}
})();