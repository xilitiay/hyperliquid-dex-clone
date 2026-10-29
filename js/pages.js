/* ============================================================
   Hyperliquid clone — sub pages runtime (Vaults / Leaderboard / Portfolio)
   Structures extracted from the live site's route chunks
   (VaultMainPage / Leaderboard / Portfolio) via WebFetch, 2026-10-21.
   Live data: stats-data.hyperliquid.xyz (CORS open, Access-Control-Allow-Origin: *)
   v3 fidelity pass compared against thum.io captures of the original:
   - page bg #0f1a1e, time range dropdown (1D/7D/30D/All, default 30D)
   - vault TVL excludes child vaults ($272M), protocol vaults = HLP + Liquidator
   - leaderboard left-aligned numerics, person icon for display names
   - portfolio disconnected state ($0 values, fees 0.0450%/0.0150%)
   v5 granularity pass (route-chunk source analysis + thum.io captures):
   - vault TVL card: full amount, no abbreviation ($272,069,849)
   - leaderboard: hides vaults/treasuries (child + protocol vaults + hyperunit
     chain treasuries), Intl currency format (full, no "+" prefix), colored ROI
   - portfolio: 3-column top grid ([14d Vol + Fees] | Summary | Chart),
     white 2px step line with left integer y-axis 0-3 (no fill/grid),
     default graph PNL, 11 account-table tabs (Balances first, Positions active)
   ============================================================ */
(function () {
  'use strict';

  var STATS = 'https://stats-data.hyperliquid.xyz/Mainnet';

  /* ---------------- format helpers ---------------- */
  function fmtUSD(n, dp) {
    n = Number(n) || 0;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: dp == null ? 2 : dp, maximumFractionDigits: dp == null ? 2 : dp });
  }
  function shortAddr(a) {
    if (!a) return '—';
    return a.slice(0, 6) + '…' + a.slice(-4);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var WINDOW_LABELS = { day: '1D', week: '7D', month: '30D', allTime: 'All' };

  // protocol vault classification (matches the original site's hardcoded list:
  // "Hyperliquidity Provider (HLP)" + "Liquidator", by name or by leader address
  var PROTOCOL_VAULT_NAMES = {
    'Hyperliquidity Provider (HLP)': true,
    'Liquidator': true
  };
  var PROTOCOL_LEADERS = {
    '0x677d831aef5328190852e24f13c46cac05f984e7': true, // HLP
    '0xfc13878222c06e7cc043841027c893a4c9f180c9': true  // Liquidator
  };

  // hyperunit treasury addresses — the original site hides these from the
  // leaderboard (Leaderboard chunk: child vaults + named vaults + chain treasuries)
  var TREASURY_ADDRESSES = [
    '0x1c498a93b145e7a73d69691e9023f6f308e1cc3f', // avalanche
    '0x8d68efbf06fb8cf932518bcb53705e674c4852dc', // base
    '0x574bafce69d9411f662a433896e74e4f153096fa', // bitcoin
    '0x8dafbe89302656a7df43c470e9ebcb4c540835c0', // ethereum
    '0x1f6093d33db935b2ebd81d23312da5f11759973e', // ethereum (extra)
    '0xa822a9ceb6d6cb5b565bd10098abcfa9cf18d748', // solana
    '0xe6111266afdcdf0b1fe8505028cc1f7419d798a7', // plasma
    '0x24de6b77e8bc31c40aa452926daa6bbab7a71b0f', // monad
    '0x54cd89623888e8010fdea1c62e86265a9c6da950'  // zcash
  ];

  // sparkline: 80x22 svg path, green when last >= first else pink (matches the
  // original's compact ~33px row pitch; 30px tall sparklines inflated the rows)
  function sparkline(points) {
    if (!points || !points.length) return '';
    var w = 80, h = 22, pad = 2;
    var min = Math.min.apply(null, points), max = Math.max.apply(null, points);
    var span = max - min || 1;
    var step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
    var d = points.map(function (p, i) {
      var x = pad + i * step;
      var y = h - pad - ((p - min) / span) * (h - pad * 2);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    var up = points[points.length - 1] >= points[0];
    var color = up ? '#50d2c1' : '#ed7088';
    var gid = 'sg' + (up ? 'u' : 'd') + Math.random().toString(36).slice(2, 7);
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + color + '" stop-opacity="0.35"/>' +
      '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + d + ' L' + (w - pad) + ' ' + h + ' L' + pad + ' ' + h + ' Z" fill="url(#' + gid + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.5"/></svg>';
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* ---------------- generic dropdown ---------------- */
  function initDropdown(wrapId, onSelect) {
    var wrap = document.getElementById(wrapId);
    if (!wrap) return;
    var trigger = wrap.querySelector('.dd__trigger');
    var menu = wrap.querySelector('.dd__menu');
    if (!trigger || !menu) return;
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      // close other open menus
      document.querySelectorAll('.dd__menu--open').forEach(function (m) {
        if (m !== menu) m.classList.remove('dd__menu--open');
      });
      menu.classList.toggle('dd__menu--open');
    });
    menu.addEventListener('click', function (e) {
      var item = e.target.closest('.dd__item');
      if (!item) return;
      e.stopPropagation();
      if (onSelect) onSelect(item);
      menu.classList.remove('dd__menu--open');
    });
  }
  document.addEventListener('click', function () {
    document.querySelectorAll('.dd__menu--open').forEach(function (m) { m.classList.remove('dd__menu--open'); });
  });

  /* ============================================================
     VAULTS PAGE
     ============================================================ */
  function initVaults() {
    var rowsEl = document.getElementById('protocolRows');
    if (!rowsEl) return;

    var state = {
      vaults: [],
      filters: { leading: true, deposited: true, others: true, closed: false },
      search: '',
      window: 'month',
      sort: { key: 'tvl', dir: 'desc' },
      page: 0, rpp: 10
    };

    // main list excludes child vaults (same as the original site)
    function mainList() {
      return state.vaults.filter(function (v) {
        return v.summary && v.summary.relationship && v.summary.relationship.type !== 'child';
      });
    }

    function isProtocol(s) {
      return !!PROTOCOL_VAULT_NAMES[s.name] || !!PROTOCOL_LEADERS[(s.leader || '').toLowerCase()];
    }

    function vaultRows() {
      var out = { protocol: [], user: [] };
      mainList().forEach(function (v) {
        out[isProtocol(v.summary) ? 'protocol' : 'user'].push(v);
      });
      return out;
    }

    function rowModel(v) {
      var s = v.summary;
      var pnlMap = {};
      (v.pnls || []).forEach(function (p) { pnlMap[p[0]] = p[1]; });
      var series = pnlMap[state.window] || [];
      return {
        name: s.name,
        vaultAddress: s.vaultAddress,
        leader: s.leader,
        apr: Number(v.apr) || 0,
        tvl: Number(s.tvl) || 0,
        yourDeposit: 0, // no wallet connected
        age: Math.floor((Date.now() - s.createTimeMillis) / 86400000),
        isClosed: !!s.isClosed,
        series: series,
        raw: v
      };
    }

    function filtered() {
      var q = state.search.trim().toLowerCase();
      var groups = vaultRows();
      function keep(m) {
        if (m.isClosed) return state.filters.closed;
        return true; // Leading / Deposited / Others all visible when no wallet
      }
      function searchOk(m) {
        if (!q) return true;
        return m.name.toLowerCase().indexOf(q) !== -1 ||
          m.leader.toLowerCase().indexOf(q) !== -1 ||
          m.vaultAddress.toLowerCase().indexOf(q) !== -1;
      }
      return {
        protocol: groups.protocol.map(rowModel).filter(function (m) { return keep(m) && searchOk(m); }),
        user: groups.user.map(rowModel).filter(function (m) { return keep(m) && searchOk(m); })
      };
    }

    function sortRows(rows) {
      var k = state.sort.key, dir = state.sort.dir === 'asc' ? 1 : -1;
      return rows.slice().sort(function (a, b) {
        var va = a[k], vb = b[k];
        if (typeof va === 'string') return va.localeCompare(vb) * dir;
        return (va - vb) * dir;
      });
    }

    function rowHTML(m) {
      var nameCell = '<span class="vault-name"><span class="vault-name__text">' + esc(m.name) + '</span>' +
        (m.isClosed ? '<span class="badge-closed">Closed</span>' : '') + '</span>';
      var aprCell = m.apr ? (m.apr * 100).toFixed(2) + '%' : '-';
      var snap = m.series.length ? sparkline(m.series) : '<span class="muted">-</span>';
      return '<tr data-vault="' + esc(m.vaultAddress) + '">' +
        '<td>' + nameCell + '</td>' +
        '<td class="mono muted">' + shortAddr(m.leader) + '</td>' +
        '<td>' + aprCell + '</td>' +
        '<td>' + fmtUSD(m.tvl) + '</td>' +
        '<td class="' + (m.yourDeposit > 0 ? '' : 'muted') + '">' + fmtUSD(m.yourDeposit) + '</td>' +
        '<td>' + m.age + '</td>' +
        '<td class="num">' + snap + '</td>' +
        '</tr>';
    }

    function renderTable(tbodyId, emptyId, rows, pageInfoId, prevId, nextId) {
      var tbody = document.getElementById(tbodyId);
      var empty = document.getElementById(emptyId);
      var sorted = sortRows(rows);
      var totalPages = Math.max(1, Math.ceil(sorted.length / state.rpp));
      if (state.page >= totalPages) state.page = totalPages - 1;
      var slice = sorted.slice(state.page * state.rpp, (state.page + 1) * state.rpp);
      tbody.innerHTML = slice.map(rowHTML).join('');
      if (empty && !sorted.length) empty.style.display = '';
      else if (empty) empty.style.display = 'none';
      var pageInfo = document.getElementById(pageInfoId);
      if (pageInfo) {
        pageInfo.textContent =
          (sorted.length ? state.page * state.rpp + 1 : 0) + '–' + Math.min(sorted.length, (state.page + 1) * state.rpp) + ' of ' + sorted.length;
      }
      var prev = document.getElementById(prevId), next = document.getElementById(nextId);
      if (prev) prev.disabled = state.page === 0;
      if (next) next.disabled = state.page >= totalPages - 1;
    }

    function render() {
      var f = filtered();
      renderTable('protocolRows', 'protocolEmpty', f.protocol, 'protocolPageInfo', 'protocolPrev', 'protocolNext');
      renderTable('userRows', 'userEmpty', f.user, 'userPageInfo', 'userPrev', 'userNext');
      // header sort arrows
      document.querySelectorAll('#protocolTable th.sortable, #userTable th.sortable').forEach(function (th) {
        var base = th.textContent.replace(/[▲▼]\s*$/, '');
        th.innerHTML = esc(base) + (state.sort.key === th.dataset.key ? ' <span class="sortarrow">' + (state.sort.dir === 'asc' ? '▲' : '▼') + '</span>' : '');
      });
    }

    // controls
    document.getElementById('vaultSearch').addEventListener('input', debounce(function (e) {
      state.search = e.target.value; state.page = 0; render();
    }, 250));

    // filter dropdown: multi-select with label summary
    var FILTER_NAMES = { leading: 'Leading', deposited: 'Deposited', others: 'Others', closed: 'Closed' };
    initDropdown('vaultFilterDd', function (item) {
      var f = item.dataset.filter;
      state.filters[f] = !state.filters[f];
      item.classList.toggle('dd__item--active', state.filters[f]);
      item.querySelector('.dd__check').textContent = state.filters[f] ? '✓' : '';
      var active = Object.keys(state.filters).filter(function (k) { return state.filters[k]; }).map(function (k) { return FILTER_NAMES[k]; });
      document.getElementById('vaultFilterLabel').textContent = active.length ? active.join(', ') : 'None';
      state.page = 0; render();
    });

    // time range dropdown
    initDropdown('vaultTimeDd', function (item) {
      state.window = item.dataset.window;
      document.querySelectorAll('#vaultTimeMenu .dd__item').forEach(function (it) {
        var on = it === item;
        it.classList.toggle('dd__item--active', on);
        it.querySelector('.dd__check').textContent = on ? '✓' : '';
      });
      document.getElementById('vaultTimeLabel').textContent = WINDOW_LABELS[state.window];
      render();
    });

    ['protocol', 'user'].forEach(function (which) {
      document.querySelectorAll('#' + which + 'Table th.sortable').forEach(function (th) {
        th.addEventListener('click', function () {
          var k = th.dataset.key;
          if (state.sort.key === k) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
          else state.sort = { key: k, dir: 'desc' };
          state.page = 0; render();
        });
      });
      var rpp = document.getElementById(which + 'Rpp');
      if (rpp) rpp.addEventListener('change', function (e) {
        state.rpp = parseInt(e.target.value, 10) || 10; state.page = 0; render();
      });
      var prev = document.getElementById(which + 'Prev'), next = document.getElementById(which + 'Next');
      if (prev) prev.addEventListener('click', function () { state.page--; render(); });
      if (next) next.addEventListener('click', function () { state.page++; render(); });
    });
    document.getElementById('protocolRows').addEventListener('click', function (e) {
      var tr = e.target.closest('tr'); if (tr) console.log('open vault', tr.dataset.vault);
    });

    // fetch live data
    var vEmpty = document.getElementById('protocolEmpty');
    if (vEmpty) { vEmpty.textContent = 'Loading…'; vEmpty.style.display = ''; }
    fetch(STATS + '/vaults')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.vaults = Array.isArray(data) ? data : [];
        // TVL excludes child vaults (matches the original: $272M, not the raw $411M sum);
        // the original card shows the full amount with no abbreviation
        var total = mainList().reduce(function (s, v) { return s + (Number(v.summary.tvl) || 0); }, 0);
        document.getElementById('vaultTvl').textContent = '$' + Math.round(total).toLocaleString('en-US');
        if (vEmpty) vEmpty.textContent = 'No vaults';
        render();
      })
      .catch(function (err) {
        console.error('vaults fetch failed', err);
        document.getElementById('vaultTvl').textContent = 'unavailable';
        if (vEmpty) vEmpty.textContent = 'Failed to load vaults';
        render();
      });
  }

  /* ============================================================
     LEADERBOARD PAGE
     ============================================================ */
  function initLeaderboard() {
    var rowsEl = document.getElementById('lbRows');
    if (!rowsEl) return;

    var state = {
      rows: [],
      window: 'month',
      search: '',
      sort: { key: 'pnl', dir: 'desc' },
      page: 0, rpp: 10
    };

    // vaults + treasuries are hidden from the leaderboard (same rule as the
    // original site's Leaderboard chunk: child vaults, named protocol vaults
    // and the hyperunit chain treasury addresses)
    var excluded = {};
    var lbLoaded = false; // leaderboard rows arrived (guards against a premature empty render)

    function perf(row) {
      var map = {};
      (row.windowPerformances || []).forEach(function (p) { map[p[0]] = p[1]; });
      var w = map[state.window] || { pnl: 0, roi: 0, vlm: 0 };
      return { pnl: Number(w.pnl) || 0, roi: Number(w.roi) || 0, vlm: Number(w.vlm) || 0 };
    }

    function model(row) {
      var p = perf(row);
      return {
        rank: 0,
        ethAddress: row.ethAddress,
        displayName: row.displayName || '',
        accountValue: Number(row.accountValue) || 0,
        pnl: p.pnl, roi: p.roi, vlm: p.vlm
      };
    }

    function filtered() {
      var q = state.search.trim().toLowerCase();
      return state.rows.map(model).filter(function (m) {
        if (excluded[m.ethAddress.toLowerCase()]) return false;
        if (!q) return true;
        return m.ethAddress.toLowerCase().indexOf(q) !== -1 ||
          (m.displayName && m.displayName.toLowerCase().indexOf(q) !== -1);
      });
    }

    var PERSON_ICON = '<svg class="person-icon" viewBox="0 0 1024 1024" aria-hidden="true"><path fill="currentColor" d="M512 597.99q108.01 0 225 46.997t116.99 123.008v85.995H170.01v-85.995q0-76.01 116.99-123.008T512 597.99zM512 512q-69.99 0-120-50.005t-50.005-120 50.005-121.003T512 170.98q69.99 0 120 51.008t50.005 121.003-50.005 120-120 50.005z"/></svg>';

    function render() {
      var all = filtered();
      var k = state.sort.key, dir = state.sort.dir === 'asc' ? 1 : -1;
      all.sort(function (a, b) { return (a[k] - b[k]) * dir; });
      var totalPages = Math.max(1, Math.ceil(all.length / state.rpp));
      if (state.page >= totalPages) state.page = totalPages - 1;
      var slice = all.slice(state.page * state.rpp, (state.page + 1) * state.rpp);

      document.getElementById('lbRows').innerHTML = slice.map(function (m, i) {
        var rank = state.page * state.rpp + i + 1;
        var pnlCls = m.pnl >= 0 ? 'green' : 'pink';
        var roi = (m.roi * 100).toFixed(2) + '%';
        var name = m.displayName || shortAddr(m.ethAddress);
        var traderCell = m.displayName
          ? PERSON_ICON + '<span class="vault-name__text">' + esc(name) + '</span>'
          : '<span class="vault-name__text mono">' + esc(name) + '</span>';
        return '<tr>' +
          '<td><span class="rank-num">' + rank + '</span></td>' +
          '<td><span class="vault-name">' + traderCell + '</span></td>' +
          '<td>' + fmtUSD(m.accountValue) + '</td>' +
          '<td class="' + pnlCls + '">' + fmtUSD(m.pnl) + '</td>' +
          '<td class="' + (m.roi >= 0 ? 'green' : 'pink') + '">' + roi + '</td>' +
          '<td class="' + (m.vlm < 0.001 ? 'muted' : '') + '">' + fmtUSD(m.vlm) + '</td>' +
          '</tr>';
      }).join('');

      var lbEmpty = document.getElementById('lbEmpty');
      if (lbEmpty) {
        if (all.length) lbEmpty.style.display = 'none';
        else { lbEmpty.textContent = 'No traders'; lbEmpty.style.display = ''; }
      }
      document.getElementById('lbPageInfo').textContent =
        (all.length ? state.page * state.rpp + 1 : 0) + '–' + Math.min(all.length, (state.page + 1) * state.rpp) + ' of ' + all.length;
      document.getElementById('lbPrev').disabled = state.page === 0;
      document.getElementById('lbNext').disabled = state.page >= totalPages - 1;

      // header sort arrows — window suffix only on PNL/ROI/Volume (Account Value is live, not windowed)
      var WINDOWED = { pnl: 1, roi: 1, vlm: 1 };
      document.querySelectorAll('#lbTable th.sortable').forEach(function (th) {
        var base = th.textContent.replace(/[▲▼]\s*$/, '').replace(/\((1D|7D|30D|All)\)\s*$/, '').trim();
        var label = WINDOWED[th.dataset.key] ? base + ' (' + WINDOW_LABELS[state.window] + ')' : base;
        th.innerHTML = esc(label) + (state.sort.key === th.dataset.key ? ' <span class="sortarrow">' + (state.sort.dir === 'asc' ? '▲' : '▼') + '</span>' : '');
      });
    }

    document.getElementById('lbSearch').addEventListener('input', debounce(function (e) {
      state.search = e.target.value; state.page = 0; render();
    }, 250));

    initDropdown('lbTimeDd', function (item) {
      state.window = item.dataset.window;
      document.querySelectorAll('#lbTimeMenu .dd__item').forEach(function (it) {
        var on = it === item;
        it.classList.toggle('dd__item--active', on);
        it.querySelector('.dd__check').textContent = on ? '✓' : '';
      });
      document.getElementById('lbTimeLabel').textContent = WINDOW_LABELS[state.window];
      document.querySelectorAll('.lb-window-label').forEach(function (el) { el.textContent = WINDOW_LABELS[state.window]; });
      state.page = 0; render();
    });

    document.querySelectorAll('#lbTable th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.dataset.key;
        if (state.sort.key === k) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        else state.sort = { key: k, dir: 'desc' };
        state.page = 0; render();
      });
    });
    document.getElementById('lbRpp').addEventListener('change', function (e) {
      state.rpp = parseInt(e.target.value, 10) || 10; state.page = 0; render();
    });
    document.getElementById('lbPrev').addEventListener('click', function () { state.page--; render(); });
    document.getElementById('lbNext').addEventListener('click', function () { state.page++; render(); });

    // fetch live data
    var lbEmpty = document.getElementById('lbEmpty');
    if (lbEmpty) { lbEmpty.textContent = 'Loading…'; lbEmpty.style.display = ''; }
    fetch(STATS + '/leaderboard')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.rows = (data && data.leaderboardRows) || [];
        lbLoaded = true;
        render();
      })
      .catch(function (err) {
        console.error('leaderboard fetch failed', err);
        if (lbEmpty) lbEmpty.textContent = 'Failed to load leaderboard';
        render();
      });

    // exclusion list: child vaults + named protocol vaults + hyperunit treasuries
    fetch(STATS + '/vaults')
      .then(function (r) { return r.json(); })
      .then(function (vaults) {
        if (!Array.isArray(vaults)) return;
        vaults.forEach(function (v) {
          var s = v.summary;
          if (!s) return;
          if (s.relationship && s.relationship.type === 'child') excluded[String(s.vaultAddress).toLowerCase()] = true;
          if (PROTOCOL_VAULT_NAMES[s.name]) excluded[String(s.vaultAddress).toLowerCase()] = true;
        });
        TREASURY_ADDRESSES.forEach(function (a) { excluded[a] = true; });
        if (lbLoaded) render();
      })
      .catch(function () {
        TREASURY_ADDRESSES.forEach(function (a) { excluded[a] = true; });
        if (lbLoaded) render();
      });
  }

  /* ============================================================
     PORTFOLIO PAGE (structure clone, disconnected state = $0)
     ============================================================ */
  function initPortfolio() {
    var chartEl = document.getElementById('pfChart');
    if (!chartEl) return;

    var state = { window: 'month', graph: 'pnl', feeScope: 'perps', ptype: 'all' };

    // disconnected account: flat zero series (matches the original's empty state)
    function seriesFor(window_) {
      var n = { day: 24, week: 7 * 24, month: 30, allTime: 180 }[window_] || 30;
      var now = Math.floor(Date.now() / 1000);
      var step = { day: 3600, week: 6 * 3600, month: 86400, allTime: 5 * 86400 }[window_] || 86400;
      var out = [];
      for (var i = n; i >= 0; i--) out.push({ time: now - i * step, value: 0 });
      return out;
    }

    var chart = null, areaSeries = null;
    if (window.LightweightCharts) {
      chart = LightweightCharts.createChart(chartEl, {
        width: chartEl.clientWidth,
        height: chartEl.clientHeight,
        layout: { background: { color: '#0f1a1f' }, textColor: '#9aa3a4', fontSize: 11 },
        // original UI is English; lock the axis-date locale so non-English
        // browser locales (e.g. zh) don't render "10月 7日" ticks
        localization: { locale: 'en-US' },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        leftPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.06)' },
        rightPriceScale: { visible: false },
        timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: false, secondsVisible: false },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
          vertLine: { color: 'rgba(255,255,255,0.25)', labelBackground: '#273035' },
          horzLine: { color: 'rgba(255,255,255,0.25)', labelBackground: '#273035' },
        },
      });
      // original: white 2px line, no area fill, integer y-axis labels (0-3),
      // flat zero line pinned to the bottom of a fixed 0-3 range
      areaSeries = chart.addLineSeries({
        color: '#ffffff',
        lineWidth: 2,
        lineType: 1, // WithSteps (original renders a step line)
        priceFormat: { type: 'price', precision: 0, minMove: 1 },
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      areaSeries.applyOptions({
        autoscaleInfoProvider: function () { return { priceRange: { minValue: 0, maxValue: 3 } }; }
      });
      areaSeries.setData(seriesFor(state.window));
      chart.timeScale().fitContent();
      window.addEventListener('resize', function () {
        chart.applyOptions({ width: chartEl.clientWidth, height: chartEl.clientHeight });
      });
    }

    // summary rows — disconnected state shows zeros (as the original does);
    // labels with a tooltip are underlined (original style, not an info dot)
    function renderSummary() {
      var rows = [
        { label: 'PNL', value: '$0.00' },
        { label: 'Volume', value: '$0.00', info: true },
        { label: 'Max Drawdown', value: '0.00%' },
        { label: 'Total Equity', value: '$0.00' },
        { label: 'Trading Equity', value: '$0.00', info: true, accent: true },
        { label: 'Earn Balance', value: '$0.00' },
      ];
      document.getElementById('pfSummaryRows').innerHTML = rows.map(function (r) {
        return '<div class="pf-row"><span class="pf-row__label' + (r.info ? ' lnk' : '') + '"' +
          (r.info ? ' title="Hyperliquid docs"' : '') + '>' + r.label +
          '</span><span class="pf-row__value' + (r.accent ? ' green' : '') + '">' + r.value + '</span></div>';
      }).join('');
    }
    renderSummary();

    // fee toggle (perps: 0.0450% / 0.0150% as shown on the original)
    var FEES = { perps: '0.0450% / 0.0150%', spot: '0.0700% / 0.0300%' };
    initDropdown('pfFeeDd', function (item) {
      state.feeScope = item.dataset.scope;
      document.querySelectorAll('#pfFeeMenu .dd__item').forEach(function (it) {
        var on = it === item;
        it.classList.toggle('dd__item--active', on);
        it.querySelector('.dd__check').textContent = on ? '✓' : '';
      });
      document.getElementById('pfFeeLabel').textContent = state.feeScope === 'perps' ? 'Perps' : 'Spot';
      document.getElementById('pfFees').textContent = FEES[state.feeScope];
    });

    // portfolio type dropdown
    initDropdown('pfTypeDd', function (item) {
      state.ptype = item.dataset.type;
      document.querySelectorAll('#pfTypeMenu .dd__item').forEach(function (it) {
        var on = it === item;
        it.classList.toggle('dd__item--active', on);
        it.querySelector('.dd__check').textContent = on ? '✓' : '';
      });
      document.getElementById('pfTypeLabel').textContent = item.textContent.trim();
    });

    // time range dropdowns (summary + chart share window)
    function bindTimeDd(wrapId, labelId, onChange) {
      initDropdown(wrapId, function (item) {
        var w = item.dataset.window;
        document.querySelectorAll('#' + wrapId + ' .dd__item').forEach(function (it) {
          var on = it === item;
          it.classList.toggle('dd__item--active', on);
          it.querySelector('.dd__check').textContent = on ? '✓' : '';
        });
        document.getElementById(labelId).textContent = WINDOW_LABELS[w];
        onChange(w);
      });
    }
    bindTimeDd('pfSummaryDd', 'pfSummaryLabel', function (w) { state.window = w; });
    bindTimeDd('pfChartDd', 'pfChartLabel', function (w) {
      state.window = w;
      if (areaSeries) { areaSeries.setData(seriesFor(w)); chart.timeScale().fitContent(); }
    });

    // graph toggle
    document.querySelectorAll('#pfGraphTabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#pfGraphTabs button').forEach(function (b) { b.classList.remove('segmented--active'); });
        btn.classList.add('segmented--active');
        state.graph = btn.dataset.graph;
        if (areaSeries) { areaSeries.setData(seriesFor(state.window)); chart.timeScale().fitContent(); }
      });
    });

    // account table tabs
    var emptyTexts = {
      positions: 'No open positions yet',
      balances: 'No balances',
      outcomes: 'No outcomes',
      orders: 'No open orders',
      twap: 'No TWAP orders',
      chase: 'No chase orders',
      tradeHistory: 'No trade history',
      fundingHistory: 'No funding history',
      orderHistory: 'No order history',
      interest: 'No interest',
      deposits: 'No deposits or withdrawals'
    };
    document.querySelectorAll('[data-ptab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('[data-ptab]').forEach(function (t) { t.classList.remove('tab--active'); });
        tab.classList.add('tab--active');
        document.getElementById('pfTableEmpty').textContent = emptyTexts[tab.dataset.ptab] || 'No data';
      });
    });
  }

  /* ---------------- boot ---------------- */
  initVaults();
  initLeaderboard();
  initPortfolio();
})();
