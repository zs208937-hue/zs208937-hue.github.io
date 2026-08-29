(() => {
  'use strict';

  const makePdfFlow = (typeof emailInvoice === 'function') ? emailInvoice : null;
  if (!makePdfFlow) {
    console.error('ENERGETRA: stabilni PDF generator nije učitan.');
    return;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function downloadPdfThenOpenEmail(inv) {
    if (!inv?.buyer?.email) {
      alert('Kod kupca nije upisan email. Otvori Kupci i dopuni polje Email kupca.');
      try { showView('buyers'); } catch (_) {}
      return;
    }

    const sendBtn = document.getElementById('sendInvoice');
    const oldText = sendBtn?.textContent || 'Pošalji kupcu';
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Pravim PDF…';
    }

    try {
      // 1) Napravi isti stabilni A4 PDF koji je već potvrđen kao dobar.
      await makePdfFlow(inv);

      // 2) Stabilni generator otvara svoj mali prozor sa gotovim PDF-om.
      const modal = document.getElementById('energetraStablePdfModal');
      const downloadBtn = modal?.querySelector('#ePdfDownload');
      if (!downloadBtn) throw new Error('PDF nije pripremljen za preuzimanje.');

      if (sendBtn) sendBtn.textContent = 'Preuzimam PDF…';

      // 3) Pokreni download DOK je aplikacija još u browseru.
      downloadBtn.click();

      // Ne otvaraj email odmah: na Samsung/Chrome uređajima mailto može da preseče download.
      await sleep(1800);

      // 4) Skloni PDF prozor tek nakon što je download imao vremena da krene.
      const closeBtn = modal?.querySelector('#ePdfClose');
      if (closeBtn) closeBtn.click();
      else modal?.remove();

      // 5) Otvori podrazumevani email program sa već popunjenim podacima.
      const subject = (typeof mailSubject === 'function')
        ? mailSubject(inv)
        : `Predračun br. ${inv.number} - ENERGETRA doo`;
      const body = (typeof mailBody === 'function')
        ? mailBody(inv)
        : `Poštovani,\n\nU prilogu je predračun br. ${inv.number}.`;

      const href = 'mailto:' + encodeURIComponent(inv.buyer.email)
        + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(body);

      if (sendBtn) sendBtn.textContent = 'Otvaram email…';
      await sleep(250);
      window.location.href = href;

    } catch (err) {
      console.error('ENERGETRA PDF/email:', err);
      alert('PDF se nije preuzeo. Probaj ponovo; ako telefon pita za dozvolu za preuzimanje, dozvoli je.');
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = oldText;
      }
    }
  }

  try {
    emailInvoice = downloadPdfThenOpenEmail;
    const sendBtn = document.getElementById('sendInvoice');
    if (sendBtn) sendBtn.textContent = 'Pošalji kupcu';
    console.log('ENERGETRA: PDF download pa email flow v3 aktivan.');
  } catch (err) {
    console.error(err);
  }
})();