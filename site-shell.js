(() => {
  const headerHost = document.querySelector('[data-site-header]');
  const footerHost = document.querySelector('[data-site-footer]');

  if (headerHost) {
    headerHost.innerHTML = `
      <header class="top" aria-label="網站導覽">
        <a class="brand" href="./index.html" aria-label="台灣工程地圖首頁">
          <img class="brandLogo" src="./Content/Taiwan_Construction.PNG" width="68" height="68" alt="台灣工程地圖商標" decoding="async" fetchpriority="high">
          <span class="brandWords">
            <b data-t="brand">台灣工程地圖</b>
            <small data-t="line">全國工程概況 × 五大圖層 × 資料入口</small>
          </span>
        </a>
        <nav id="mainNav" class="nav" aria-label="主要目錄"></nav>
      </header>`;
  }

  if (footerHost) {
    footerHost.innerHTML = `
      <footer class="foot">
        <span data-t="footer">資料以公開入口可回查內容整理；正式引用請回主管機關、發包單位與公告來源確認最新版本。地圖底圖 © OpenStreetMap contributors。</span>
        <small class="footerMeta">Copyright © 2026 Taiwan Construction Map</small>
      </footer>
      <div class="dock" aria-label="快速操作">
        <a href="https://www.instagram.com/taiwan.construction/" target="_blank" rel="noopener noreferrer" aria-label="開啟 Taiwan Construction Instagram">IG</a>
        <button id="lang" type="button" aria-label="切換中文與英文">EN</button>
      </div>`;
  }

  const candidateLabel = () => document.documentElement.lang === 'en' ? 'Candidate Projects' : '候選工程';

  const ensureCandidateNav = () => {
    const nav = document.querySelector('#mainNav');
    if (!nav) return;

    let link = nav.querySelector('a[href="./candidates.html"], a[href="./candidates"]');
    if (!link) {
      link = document.createElement('a');
      link.href = './candidates.html';
      const sourcesLink = nav.querySelector('a[href="./sources.html"], a[href="./sources"]');
      if (sourcesLink) nav.insertBefore(link, sourcesLink);
      else nav.appendChild(link);
    }

    const label = candidateLabel();
    if (link.textContent !== label) link.textContent = label;

    if (document.body?.dataset.page === 'candidates') {
      link.setAttribute('aria-current', 'page');
    } else if (link.getAttribute('aria-current') === 'page') {
      link.removeAttribute('aria-current');
    }
  };

  ensureCandidateNav();

  const nav = document.querySelector('#mainNav');
  if (nav) {
    new MutationObserver(ensureCandidateNav).observe(nav, { childList: true, subtree: true });
  }
  new MutationObserver(ensureCandidateNav).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang']
  });
})();