/* ============================================================
   Hyperliquid clone — section pages runtime (Markets / Earn / Referrals)
   Data mirrors the demoData fixtures in coke-hyperliquid/frontend
   (hyperliquid-clone Vue source), so the UI renders without a backend.
   v9 — restores Markets / Earn / Referrals sections (previously dead
   nav links in the original clone).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- shared format helpers ---------- */
  function fmtNum(n, min, max) {
    if (min == null) min = 2;
    if (max == null) max = 2;
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
  }
  function fmtUsdCompact(n) {
    var abs = Math.abs(n), sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(2) + 'K';
    return sign + '$' + abs.toFixed(2);
  }
  function fmtPrice(n) {
    if (n < 1) return n.toPrecision(4);
    return fmtNum(n, 2, 2);
  }
  function fmtPct(n, sign) {
    return (sign && n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function changeClass(n) { return n > 0 ? 'up' : (n < 0 ? 'down' : 'muted'); }

  /* ---------- Markets fixtures ---------- */
  var perps = [
    { s: 'BTC', n: 'Bitcoin', p: 98250, c: 2.41, v: 4213500000, oi: 2104800000, f: 0.0089 },
    { s: 'ETH', n: 'Ethereum', p: 3412.5, c: 1.12, v: 1876200000, oi: 842300000, f: 0.0061 },
    { s: 'SOL', n: 'Solana', p: 214.8, c: -3.18, v: 982400000, oi: 401900000, f: 0.0112 },
    { s: 'HYPE', n: 'Hyperliquid', p: 28.64, c: 5.92, v: 654100000, oi: 312700000, f: 0.0145 },
    { s: 'AVAX', n: 'Avalanche', p: 41.7, c: -1.04, v: 312800000, oi: 98400000, f: 0.0073 },
    { s: 'DOGE', n: 'Dogecoin', p: 0.3821, c: 4.27, v: 488600000, oi: 156200000, f: 0.0098 },
    { s: 'LINK', n: 'Chainlink', p: 22.13, c: 0.86, v: 176300000, oi: 64100000, f: 0.0052 },
    { s: 'ARB', n: 'Arbitrum', p: 1.084, c: -2.55, v: 142900000, oi: 51700000, f: 0.0041 },
    { s: 'SUI', n: 'Sui', p: 4.62, c: 7.34, v: 388100000, oi: 121400000, f: 0.0128 },
    { s: 'XRP', n: 'XRP', p: 2.341, c: -0.72, v: 521700000, oi: 187300000, f: 0.0033 },
    { s: 'WIF', n: 'dogwifhat', p: 2.91, c: 9.12, v: 198400000, oi: 47200000, f: 0.0211 },
    { s: 'PEPE', n: 'Pepe', p: 0.0000178, c: -4.61, v: 233500000, oi: 58900000, f: 0.0186 }
  ];
  var spots = [
    { s: 'HYPE/USDC', n: 'Hyperliquid', p: 28.71, c: 5.74, v: 142300000 },
    { s: 'BTC/USDC', n: 'Bitcoin', p: 98280, c: 2.38, v: 312800000 },
    { s: 'ETH/USDC', n: 'Ethereum', p: 3415.2, c: 1.08, v: 198400000 },
    { s: 'SOL/USDC', n: 'Solana', p: 215.1, c: -3.22, v: 88700000 },
    { s: 'PURR/USDC', n: 'Purr', p: 0.421, c: 3.41, v: 12400000 },
    { s: 'USDC/USDC', n: 'USDC', p: 1.0, c: 0.01, v: 540200000 }
  ];
  var globalStats = {
    volume24h: perps.reduce(function (a, m) { return a + m.v; }, 0) + spots.reduce(function (a, m) { return a + m.v; }, 0),
    openInterest: perps.reduce(function (a, m) { return a + m.oi; }, 0),
    coins: perps.length + spots.length,
    perpCount: perps.length,
    spotCount: spots.length
  };

  function initMarkets() {
    var wrap = document.getElementById('marketsRoot');
    if (!wrap) return;

    // stat bar
    document.getElementById('mkVol').textContent = fmtUsdCompact(globalStats.volume24h);
    document.getElementById('mkOi').textContent = fmtUsdCompact(globalStats.openInterest);
    document.getElementById('mkCoins').textContent = String(globalStats.coins);
    document.getElementById('mkCounts').textContent = globalStats.perpCount + ' / ' + globalStats.spotCount;

    var tab = 'Perp';
    var search = '';
    var sortKey = 'v';
    var sortDir = -1;

    function rows() {
      var src = tab === 'Perp' ? perps : spots;
      var q = search.trim().toLowerCase();
      var r = src.filter(function (m) { return !q || m.s.toLowerCase().indexOf(q) >= 0 || m.n.toLowerCase().indexOf(q) >= 0; });
      var key = sortKey;
      return r.slice().sort(function (a, b) {
        var av = a[key] == null ? 0 : a[key];
        var bv = b[key] == null ? 0 : b[key];
        return (av - bv) * sortDir;
      });
    }

    function render() {
      var data = rows();
      var html = data.map(function (m, i) {
        var oi = tab === 'Perp' ? '<td class="num muted">' + fmtUsdCompact(m.oi) + '</td>' : '';
        var fund = tab === 'Perp' ? '<td class="num ' + changeClass(m.f) + '">' + fmtPct(m.f, false) + '</td>' : '';
        return '<tr data-sym="' + m.s + '">' +
          '<td class="muted num">' + (i + 1) + '</td>' +
          '<td><div class="sym">' + m.s + '<small>' + m.n + '</small></div></td>' +
          '<td class="num price">$' + fmtPrice(m.p) + '</td>' +
          '<td class="num ' + changeClass(m.c) + '">' + fmtPct(m.c) + '</td>' +
          '<td class="num muted">' + fmtUsdCompact(m.v) + '</td>' +
          oi + fund +
          '</tr>';
      }).join('');
      document.getElementById('mkBody').innerHTML = html || '<tr><td colspan="7" class="empty-state">No markets</td></tr>';

      // sort arrows
      document.querySelectorAll('[data-sort]').forEach(function (th) {
        var k = th.getAttribute('data-sort');
        var arrow = th.querySelector('.sortarrow');
        if (!arrow) return;
        arrow.textContent = k === sortKey ? (sortDir === 1 ? '▲' : '▼') : '';
      });
    }

    // tab switching
    document.querySelectorAll('[data-mktab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-mktab]').forEach(function (b) { b.classList.remove('segmented--active'); });
        btn.classList.add('segmented--active');
        tab = btn.getAttribute('data-mktab');
        // hide perp-only columns
        var oiCols = document.querySelectorAll('.col-oi, .col-fund');
        oiCols.forEach(function (c) { c.style.display = tab === 'Perp' ? '' : 'none'; });
        render();
      });
    });

    // search
    var sEl = document.getElementById('mkSearch');
    if (sEl) sEl.addEventListener('input', function () { search = sEl.value; render(); });

    // sort headers
    document.querySelectorAll('[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-sort');
        if (sortKey === k) sortDir = sortDir === 1 ? -1 : 1;
        else { sortKey = k; sortDir = -1; }
        render();
      });
    });

    // row click → open the market on the trade page
    // (mirrors Markets.vue: router.push({ path: '/trade', query: { symbol } }))
    var mkBody = document.getElementById('mkBody');
    if (mkBody) mkBody.addEventListener('click', function (e) {
      var tr = e.target.closest ? e.target.closest('tr[data-sym]') : null;
      if (!tr) return;
      var s = tr.getAttribute('data-sym');
      if (!s) return;
      var symbol = tab === 'Perp' ? s : s.split('/')[0];
      window.location.href = 'index.html?symbol=' + encodeURIComponent(symbol);
    });

    render();
  }

  /* ---------- Earn fixtures ---------- */
  var products = [
    { id: 'hype', name: 'Staked HYPE', sym: 'HYPE', apy: 2.84, tvl: 312400000, desc: 'Stake HYPE to secure the Hyperliquid L1 and earn protocol fees. Unstakes over 1 epoch (~a few hours).', action: 'Stake' },
    { id: 'sthype', name: 'Liquid Staked HYPE', sym: 'stHYPE', apy: 3.12, tvl: 156800000, desc: 'Liquid staking token — keep liquidity while earning HYPE staking rewards.', action: 'Stake' },
    { id: 'hlp', name: 'Hyperliquidity Provider', sym: 'HLP', apy: 14.6, tvl: 221900000, desc: 'Provide liquidity to the HLP vault; earns trading fees and is the counterparty to traders.', action: 'Deposit' },
    { id: 'ustb', name: 'USTB', sym: 'USTB', apy: 4.51, tvl: 88300000, desc: 'Tokenized Treasury fund backed by short-term US Treasuries.', action: 'Deposit' }
  ];

  function initEarn() {
    var root = document.getElementById('earnRoot');
    if (!root) return;

    var hypePrice = 28.64;
    var staked = 0;
    var msg = document.getElementById('earnMsg');

    function renderStats() {
      document.getElementById('stakedAmt').textContent = fmtNum(staked, 2, 2) + ' HYPE';
      document.getElementById('stakedVal').textContent = fmtUsdCompact(staked * hypePrice);
      document.getElementById('stakedRew').textContent = fmtNum(staked * 0.0284 / 12, 4, 4) + ' HYPE';
    }

    document.getElementById('earnApr').textContent = fmtPct(products[0].apy, false);

    var grid = document.getElementById('earnGrid');
    grid.innerHTML = products.map(function (p) {
      var btnLabel = p.action === 'Stake' ? ('Stake ' + p.sym) : ('Deposit ' + p.sym);
      return '<div class="product" data-id="' + p.id + '" role="button" tabindex="0" style="cursor:pointer">' +
        '<div class="product__head">' +
        '<div><div class="product__name">' + p.name + '</div><div class="product__sym">' + p.sym + '</div></div>' +
        '<div class="product__apy"><small>APY</small>' + fmtPct(p.apy, false) + '</div>' +
        '</div>' +
        '<p class="product__desc">' + p.desc + '</p>' +
        '<div class="product__row"><span>TVL</span><span>' + fmtUsdCompact(p.tvl) + '</span></div>' +
        '<div class="product__row"><span>Your Position</span><span>0.00 ' + p.sym + '</span></div>' +
        '<button class="btn btn--primary btn--block" style="margin-top:12px" data-earn="' + p.action + '" data-sym="' + p.sym + '">' + btnLabel + '</button>' +
        '</div>';
    }).join('');

    // card click → product detail (mirrors Earn.vue goDetail(id) → /staking/:id)
    grid.querySelectorAll('.product').forEach(function (card) {
      card.addEventListener('click', function () {
        window.location.href = 'earn-detail.html?id=' + encodeURIComponent(card.getAttribute('data-id'));
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = 'earn-detail.html?id=' + encodeURIComponent(card.getAttribute('data-id')); }
      });
    });

    // mirrors Earn.vue: Stake → stake(sym) 修改 HYPE 质押；Deposit → deposit(sym) 仅提示，不改质押
    // stop propagation so the local stake demo doesn't also trigger the card→detail navigation
    grid.querySelectorAll('[data-earn]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = b.getAttribute('data-earn');
        var sym = b.getAttribute('data-sym') || '';
        if (action === 'Deposit') {
          msg.className = 'ref-meta accent';
          msg.textContent = 'Deposit to ' + sym + ' opened (demo)';
          return;
        }
        if (staked <= 0) {
          staked += 100;
          msg.className = 'ref-meta accent';
          msg.textContent = 'Staked 100 ' + sym + ' (demo)';
        } else {
          staked = 0;
          msg.className = 'ref-meta';
          msg.textContent = 'Unstake initiated — unlocks after 1 epoch (demo)';
        }
        renderStats();
      });
    });

    // hero stake/unstake buttons
    var stakeBtn = document.getElementById('earnStake');
    var unstakeBtn = document.getElementById('earnUnstake');
    if (stakeBtn) stakeBtn.addEventListener('click', function () {
      staked += 100; renderStats();
      msg.className = 'ref-meta accent'; msg.textContent = 'Staked 100 HYPE (demo).';
    });
    if (unstakeBtn) unstakeBtn.addEventListener('click', function () {
      // Earn.vue: 失败提示用 text-sell（--hl-error）
      if (staked <= 0) { msg.className = 'ref-meta ref-meta--error'; msg.textContent = 'No staked HYPE to unstake'; return; }
      staked = 0; renderStats();
      msg.className = 'ref-meta accent'; msg.textContent = 'Unstake initiated — unlocks after 1 epoch (demo)';
    });

    renderStats();
  }

  /* ---------- Earn detail (mirrors EarnDetail.vue at /staking/:id) ---------- */
  // deterministic 30-day history generator (mirrors source buildEarnHistory)
  function buildEarnHistory(seed, apy, tvlUsd, n) {
    n = n || 30;
    var s = (seed >>> 0) || 1;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    var apyHistory = [], tvlHistory = [];
    for (var i = 0; i < n; i++) {
      apyHistory.push(Number((apy + (rnd() - 0.5) * apy * 0.4).toFixed(2)));
      tvlHistory.push(Number((tvlUsd / 1000000).toFixed(1)));
    }
    apyHistory[n - 1] = apy;
    tvlHistory[n - 1] = Number((tvlUsd / 1000000).toFixed(1));
    return { apyHistory: apyHistory, tvlHistory: tvlHistory };
  }

  // inline SVG sparkline (faithful-enough stand-in for the source LineChart component)
  function sparkline(data, color) {
    var w = 320, h = 90, base = 90, pad = 6, viewH = 92;
    var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
    var range = (max - min) || 1;
    var pts = data.map(function (v, i) {
      var x = pad + (i / (data.length - 1)) * (w - pad * 2);
      var y = (h - pad) - ((v - min) / range) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var line = pts.join(' ');
    var area = pad.toFixed(1) + ',' + base + ' ' + line + ' ' + (w - pad).toFixed(1) + ',' + base;
    var id = 'g' + Math.floor(Math.random() * 1e6);
    return '<svg viewBox="0 0 ' + w + ' ' + viewH + '" class="ed-spark" preserveAspectRatio="none">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.28"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon points="' + area + '" fill="url(#' + id + ')"/>' +
      '<polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '</svg>';
  }

  function edStat(label, value, sub) {
    return '<div class="card card--pad ed-stat">' +
      '<div class="ed-stat__label">' + label + '</div>' +
      '<div class="ed-stat__value">' + value + '</div>' +
      (sub ? '<div class="ed-stat__sub">' + sub + '</div>' : '') +
      '</div>';
  }

  function initEarnDetail() {
    var root = document.getElementById('edRoot');
    if (!root) return;

    var id = (location.search.match(/[?&]id=([^&]+)/) || [])[1] || '';
    var p = null;
    for (var i = 0; i < products.length; i++) { if (products[i].id === id) { p = products[i]; break; } }

    if (!p) {
      root.innerHTML = '<div class="card card--pad ed-empty">Product not found. <a href="earn.html" class="accent">Back to Earn</a></div>';
      return;
    }

    var hist = buildEarnHistory(p.id.charCodeAt(0) * 6151 + 271, p.apy, p.tvl);
    var yourPosition = 0, yourPositionUsd = 0;
    var estRewards = yourPositionUsd * p.apy / 100 / 12;

    var head = document.querySelector('title');
    if (head) head.textContent = p.name + ' | Hyperliquid';

    root.innerHTML =
      '<div class="card card--pad ed-header">' +
        '<div class="ed-header__main">' +
          '<div class="ed-avatar">' + p.sym.charAt(0) + '</div>' +
          '<div>' +
            '<div class="ed-header__title"><h1>' + p.name + '</h1><span class="ed-badge">' + p.sym + '</span></div>' +
            '<p class="ed-desc">' + p.desc + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="ed-header__apy"><span class="ed-header__apy-l">APY</span><span class="ed-header__apy-v">' + fmtPct(p.apy, false) + '</span></div>' +
      '</div>' +

      '<div class="ed-stats">' +
        edStat('APY', fmtPct(p.apy, false), '') +
        edStat('TVL', fmtUsdCompact(p.tvl), '') +
        edStat('Your Position', fmtNum(yourPosition, 2, 4) + ' ' + p.sym, fmtUsdCompact(yourPositionUsd)) +
        edStat('Est. Rewards (30d)', fmtNum(estRewards, 2, 4) + ' USDC', '') +
      '</div>' +

      '<div class="ed-charts">' +
        '<div class="card card--pad"><div class="ed-chart__head"><h3>APY (30d)</h3><span class="ed-chart__val up">' + fmtPct(p.apy, false) + '</span></div>' + sparkline(hist.apyHistory, '#50d2c1') + '</div>' +
        '<div class="card card--pad"><div class="ed-chart__head"><h3>TVL (30d, $M)</h3><span class="ed-chart__val">' + fmtUsdCompact(p.tvl) + '</span></div>' + sparkline(hist.tvlHistory, '#1fa67d') + '</div>' +
      '</div>' +

      '<div class="card card--pad ed-form">' +
        '<h3>' + p.action + ' ' + p.sym + '</h3>' +
        '<div class="ed-form__row">' +
          '<input type="number" min="0" class="field-input" id="edAmount" placeholder="0.00" />' +
          '<button class="btn btn--primary" id="edSubmit">' + p.action + '</button>' +
        '</div>' +
        '<p class="ref-meta" id="edMsg"></p>' +
      '</div>';

    var amount = document.getElementById('edAmount');
    var btn = document.getElementById('edSubmit');
    var msg = document.getElementById('edMsg');
    btn.addEventListener('click', function () {
      var amt = parseFloat(amount.value);
      if (!amt || amt <= 0) { msg.className = 'ref-meta ref-meta--error'; msg.textContent = 'Enter a valid amount'; return; }
      msg.className = 'ref-meta accent';
      msg.textContent = p.action + 'ed ' + amt + ' ' + p.sym + ' (demo)';
      amount.value = '';
    });
  }

  /* ---------- Referrals fixtures ---------- */
  var referralInfo = { code: 'COKE420', link: 'https://hyperliquid.xyz/ref/COKE420', total: 47, earned: 18240.5, tier: 'Tier 3', share: 0.12 };
  var tiers = [
    { t: 'Tier 1', r: '1-10', s: '10%', req: '1+ referred user' },
    { t: 'Tier 2', r: '11-25', s: '11%', req: '11+ referred users' },
    { t: 'Tier 3', r: '26-50', s: '12%', req: '26+ referred users' },
    { t: 'Tier 4', r: '51-100', s: '14%', req: '51+ referred users' },
    { t: 'Tier 5', r: '100+', s: '16%', req: '100+ referred users' }
  ];
  var recent = [
    { a: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', d: '2026-10-15', v: 84200, c: 210.5 },
    { a: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', d: '2026-10-12', v: 51900, c: 129.8 },
    { a: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', d: '2026-10-09', v: 38400, c: 96.0 },
    { a: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', d: '2026-10-05', v: 22100, c: 55.3 },
    { a: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', d: '2026-10-01', v: 15700, c: 39.3 }
  ];

  function shortAddr(a) { return a.slice(0, 6) + '…' + a.slice(-4); }

  function initReferrals() {
    var root = document.getElementById('refRoot');
    if (!root) return;

    document.getElementById('refCode').textContent = referralInfo.code;
    document.getElementById('refShare').textContent = (referralInfo.share * 100).toFixed(0) + '%';
    document.getElementById('refLink').value = referralInfo.link;
    document.getElementById('refTotal').textContent = String(referralInfo.total);
    document.getElementById('refEarned').textContent = fmtUsdCompact(referralInfo.earned);
    document.getElementById('refTier').textContent = referralInfo.tier;

    document.getElementById('refTiers').innerHTML = tiers.map(function (t) {
      var on = t.t === referralInfo.tier;
      return '<tr' + (on ? ' style="background:rgba(80,210,193,0.06)"' : '') + '>' +
        '<td class="' + (on ? 'accent' : '') + '" style="font-weight:500">' + t.t + '</td>' +
        '<td class="muted">' + t.r + '</td>' +
        '<td class="num">' + t.s + '</td>' +
        '<td class="muted">' + t.req + '</td></tr>';
    }).join('');

    document.getElementById('refRecent').innerHTML = recent.map(function (r) {
      return '<tr><td class="mono">' + shortAddr(r.a) + '</td><td class="muted">' + r.d + '</td>' +
        '<td class="num muted">' + fmtUsdCompact(r.v) + '</td>' +
        '<td class="num up">' + fmtUsdCompact(r.c) + '</td></tr>';
    }).join('');

    var copyBtn = document.getElementById('refCopy');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var inp = document.getElementById('refLink');
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(inp.value).then(function () { copyBtn.textContent = 'Copied!'; setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500); });
      } else {
        inp.select(); document.execCommand('copy'); copyBtn.textContent = 'Copied!'; setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
      }
    });
  }

  /* ---------- Outcomes (prediction markets) fixtures ---------- */
  var ocCats = ['All', 'Crypto', 'Economy', 'Politics', 'Sports', 'Culture'];
  var outcomes = [
    { q: 'Will BTC close above $100,000 on Dec 31, 2026?', cat: 'Crypto', end: 'Dec 31, 2026', yes: 0.62, vol: 1240000, users: 8400 },
    { q: 'Will ETH ETF net inflows exceed $10B by end of 2026?', cat: 'Crypto', end: 'Dec 31, 2026', yes: 0.41, vol: 820000, users: 5100 },
    { q: 'Will Hyperliquid (HYPE) reach a new ATH above $50 in 2026?', cat: 'Crypto', end: 'Dec 31, 2026', yes: 0.34, vol: 960000, users: 6700 },
    { q: 'Will DOGE flip SOL by market cap in 2026?', cat: 'Crypto', end: 'Dec 31, 2026', yes: 0.21, vol: 450000, users: 4900 },
    { q: 'Will the Fed cut rates at least 3 times in 2026?', cat: 'Economy', end: 'Dec 31, 2026', yes: 0.55, vol: 1530000, users: 9100 },
    { q: 'Will US real GDP growth exceed 2.5% in 2026?', cat: 'Economy', end: 'Dec 31, 2026', yes: 0.48, vol: 610000, users: 4300 },
    { q: 'Will a new all-time-high S&P 500 close happen before Q3 2026?', cat: 'Economy', end: 'Jun 30, 2026', yes: 0.73, vol: 1870000, users: 11200 },
    { q: 'Will the incumbent party hold the House in the 2026 midterms?', cat: 'Politics', end: 'Nov 2026', yes: 0.51, vol: 2180000, users: 14200 },
    { q: 'Will a 2026 presidential candidate be announced before Mar 2026?', cat: 'Politics', end: 'Mar 2026', yes: 0.66, vol: 540000, users: 5800 },
    { q: 'Will the Lakers win the 2026 NBA Championship?', cat: 'Sports', end: 'Jun 2026', yes: 0.18, vol: 540000, users: 8800 },
    { q: 'Will any team finish the 2026 NFL season undefeated?', cat: 'Sports', end: 'Feb 2027', yes: 0.07, vol: 390000, users: 6200 },
    { q: 'Will OpenAI release GPT-6 in 2026?', cat: 'Culture', end: 'Dec 31, 2026', yes: 0.44, vol: 710000, users: 7600 },
    { q: 'Will a major studio release a fully AI-generated feature film in 2026?', cat: 'Culture', end: 'Dec 31, 2026', yes: 0.29, vol: 280000, users: 3700 }
  ];

  function initOutcomes() {
    var root = document.getElementById('outcomesRoot');
    if (!root) return;

    var totalVol = outcomes.reduce(function (a, m) { return a + m.vol; }, 0);
    var totalUsers = outcomes.reduce(function (a, m) { return a + m.users; }, 0);
    document.getElementById('ocVol').textContent = fmtUsdCompact(totalVol);
    document.getElementById('ocMarkets').textContent = String(outcomes.length);
    document.getElementById('ocTraders').textContent = totalUsers.toLocaleString('en-US');
    document.getElementById('ocDay').textContent = fmtUsdCompact(totalVol * 0.18);

    var cat = 'All';
    var search = '';

    var catWrap = document.getElementById('ocCats');
    catWrap.innerHTML = ocCats.map(function (c) {
      return '<button class="chip' + (c === cat ? ' chip--active' : '') + '" data-occat="' + c + '">' + c + '</button>';
    }).join('');

    function rows() {
      var q = search.trim().toLowerCase();
      return outcomes.filter(function (m) {
        var okCat = cat === 'All' || m.cat === cat;
        var okQ = !q || m.q.toLowerCase().indexOf(q) >= 0;
        return okCat && okQ;
      });
    }

    function render() {
      var data = rows();
      var grid = document.getElementById('ocGrid');
      var empty = document.getElementById('ocEmpty');
      empty.style.display = data.length ? 'none' : 'block';
      grid.innerHTML = data.map(function (m) {
        var yesPct = Math.round(m.yes * 100);
        var noPct = 100 - yesPct;
        return '<div class="oc-card">' +
          '<div class="oc-card__top"><span class="oc-tag oc-tag--' + m.cat.toLowerCase() + '">' + m.cat + '</span><span class="oc-end">Ends ' + m.end + '</span></div>' +
          '<div class="oc-q">' + m.q + '</div>' +
          '<div class="oc-prob">' +
            '<div class="oc-prob__row"><span class="oc-side oc-side--yes">YES</span><span class="oc-prob__pct up">' + yesPct + '¢</span></div>' +
            '<div class="oc-bar"><div class="oc-bar__yes" style="width:' + yesPct + '%"></div><div class="oc-bar__no" style="width:' + noPct + '%"></div></div>' +
            '<div class="oc-prob__row"><span class="oc-side oc-side--no">NO</span><span class="oc-prob__pct down">' + noPct + '¢</span></div>' +
          '</div>' +
          '<div class="oc-card__foot"><span class="oc-vol">Vol <b>' + fmtUsdCompact(m.vol) + '</b></span><button class="btn btn--primary oc-trade">Trade</button></div>' +
          '</div>';
      }).join('');
    }

    catWrap.querySelectorAll('[data-occat]').forEach(function (b) {
      b.addEventListener('click', function () {
        catWrap.querySelectorAll('[data-occat]').forEach(function (x) { x.classList.remove('chip--active'); });
        b.classList.add('chip--active');
        cat = b.getAttribute('data-occat');
        render();
      });
    });

    var sEl = document.getElementById('ocSearch');
    if (sEl) sEl.addEventListener('input', function () { search = sEl.value; render(); });

    render();
  }

  /* ---------------- boot ---------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initMarkets(); initEarn(); initReferrals(); initOutcomes(); initEarnDetail(); });
  } else {
    initMarkets(); initEarn(); initReferrals(); initOutcomes(); initEarnDetail();
  }
})();
