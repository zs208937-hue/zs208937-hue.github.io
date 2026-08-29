(() => {
  'use strict';
  try {
    const proto = Object.getPrototypeOf(navigator);
    const desc = Object.getOwnPropertyDescriptor(proto, 'share');
    const original = desc && typeof desc.value === 'function' ? desc.value : (typeof navigator.share === 'function' ? navigator.share : null);
    if (!original || window.__energetraShareFixed) return;
    window.__energetraShareFixed = true;
    const wrapped = function(data){
      if (data && data.files && data.files.length) {
        return original.call(this, { files: data.files });
      }
      return original.call(this, data);
    };
    try {
      Object.defineProperty(proto, 'share', { value: wrapped, writable: true, configurable: true });
    } catch (_) {
      try { navigator.share = wrapped.bind(navigator); } catch (_) {}
    }
    console.log('ENERGETRA: Android PDF share compatibility fix active');
  } catch (e) {
    console.error('ENERGETRA share fix:', e);
  }
})();