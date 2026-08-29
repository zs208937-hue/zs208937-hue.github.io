(() => {
  'use strict';
  const HTML2PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  let html2pdfReady = null;
  function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (html2pdfReady) return html2pdfReady;
    html2pdfReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = HTML2PDF_URL;
      s.async = true;
      s.onload = () => resolve(window.html2pdf);
      s.onerror = () => reject(new Error('Ne mogu da učitam PDF modul. Proveri internet vezu.'));
      document.head.appendChild(s);
    });
    return html2pdfReady;
  }
  function getPrintCss() {
    let css = '';
    for (const sheet of Array.from(document.styleSheets || [])) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          const isPrint = rule.type === CSSRule.MEDIA_RULE && /print/i.test(rule.conditionText || rule.media?.mediaText || '');
          if (!isPrint) continue;
          for (const inner of Array.from(rule.cssRules || [])) css += inner.cssText + '\n';
        }
      } catch (_) {}
    }
    return css;
  }
  async function waitImages(root) {
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map(img => {
      if (img.complete) return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));
  }
  async function makePdfFile(inv) {
    if (typeof buildPrint !== 'function') throw new Error('Nije dostupna priprema predračuna.');
    buildPrint(inv);
    await loadHtml2Pdf();
    const source = document.getElementById('printSheet');
    if (!source || !source.innerHTML.trim()) throw new Error('Predračun nije pripremljen za PDF.');
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;height:1123px;border:0;background:#fff;pointer-events:none;z-index:-1;';
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument;
      doc.open();
      doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0!important;padding:0!important;background:#fff!important;font-family:Arial,Helvetica,sans-serif!important;color:#111!important}
        ${getPrintCss()}
        .print-sheet{display:block!important;width:100%!important}
      </style></head><body><div class="print-sheet">${source.innerHTML}</div></body></html>`);
      doc.close();
      await new Promise(resolve => setTimeout(resolve, 80));
      await waitImages(doc);
      const target = doc.querySelector('.invoice-print');
      if (!target) throw new Error('Ne mogu da pronađem sadržaj predračuna.');
      const options = {
        margin: [8, 7, 8, 7],
        filename: `Predracun-${inv.number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: { mode: ['css', 'legacy'] }
      };
      const worker = window.html2pdf().set(options).from(target).toPdf();
      const pdf = await worker.get('pdf');
      const blob = pdf.output('blob');
      return new File([blob], `Predracun-${inv.number}.pdf`, { type: 'application/pdf' });
    } finally {
      frame.remove();
    }
  }
  function removeShareModal() {
    document.getElementById('energetraPdfShareModal')?.remove();
  }
  function downloadFallback(file, inv) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    const href = 'mailto:' + encodeURIComponent(inv.buyer.email) +
      '?subject=' + encodeURIComponent(mailSubject(inv)) +
      '&body=' + encodeURIComponent(mailBody(inv));
    setTimeout(() => { window.location.href = href; }, 500);
    alert('PDF je preuzet na telefon. Email će se otvoriti sa primaocem i naslovom; ako telefon ne podržava deljenje fajla direktno, priloži preuzeti PDF.');
  }
  function showShareModal(file, inv) {
    removeShareModal();
    const overlay = document.createElement('div');
    overlay.id = 'energetraPdfShareModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);display:grid;place-items:center;padding:18px;';
    overlay.innerHTML = `
      <div style="width:min(440px,100%);background:#fff;border-radius:18px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.28);font-family:Arial,Helvetica,sans-serif;color:#111827">
        <div style="font-size:20px;font-weight:800;margin-bottom:8px">PDF je spreman</div>
        <div style="font-size:14px;line-height:1.5;color:#475467;margin-bottom:14px">
          Predračun <b>${String(inv.number).replace(/[&<>"']/g, '')}</b> je napravljen kao PDF.<br>
          Email kupca je kopiran: <b style="word-break:break-all">${String(inv.buyer.email).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</b>
        </div>
        <div style="font-size:13px;line-height:1.45;background:#f2f4f7;border-radius:10px;padding:10px 12px;margin-bottom:14px;color:#344054">
          Pritisni <b>„Podeli PDF“</b>, izaberi Gmail, pa nalepi adresu kupca u polje <b>Za</b>. PDF će već biti zakačen, a naslov i poruka će biti popunjeni.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
          <button type="button" id="energetraCancelShare" style="min-height:46px;border:1px solid #d0d5dd;border-radius:11px;background:#fff;font-weight:800;font-size:14px">Otkaži</button>
          <button type="button" id="energetraDoShare" style="min-height:46px;border:0;border-radius:11px;background:#2563eb;color:#fff;font-weight:800;font-size:14px">Podeli PDF</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#energetraCancelShare').onclick = removeShareModal;
    overlay.addEventListener('click', e => { if (e.target === overlay) removeShareModal(); });
    overlay.querySelector('#energetraDoShare').onclick = () => {
      const data = { title: mailSubject(inv), text: mailBody(inv), files: [file] };
      const supported = !!(navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] })));
      if (!supported) {
        removeShareModal();
        downloadFallback(file, inv);
        return;
      }
      navigator.share(data).then(removeShareModal).catch(err => {
        if (err && err.name === 'AbortError') return;
        console.error(err);
        removeShareModal();
        downloadFallback(file, inv);
      });
    };
  }
  async function newEmailInvoice(inv) {
    if (!inv?.buyer?.email) {
      alert('Kod kupca nije upisan email. Otvori Kupci i dopuni polje Email kupca.');
      if (typeof showView === 'function') showView('buyers');
      return;
    }
    try { navigator.clipboard?.writeText(inv.buyer.email); } catch (_) {}
    const oldLabel = document.getElementById('sendInvoice')?.textContent;
    const sendBtn = document.getElementById('sendInvoice');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Pravim PDF…';
    }
    try {
      const file = await makePdfFile(inv);
      showShareModal(file, inv);
    } catch (err) {
      console.error(err);
      alert('Nisam uspeo da napravim PDF za slanje. ' + (err?.message || err));
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = oldLabel || 'Pošalji';
      }
    }
  }
  try {
    emailInvoice = newEmailInvoice;
    const sendBtn = document.getElementById('sendInvoice');
    if (sendBtn) sendBtn.textContent = 'Pošalji PDF';
    console.log('ENERGETRA: PDF share modul aktivan.');
  } catch (err) {
    console.error('ENERGETRA PDF share init:', err);
  }
})();