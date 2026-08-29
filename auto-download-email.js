(() => {
  'use strict';

  const pdfGeneratorEmail = (typeof emailInvoice === 'function') ? emailInvoice : null;
  if (!pdfGeneratorEmail) {
    console.error('ENERGETRA: PDF generator nije učitan.');
    return;
  }

  async function autoDownloadThenEmail(inv) {
    if (!inv?.buyer?.email) {
      alert('Kod kupca nije upisan email. Otvori Kupci i dopuni polje Email kupca.');
      try { showView('buyers'); } catch (_) {}
      return;
    }

    try {
      // Postojeći stabilni PDF generator pravi isti A4 PDF koji je već potvrđen kao dobar.
      await pdfGeneratorEmail(inv);

      const modal = document.getElementById('energetraStablePdfModal');
      const downloadBtn = modal?.querySelector('#ePdfDownload');
      if (!downloadBtn) throw new Error('PDF nije pripremljen za preuzimanje.');

      // Automatski sačuvaj PDF u Downloads na telefonu.
      downloadBtn.click();

      // Zatvori PDF prozor odmah nakon preuzimanja.
      const closeBtn = modal?.querySelector('#ePdfClose');
      if (closeBtn) closeBtn.click();
      else modal?.remove();

      // Zatim otvori podrazumevani mail program sa popunjenim primaocem, naslovom i tekstom.
      const subject = (typeof mailSubject === 'function')
        ? mailSubject(inv)
        : `Predračun br. ${inv.number} - ENERGETRA doo`;
      const body = (typeof mailBody === 'function')
        ? mailBody(inv)
        : `Poštovani,\n\nU prilogu je predračun br. ${inv.number}.`;
      const href = 'mailto:' + encodeURIComponent(inv.buyer.email)
        + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(body);

      setTimeout(() => { window.location.href = href; }, 650);
    } catch (err) {
      console.error('ENERGETRA auto PDF/email:', err);
      alert('Nisam uspeo automatski da preuzmem PDF. Probaj ponovo ili koristi „PDF / štampa“.');
    }
  }

  try {
    emailInvoice = autoDownloadThenEmail;
    const sendBtn = document.getElementById('sendInvoice');
    if (sendBtn) sendBtn.textContent = 'Pošalji kupcu';
    console.log('ENERGETRA: automatski download PDF + otvaranje emaila aktivno.');
  } catch (err) {
    console.error(err);
  }
})();