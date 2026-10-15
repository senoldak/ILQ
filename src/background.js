// ILQ background service worker
// Protokol / PeerJS / şifreleme, WebRTC gerektirdiği için offscreen document'da çalışır.
// Bu service worker yalnızca: (1) offscreen doc'u canlı tutar, (2) popup <-> offscreen arası köprü kurar.

let offscreenCreated = false;

async function createOffscreenDoc() {
  // Manifest'e göre uzantı kökü değişiyor: kök manifest -> dist/ içinde,
  // dist klasörü yüklenirse -> kökte. İki adayı da dene.
  const candidates = ['offscreen.html', 'dist/offscreen.html'];
  let lastErr;
  for (const url of candidates) {
    try {
      await chrome.offscreen.createDocument({
        url,
        reasons: ['WEB_RTC'],
        justification: 'P2P WebRTC veri kanalı ile sunucusuz, uçtan uca şifreli mesajlaşma.',
      });
      return true;
    } catch (e) {
      lastErr = e;
    }
  }
  console.error('offscreen create failed', lastErr);
  return false;
}

async function ensureOffscreen() {
  if (offscreenCreated) return true;
  try {
    const has = await chrome.offscreen.hasDocument();
    if (has) {
      offscreenCreated = true;
      return true;
    }
    const ok = await createOffscreenDoc();
    offscreenCreated = ok;
    return ok;
  } catch (e) {
    console.error('offscreen create failed', e);
    return false;
  }
}

chrome.runtime.onStartup.addListener(ensureOffscreen);
chrome.runtime.onInstalled.addListener(ensureOffscreen);
ensureOffscreen();

// İkon sol tıklaması popup yerine sağ yüzü (side panel) açar.
try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
} catch (e) {
  console.error('sidePanel behavior failed', e);
}

// Popup'tan gelen istekleri offscreen'e ilet; cevabı geri gönder.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Yalnızca bu eklentinin kendi sayfalarından (popup/sidepanel) gelen mesajları işle.
  if (!msg || msg.target !== 'offscreen') return false;
  if (!sender || sender.id !== chrome.runtime.id) return false;
  ensureOffscreen().then((ok) => {
    if (!ok) {
      sendResponse({ ok: false, error: 'offscreen_yaratilamadi' });
      return;
    }
    // offscreen doc'un runtime.onMessage'ı bu mesajı alır
    chrome.runtime.sendMessage({ ...msg, hop: 'bg->offscreen' }, (resp) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: 'offscreen_yanit_yok' });
      } else {
        sendResponse(resp);
      }
    });
  });
  return true; // async
});

// Offscreen'den gelen olayları popup'a ilet (popup açıksa)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.hop !== 'offscreen->bg') return false;
  if (!sender || sender.id !== chrome.runtime.id) return false;
  if (msg.ev) {
    chrome.runtime.sendMessage({ target: 'popup', ev: msg.ev, payload: msg.payload });
  }
  return false;
});