/* ============================================================
   Hyperliquid trade page clone — runtime
   Chart: lightweight-charts (TradingView's OSS lib, the free
   equivalent of the charting_library_v28.5 the original uses)
   Market data: local simulation (the real site streams from
   wss://api.hyperliquid.xyz/ws — see README)
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- market catalog ---------------- */
  // keyed by base symbol; matches the ?symbol= the Markets rows navigate with
  var MARKETS = {
    HYPE:  { base: 'HYPE',  name: 'HYPE-USDC',  mark: 28.64,    decP: 3, decS: 2, bookTick: 0.001,      vol: 0.012 },
    BTC:   { base: 'BTC',   name: 'BTC-USDC',   mark: 98250,    decP: 1, decS: 4, bookTick: 1.0,        vol: 0.012 },
    ETH:   { base: 'ETH',   name: 'ETH-USDC',   mark: 3412.5,   decP: 2, decS: 3, bookTick: 0.1,        vol: 0.012 },
    SOL:   { base: 'SOL',   name: 'SOL-USDC',   mark: 214.8,    decP: 3, decS: 2, bookTick: 0.01,       vol: 0.012 },
    AVAX:  { base: 'AVAX',  name: 'AVAX-USDC',  mark: 41.7,     decP: 3, decS: 2, bookTick: 0.01,       vol: 0.012 },
    DOGE:  { base: 'DOGE',  name: 'DOGE-USDC',  mark: 0.3821,   decP: 5, decS: 0, bookTick: 0.0001,     vol: 0.012 },
    LINK:  { base: 'LINK',  name: 'LINK-USDC',  mark: 22.13,    decP: 3, decS: 2, bookTick: 0.001,      vol: 0.012 },
    ARB:   { base: 'ARB',   name: 'ARB-USDC',   mark: 1.084,    decP: 4, decS: 1, bookTick: 0.0001,     vol: 0.012 },
    SUI:   { base: 'SUI',   name: 'SUI-USDC',   mark: 4.62,     decP: 3, decS: 1, bookTick: 0.001,      vol: 0.012 },
    XRP:   { base: 'XRP',   name: 'XRP-USDC',   mark: 2.341,    decP: 4, decS: 1, bookTick: 0.0001,     vol: 0.012 },
    WIF:   { base: 'WIF',   name: 'WIF-USDC',   mark: 2.91,     decP: 3, decS: 1, bookTick: 0.001,      vol: 0.012 },
    PEPE:  { base: 'PEPE',  name: 'PEPE-USDC',  mark: 0.0000178,decP: 9, decS: 0, bookTick: 1e-9,       vol: 0.012 },
    PURR:  { base: 'PURR',  name: 'PURR-USDC',  mark: 0.421,    decP: 4, decS: 1, bookTick: 0.0001,     vol: 0.012 }
  };
  function resolveMarket() {
    var q = (location.search.match(/[?&]symbol=([^&]+)/) || [])[1];
    if (q) q = decodeURIComponent(q).toUpperCase().split('-')[0].split('/')[0];
    return MARKETS[q] || MARKETS.HYPE;
  }
  var market = resolveMarket();

  /* ---------------- market state ---------------- */
  var BASE_PRICE = market.mark;
  var price = BASE_PRICE;
  var candles = [];
  var CANDLE_COUNT = 120;
  var now = Math.floor(Date.now() / 1000);
  now -= (now % 3600); // align to hour

  // seed history: gentle random walk around the base price
  var p = BASE_PRICE * 0.985;
  var volAmp = BASE_PRICE * market.vol;
  for (var i = CANDLE_COUNT; i > 0; i--) {
    var t = now - i * 3600;
    var o = p;
    var drift = (Math.random() - 0.5) * volAmp;
    var h = Math.max(o, o + drift) + Math.random() * volAmp * 0.4;
    var l = Math.min(o, o + drift) - Math.random() * volAmp * 0.4;
    var c = o + drift + (Math.random() - 0.5) * volAmp * 0.3;
    var v = 40000 + Math.random() * 90000;
    candles.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
    p = c;
  }
  price = p;

  /* ---------------- chart ---------------- */
  var chartEl = document.getElementById('chart');
  var chart = null;
  var candleSeries = null;
  var volSeries = null;
  var priceLine = null;

  if (window.LightweightCharts) {
    chart = LightweightCharts.createChart(chartEl, {
      width: chartEl.clientWidth,
      height: chartEl.clientHeight,
      layout: {
        background: { color: '#0f1a1f' },
        textColor: '#9aa3a4',
        fontFamily: "Inter, 'SF Pro Display', -apple-system, 'Segoe UI', Roboto, sans-serif",
        fontSize: 11,
      },
      localization: { locale: 'en-US' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.25)', labelBackground: '#273035' },
        horzLine: { color: 'rgba(255,255,255,0.25)', labelBackground: '#273035' },
      },
      leftPriceScale: { visible: false },
      rightPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, secondsVisible: false },
    });

    candleSeries = chart.addCandlestickSeries({
      upColor: '#50d2c1',
      downColor: '#ed7088',
      borderUpColor: '#50d2c1',
      borderDownColor: '#ed7088',
      wickUpColor: '#50d2c1',
      wickDownColor: '#ed7088',
    });
    candleSeries.setData(candles);

    // real-time price line (right-axis label, mint-green when up / pink when down)
    priceLine = candleSeries.createPriceLine({
      price: price,
      color: price >= BASE_PRICE ? '#50d2c1' : '#ed7088',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: '',
    });

    volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      color: 'rgba(80,210,193,0.35)',
      scaleMargins: { top: 0.85, bottom: 0 },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({ visible: false });
    volSeries.setData(candles.map(function (c) {
      return {
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(80,210,193,0.35)' : 'rgba(237,112,136,0.35)',
      };
    }));

    chart.timeScale().fitContent();

    // crosshair OHLC legend
    chart.subscribeCrosshairMove(function (param) {
      var d = param && param.seriesData && param.seriesData.get(candleSeries);
      var ohlc = document.getElementById('chartOhlc');
      var chg = document.getElementById('chartChange');
      if (!d) return;
      var diff = d.close - d.open;
      var pct = (diff / d.open) * 100;
      ohlc.textContent = 'O ' + d.open.toFixed(market.decP) + ' H ' + d.high.toFixed(market.decP) +
        ' L ' + d.low.toFixed(market.decP) + ' C ' + d.close.toFixed(market.decP);
      chg.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(Math.min(market.decP, 5)) + ' (' + (diff >= 0 ? '+' : '') + pct.toFixed(2) + '%)';
      chg.className = diff >= 0 ? 'up' : 'down';
    });

    window.addEventListener('resize', function () {
      chart.applyOptions({ width: chartEl.clientWidth, height: chartEl.clientHeight });
    });
  }

  /* ---------------- live tick ---------------- */
  function fmt(n, d) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  function tick() {
    if (isLive()) {
      // price is driven by HLClient WS; only mirror it into the candle
      price = (window.HLClient && window.HLClient.markPrice) || price;
    } else {
      // random-walk the price (scaled to the active market's magnitude)
      price += (Math.random() - 0.5) * BASE_PRICE * 0.0008;
    }
    var last = candles[candles.length - 1];
    last.close = price;
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    if (!isLive()) last.volume += Math.random() * 400;

    if (candleSeries) candleSeries.update(last);
    if (volSeries) {
      volSeries.update({
        time: last.time,
        value: last.volume,
        color: last.close >= last.open ? 'rgba(80,210,193,0.35)' : 'rgba(237,112,136,0.35)',
      });
    }
    if (priceLine) {
      priceLine.applyOptions({
        price: price,
        color: price >= BASE_PRICE ? '#50d2c1' : '#ed7088',
      });
    }

    // keep the overlay legend in sync while not hovering the chart
    var ohlcEl = document.getElementById('chartOhlc');
    var chgEl = document.getElementById('chartChange');
    if (ohlcEl && chgEl) {
      var ldiff = last.close - last.open;
      var lpct = (ldiff / last.open) * 100;
      ohlcEl.textContent = 'O ' + last.open.toFixed(market.decP) + ' H ' + last.high.toFixed(market.decP) +
        ' L ' + last.low.toFixed(market.decP) + ' C ' + last.close.toFixed(market.decP);
      chgEl.textContent = (ldiff >= 0 ? '+' : '') + ldiff.toFixed(Math.min(market.decP, 5)) + ' (' + (ldiff >= 0 ? '+' : '') + lpct.toFixed(2) + '%)';
      chgEl.className = ldiff >= 0 ? 'up' : 'down';
    }

    // market bar
    var change = price - BASE_PRICE;
    var pct = (change / BASE_PRICE) * 100;
    document.getElementById('markPrice').textContent = fmt(price, market.decP);
    document.getElementById('oraclePrice').textContent = fmt(price + market.bookTick * 24, market.decP);
    var ch = document.getElementById('change24h');
    ch.textContent = change.toFixed(market.decP) + ' / ' + pct.toFixed(2) + '%';
    ch.className = change >= 0 ? 'up' : 'down';

    if (!isLive()) processTrading();
    if (account.positions.length && bottomTab === 'positions') renderBottom();
    renderBook();
  }

  /* ---------------- order book ---------------- */
  var bookAsksEl = document.getElementById('bookAsks');
  var bookBidsEl = document.getElementById('bookBids');
  var ROWS = 11;

  function bookRow(side, px, sz) {
    var tot = px * sz;
    var depthPct = Math.min(100, (sz / 12) * 100);
    return '<div class="book__row book__row--' + side + '">' +
      '<span class="depth" style="width:' + depthPct + '%"></span>' +
      '<span class="px">' + fmt(px, market.decP) + '</span>' +
      '<span class="sz">' + fmt(sz, market.decS) + '</span>' +
      '<span class="tot">' + fmt(tot, market.decS) + '</span>' +
      '</div>';
  }

  function renderBook() {
    if (isLive() && window.HLClient) {
      var b = window.HLClient.book;
      var aN = Math.min(ROWS, b.asks.length);
      var htmlA = '';
      for (var ai = aN - 1; ai >= 0; ai--) {
        var a = b.asks[ai];
        htmlA += bookRow('ask', a[0], a[1]);
      }
      bookAsksEl.innerHTML = htmlA;
      var htmlB = '';
      var bN = Math.min(ROWS, b.bids.length);
      for (var bi = 0; bi < bN; bi++) {
        var bd = b.bids[bi];
        htmlB += bookRow('bid', bd[0], bd[1]);
      }
      bookBidsEl.innerHTML = htmlB;
      if (b.asks[0] && b.bids[0]) {
        var mid = (b.asks[0][0] + b.bids[0][0]) / 2;
        var spread = b.asks[0][0] - b.bids[0][0];
        document.getElementById('spreadPrice').textContent = fmt(mid, market.decP);
        document.getElementById('spreadVal').textContent = spread.toFixed(market.decP);
      }
      return;
    }
    var html = '';
    var sz;
    // asks: red, ascending price downward to spread
    for (var i = ROWS - 1; i >= 0; i--) {
      var px = price + market.bookTick * (i + 1);
      sz = 0.5 + Math.random() * 8;
      html += bookRow('ask', px, sz);
    }
    bookAsksEl.innerHTML = html;

    html = '';
    for (var j = 0; j < ROWS; j++) {
      var bpx = price - market.bookTick * (j + 1);
      sz = 0.5 + Math.random() * 8;
      html += bookRow('bid', bpx, sz);
    }
    bookBidsEl.innerHTML = html;

    document.getElementById('spreadPrice').textContent = fmt(price, market.decP);
    document.getElementById('spreadVal').textContent = fmt(market.bookTick, market.decP);
  }

  /* ============================================================
     Trading engine — order flow simulation
     Mechanics mirrored from the original site: cross margin,
     leverage (10x), market orders fill instantly, limit orders
     rest and fill on cross, positions carry live PNL / ROE% /
     liquidation price, TP/SL triggers, reduce-only.
     ============================================================ */
  var LEVERAGE = 10;
  var MMR = 0.005; // maintenance margin rate
  var account = {
    connected: false,
    balance: 0,
    positions: [],   // {side, size, entry, margin, liq, tp, sl}
    orders: [],      // {side, price, size, reduceOnly, tp, sl, time}
    history: []      // {side, price, size, type, pnl, time}
  };
  var form = { otype: 'market', side: 'buy' };

  /* ---------------- live backend switch ---------------- */
  // 'sim'  -> local in-memory simulation (default, no network)
  // 'live' -> Hyperliquid testnet via js/hl-client.js (window.HLClient)
  var BACKEND = 'sim';
  function isLive() { return BACKEND === 'live'; }

  // mirror on-chain clearinghouseState into the `account` object the UI renders
  function syncLiveState() {
    if (!window.HLClient) return;
    window.HLClient.syncState().then(function (st) {
      if (!st) return;
      account.connected = true;
      account.balance = st.balance;
      account.positions = st.positions;
      account.orders = st.orders;
      refreshForm();
      renderBottom();
    }).catch(function (e) { flash('State sync failed: ' + (e && e.message ? e.message : e)); });
  }

  function notional(px, sz) { return px * sz; }
  function marginFor(px, sz) { return notional(px, sz) / LEVERAGE; }
  function liqPriceFor(side, entry, lev) {
    return side === 'long'
      ? entry * (1 - 1 / lev + MMR)
      : entry * (1 + 1 / lev - MMR);
  }
  function positionPnl(pos, mark) {
    return pos.side === 'long' ? (mark - pos.entry) * pos.size : (pos.entry - mark) * pos.size;
  }
  function fmtSize(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 4 }); }

  function orderPrice() {
    if (form.otype === 'limit') {
      var v = parseFloat(document.getElementById('priceInput').value);
      return isFinite(v) && v > 0 ? v : price;
    }
    return price;
  }
  function currentSize() {
    var v = parseFloat(document.getElementById('sizeInput').value);
    return isFinite(v) && v > 0 ? v : 0;
  }
  function maxSize() {
    return account.connected ? (account.balance * LEVERAGE / price) : 0;
  }
  function netPosition() {
    return account.positions.reduce(function (s, p) { return s + (p.side === 'long' ? p.size : -p.size); }, 0);
  }

  function refreshForm() {
    var sz = currentSize();
    var px = orderPrice();
    var ov = notional(px, sz);
    document.getElementById('orderValue').textContent = sz > 0 ? fmt(ov, 2) : 'N/A';
    document.getElementById('availVal').textContent = fmt(account.balance, 2) + ' USDC';
    document.getElementById('curPosVal').textContent = fmtSize(netPosition()) + ' ' + market.base;

    var pos = account.positions[0];
    var liqEl = document.getElementById('liqPrice');
    if (sz > 0 && account.connected) {
      var side = form.side === 'buy' ? 'long' : 'short';
      var entry = px;
      if (pos && pos.side === side) {
        entry = (pos.entry * pos.size + px * sz) / (pos.size + sz);
      }
      liqEl.textContent = fmt(liqPriceFor(side, entry, LEVERAGE), 3);
    } else if (pos) {
      liqEl.textContent = fmt(pos.liq, 3);
    } else {
      liqEl.textContent = '—';
    }

    var acctVal = account.balance + account.positions.reduce(function (s, p) { return s + p.margin + positionPnl(p, price); }, 0);
    document.getElementById('acctValue').textContent = fmt(acctVal, 2);
    document.getElementById('freeCollateral').textContent = fmt(account.balance, 2);
    document.getElementById('acctRatio').textContent = acctVal > 0 ? ((account.balance / acctVal) * 100).toFixed(0) + '%' : '0';
  }

  function flash(msg) {
    var el = document.getElementById('formToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'formToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:60px;transform:translateX(-50%);background:#273035;color:#f6fefd;padding:8px 16px;border-radius:8px;font-size:12.5px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,.5);transition:opacity .2s;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = '0'; }, 1800);
  }

  function connectAccount() {
    account.connected = true;
    account.balance = 10000; // demo funds
    var btn = document.getElementById('formConnectBtn');
    btn.textContent = form.side === 'buy' ? 'Buy / Long' : 'Sell / Short';
    btn.classList.add('form__connect--live');
    flash('Connected — demo account funded with 10,000 USDC');
    refreshForm();
  }

  function openOrAddPosition(side, px, sz, margin, tp, sl) {
    var pos = null;
    for (var i = 0; i < account.positions.length; i++) {
      if (account.positions[i].side === side) { pos = account.positions[i]; break; }
    }
    if (pos) {
      var newSize = pos.size + sz;
      pos.entry = (pos.entry * pos.size + px * sz) / newSize;
      pos.size = newSize;
      pos.margin += margin;
    } else {
      pos = { side: side, size: sz, entry: px, margin: margin, tp: tp, sl: sl };
      account.positions.push(pos);
    }
    pos.liq = liqPriceFor(side, pos.entry, LEVERAGE);
    return pos;
  }

  function closePosition(pos, mark, reason) {
    var pnl = positionPnl(pos, mark);
    account.balance += pos.margin + pnl;
    account.history.unshift({
      side: pos.side, price: mark, size: pos.size, type: reason || 'Close',
      pnl: pnl, time: Date.now()
    });
    account.positions.splice(account.positions.indexOf(pos), 1);
    refreshForm(); renderBottom();
  }

  function placeOrder() {
    if (isLive()) {
      if (!window.HLClient || !window.HLClient.address) { flash('Connect wallet first'); return; }
      var sz = currentSize();
      if (sz <= 0) { flash('Enter a size'); return; }
      var side = form.side === 'buy' ? 'buy' : 'sell';
      var otype = form.otype; // 'market' | 'limit'
      var priceVal = otype === 'limit' ? parseFloat(document.getElementById('priceInput').value) : null;
      var reduceOnly = document.getElementById('reduceOnly').checked;
      var tp = null, sl = null;
      if (document.getElementById('tpslToggle').checked && !reduceOnly) {
        var tpv = parseFloat(document.getElementById('tpPrice').value);
        var slv = parseFloat(document.getElementById('slPrice').value);
        if (isFinite(tpv) && tpv > 0) tp = tpv;
        if (isFinite(slv) && slv > 0) sl = slv;
      }
      window.HLClient.placeOrder({ side: side, size: sz, type: otype, price: priceVal, reduceOnly: reduceOnly, tp: tp, sl: sl })
        .then(function () {
          var extra = (tp || sl) ? ' + TP/SL' : '';
          flash('Order broadcast (' + otype + ')' + extra);
          document.getElementById('sizeInput').value = '';
          document.getElementById('pctSlider').value = 0;
          document.getElementById('pctVal').textContent = '0%';
          setTimeout(function () { if (window.HLClient) window.HLClient.syncState(); }, 800);
        })
        .catch(function (e) { flash('Order failed: ' + (e && e.message ? e.message : e)); });
      return;
    }
    if (!account.connected) { connectAccount(); return; }
    var sz = currentSize();
    if (sz <= 0) { flash('Enter a size'); return; }
    var px = orderPrice();
    var side = form.side === 'buy' ? 'long' : 'short';
    var reduceOnly = document.getElementById('reduceOnly').checked;

    if (reduceOnly) {
      var opp = null;
      for (var i = 0; i < account.positions.length; i++) {
        if (account.positions[i].side !== side) { opp = account.positions[i]; break; }
      }
      if (!opp) { flash('No position to reduce'); return; }
      sz = Math.min(sz, opp.size);
    }

    var margin = marginFor(px, sz);
    if (!reduceOnly && margin > account.balance + 1e-9) { flash('Insufficient balance'); return; }

    var tp = null, sl = null;
    if (document.getElementById('tpslToggle').checked) {
      var tpv = parseFloat(document.getElementById('tpPrice').value);
      var slv = parseFloat(document.getElementById('slPrice').value);
      if (isFinite(tpv) && tpv > 0) tp = tpv;
      if (isFinite(slv) && slv > 0) sl = slv;
    }

    if (form.otype === 'market') {
      if (reduceOnly) {
        var opp2 = null;
        for (var j = 0; j < account.positions.length; j++) {
          if (account.positions[j].side !== side) { opp2 = account.positions[j]; break; }
        }
        var closing = Math.min(sz, opp2.size);
        var slice = { side: opp2.side, size: closing, entry: opp2.entry, margin: opp2.margin * (closing / opp2.size), liq: opp2.liq };
        closePosition(slice, px, 'Market (Reduce Only)');
        flash('Reduce-only order filled');
      } else {
        account.balance -= margin;
        openOrAddPosition(side, px, sz, margin, tp, sl);
        account.history.unshift({ side: side, price: px, size: sz, type: 'Market', pnl: 0, time: Date.now() });
        flash('Market order filled @ ' + fmt(px, 3));
      }
    } else {
      account.orders.unshift({ side: side, price: px, size: sz, reduceOnly: reduceOnly, tp: tp, sl: sl, time: Date.now() });
      flash('Limit order placed @ ' + fmt(px, 3));
    }

    document.getElementById('sizeInput').value = '';
    document.getElementById('pctSlider').value = 0;
    document.getElementById('pctVal').textContent = '0%';
    refreshForm(); renderBottom();
  }

  // per-tick: fill resting limit orders on cross, trigger TP/SL/liquidation
  function processTrading() {
    var i;
    for (i = account.orders.length - 1; i >= 0; i--) {
      var o = account.orders[i];
      var filled = o.side === 'long' ? price <= o.price : price >= o.price;
      if (filled) {
        var margin = marginFor(o.price, o.size);
        if (o.reduceOnly) {
          var opp = null;
          for (var k = 0; k < account.positions.length; k++) {
            if (account.positions[k].side !== o.side) { opp = account.positions[k]; break; }
          }
          if (opp) {
            var closing = Math.min(o.size, opp.size);
            closePosition({ side: opp.side, size: closing, entry: opp.entry, margin: opp.margin * (closing / opp.size), liq: opp.liq }, o.price, 'Limit (Reduce Only)');
          }
        } else if (margin <= account.balance + 1e-9) {
          account.balance -= margin;
          openOrAddPosition(o.side, o.price, o.size, margin, o.tp, o.sl);
          account.history.unshift({ side: o.side, price: o.price, size: o.size, type: 'Limit', pnl: 0, time: Date.now() });
        }
        account.orders.splice(i, 1);
        refreshForm(); renderBottom();
      }
    }
    for (i = account.positions.length - 1; i >= 0; i--) {
      var p = account.positions[i];
      if (p.tp && (p.side === 'long' ? price >= p.tp : price <= p.tp)) { closePosition(p, p.tp, 'Take Profit'); continue; }
      if (p.sl && (p.side === 'long' ? price <= p.sl : price >= p.sl)) { closePosition(p, p.sl, 'Stop Loss'); continue; }
      if (p.side === 'long' ? price <= p.liq : price >= p.liq) { closePosition(p, p.liq, 'Liquidation'); continue; }
    }
  }

  /* ---------------- bottom panel rendering ---------------- */
  var bottomTab = 'positions';
  var EMPTY_TEXTS = {
    positions: 'No open positions yet',
    balances: 'No balances',
    outcomes: 'No outcomes',
    orders: 'No open orders',
    twap: 'No TWAP orders',
    chase: 'No chase orders',
    trades: 'No trade history',
    funding: 'No funding history',
    orderhistory: 'No order history',
    side: 'No data'
  };

  function renderBottom() {
    var empty = document.getElementById('bottomEmpty');
    var table = document.getElementById('bottomTable');
    var cols = document.getElementById('bottomCols');
    var html = '';
    if (bottomTab === 'positions') {
      cols.style.display = '';
      account.positions.forEach(function (p) {
        var pnl = positionPnl(p, price);
        var roe = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
        html += '<div class="bottom__datarow">' +
          '<span class="mkt"><span class="mkt__icon">◆</span>' + market.base + '</span>' +
          '<span>' + (p.side === 'long' ? '' : '-') + fmtSize(p.size) + '</span>' +
          '<span>' + fmt(p.size * price, 2) + '</span>' +
          '<span>' + fmt(p.entry, 3) + '</span>' +
          '<span>' + fmt(price, 3) + '</span>' +
          '<span class="' + (pnl >= 0 ? 'green' : 'pink') + '">' + (pnl >= 0 ? '+' : '') + fmt(pnl, 2) + ' (' + (roe >= 0 ? '+' : '') + roe.toFixed(2) + '%)</span>' +
          '<span>' + fmt(p.liq, 3) + '</span>' +
          '<span>' + fmt(p.margin, 2) + ' <button class="bottom__close" data-close="' + p.side + '" data-size="' + p.size + '">Close</button></span>' +
          '</div>';
      });
    } else if (bottomTab === 'orders') {
      cols.style.display = 'none';
      account.orders.forEach(function (o, idx) {
        var oidAttr = o.oid != null ? ' data-oid="' + o.oid + '"' : '';
        html += '<div class="bottom__datarow">' +
          '<span class="mkt"><span class="mkt__icon">◆</span>' + market.base + '</span>' +
          '<span>' + (o.side === 'long' ? 'Buy' : 'Sell') + '</span>' +
          '<span>' + fmt(o.price, 3) + '</span>' +
          '<span>' + fmtSize(o.size) + '</span>' +
          '<span>' + fmt(o.price * o.size, 2) + '</span>' +
          '<span class="muted">Limit</span>' +
          '<span><button class="bottom__close" data-cancel="' + idx + '"' + oidAttr + '>Cancel</button></span>' +
          '<span></span><span></span>' +
          '</div>';
      });
    } else if (bottomTab === 'trades') {
      cols.style.display = 'none';
      account.history.forEach(function (h) {
        html += '<div class="bottom__datarow">' +
          '<span class="mkt"><span class="mkt__icon">◆</span>' + market.base + '</span>' +
          '<span>' + (h.side === 'long' ? 'Buy' : 'Sell') + '</span>' +
          '<span>' + fmt(h.price, 3) + '</span>' +
          '<span>' + fmtSize(h.size) + '</span>' +
          '<span>' + fmt(h.price * h.size, 2) + '</span>' +
          '<span class="' + (h.pnl >= 0 ? 'green' : 'pink') + '">' + (h.pnl >= 0 ? '+' : '') + fmt(h.pnl, 2) + '</span>' +
          '<span class="muted">' + h.type + '</span><span></span>' +
          '</div>';
      });
    } else if (bottomTab === 'balances') {
      cols.style.display = 'none';
      html += '<div class="bottom__datarow">' +
        '<span class="mkt"><span class="mkt__icon">$</span>USDC</span>' +
        '<span>' + fmt(account.balance, 2) + '</span><span></span><span></span><span></span><span></span><span></span><span></span></div>';
    } else {
      cols.style.display = 'none';
    }
    table.innerHTML = html;
    var isEmpty = !html;
    empty.style.display = isEmpty ? '' : 'none';
    empty.textContent = EMPTY_TEXTS[bottomTab] || 'No data';
  }

  document.getElementById('bottomTabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#bottomTabs .tab').forEach(function (t) { t.classList.remove('tab--active'); });
    tab.classList.add('tab--active');
    bottomTab = tab.dataset.btab;
    renderBottom();
  });
  document.getElementById('bottomTable').addEventListener('click', function (e) {
    var closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      if (isLive() && window.HLClient) {
        var lside = closeBtn.dataset.close;
        var lsz = parseFloat(closeBtn.dataset.size);
        window.HLClient.placeOrder({ side: lside === 'long' ? 'sell' : 'buy', size: lsz, type: 'market', reduceOnly: true })
          .then(function () { flash('Closing position...'); setTimeout(function () { if (window.HLClient) window.HLClient.syncState(); }, 800); })
          .catch(function (er) { flash('Close failed: ' + (er && er.message ? er.message : er)); });
        return;
      }
      var side = closeBtn.dataset.close;
      for (var i = 0; i < account.positions.length; i++) {
        if (account.positions[i].side === side) { closePosition(account.positions[i], price, 'Manual Close'); break; }
      }
      return;
    }
    var cancelBtn = e.target.closest('[data-cancel]');
    if (cancelBtn) {
      if (isLive() && window.HLClient) {
        window.HLClient.cancelOrder(parseInt(cancelBtn.dataset.oid, 10))
          .then(function () { flash('Order cancelled'); setTimeout(function () { if (window.HLClient) window.HLClient.syncState(); }, 500); })
          .catch(function (er) { flash('Cancel failed: ' + (er && er.message ? er.message : er)); });
        return;
      }
      account.orders.splice(parseInt(cancelBtn.dataset.cancel, 10), 1);
      flash('Order cancelled');
      renderBottom();
    }
  });

  /* ---------------- order form bindings ---------------- */
  var buyBtn = document.querySelector('.side--buy');
  var sellBtn = document.querySelector('.side--sell');
  function setSide(side) {
    form.side = side;
    buyBtn.classList.toggle('side--active', side === 'buy');
    sellBtn.classList.toggle('side--active', side === 'sell');
    var btn = document.getElementById('formConnectBtn');
    if (account.connected) btn.textContent = side === 'buy' ? 'Buy / Long' : 'Sell / Short';
  }
  buyBtn.addEventListener('click', function () { setSide('buy'); });
  sellBtn.addEventListener('click', function () { setSide('sell'); });

  var slider = document.getElementById('pctSlider');
  var pctVal = document.getElementById('pctVal');
  function applySlider() {
    pctVal.textContent = slider.value + '%';
    if (account.connected && slider.value > 0) {
      document.getElementById('sizeInput').value = (maxSize() * slider.value / 100).toFixed(4);
    }
    refreshForm();
  }
  slider.addEventListener('input', applySlider);
  document.getElementById('sizeInput').addEventListener('input', function () {
    var sz = currentSize();
    var pct = maxSize() > 0 ? Math.min(100, (sz / maxSize()) * 100) : 0;
    slider.value = pct;
    pctVal.textContent = Math.round(pct) + '%';
    refreshForm();
  });
  document.getElementById('priceInput').addEventListener('input', refreshForm);

  // order-type tabs: Market hides the price field, Limit shows it
  var formTabs = document.querySelectorAll('.form__tabs .tab');
  formTabs.forEach(function (t) {
    t.addEventListener('click', function () {
      formTabs.forEach(function (x) { x.classList.remove('tab--active'); });
      t.classList.add('tab--active');
      form.otype = t.dataset.otype;
      document.getElementById('priceField').style.display = form.otype === 'limit' ? '' : 'none';
      if (form.otype === 'limit') {
        var pi = document.getElementById('priceInput');
        if (!pi.value) pi.value = price.toFixed(3);
      }
      refreshForm();
    });
  });

  // TP/SL checkbox toggles the fields
  document.getElementById('tpslToggle').addEventListener('change', function (e) {
    document.getElementById('tpslFields').style.display = e.target.checked ? '' : 'none';
  });

  // Connect / place order — in live mode the form button connects the wallet if needed
  document.getElementById('formConnectBtn').addEventListener('click', function () {
    if (isLive() && (!window.HLClient || !window.HLClient.address)) {
      if (window.HLClient) {
        window.HLClient.connectWallet().then(function (addr) { if (addr) syncLiveState(); });
      } else {
        flash('HLClient not loaded');
      }
      return;
    }
    placeOrder();
  });

  // order book click → fills limit price and switches to Limit tab
  [bookAsksEl, bookBidsEl].forEach(function (el) {
    el.addEventListener('click', function (e) {
      var row = e.target.closest('.book__row');
      if (!row) return;
      var px = row.querySelector('.px');
      if (!px) return;
      var limitTab = document.querySelector('.form__tabs .tab[data-otype="limit"]');
      if (limitTab) limitTab.click();
      document.getElementById('priceInput').value = px.textContent;
      refreshForm();
    });
  });

  refreshForm();
  renderBottom();

  /* ---------------- announcements ---------------- */
  // ticker: rotate one message at a time (the live site shows one banner line)
  var tickerItems = [
    'New order type: Trailing stop',
    'Available for perp markets only',
    'Manual borrowing now available',
    'Use HYPE and BTC as collateral to borrow USDC and USDT',
    'New listing: USELESS-USDC perps',
  ];
  var track = document.getElementById('announceTrack');
  var tickerIdx = 0;
  function renderTicker() {
    track.innerHTML = '<span class="announcements__item">' + tickerItems[tickerIdx] + '</span>';
  }
  renderTicker();
  setInterval(function () {
    tickerIdx = (tickerIdx + 1) % tickerItems.length;
    renderTicker();
  }, 4000);

  // the announce card lists all items at once (the original popup does not rotate)
  document.getElementById('announceClose').addEventListener('click', function () {
    document.getElementById('announceCard').style.display = 'none';
  });

  // open the ticker after 2s so the clone mirrors the live banner
  var ticker = document.getElementById('announcements');
  setTimeout(function () { ticker.classList.add('announcements--open'); }, 2000);

  /* ---------------- topnav connect (also connects the demo account) ---------------- */
  document.getElementById('connectBtn').addEventListener('click', function () {
    if (!account.connected) { connectAccount(); this.textContent = '0x1234…abcd'; }
  });

  /* ---------------- live backend: mode toggle + wallet ---------------- */
  if (window.HLClient) {
    HLClient.onError = function (m) { flash(m); };
    HLClient.onState = function () { /* syncState already updates the UI */ };
    HLClient.onEnvChange = function (env) {
      if (env === 'mainnet') {
        flash('⚠ MAINNET — real funds at risk. Connect a wallet to trade for real.');
      } else if (env === 'testnet') {
        flash('Testnet mode — connect a wallet (testnet funds, no real value)');
      }
    };
  }
  var envBtns = document.querySelectorAll('.env-toggle [data-mode]');
  envBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.dataset.mode;
      envBtns.forEach(function (b) { b.classList.toggle('env-toggle__btn--active', b === btn); });
      if (mode === 'sim') {
        BACKEND = 'sim';
        if (window.HLClient) window.HLClient.disconnectWs();
        flash('Demo mode (local simulation)');
      } else {
        BACKEND = 'live';
        if (window.HLClient) {
          window.HLClient.setEnv(mode); // 'testnet' | 'mainnet'
          window.HLClient.connectWs();
          if (window.HLClient.address) syncLiveState();
        }
      }
    });
  });
  var walletBtn = document.getElementById('walletBtn');
  if (walletBtn) {
    walletBtn.addEventListener('click', function () {
      if (!window.HLClient) { flash('HLClient not loaded'); return; }
      if (window.HLClient.address) {
        window.HLClient.disconnectWallet();
        account.connected = false;
        this.textContent = 'Connect Wallet';
        if (window.HLClient) window.HLClient.disconnectWs();
        flash('Wallet disconnected');
        return;
      }
      window.HLClient.connectWallet().then(function (addr) {
        if (!addr) return;
        this.textContent = addr.slice(0, 6) + '…' + addr.slice(-4);
        account.connected = true;
        if (BACKEND === 'live') { window.HLClient.connectWs(); syncLiveState(); }
      }.bind(this));
    });
  }

  /* ---------------- apply active market to static markup ---------------- */
  function applyMarketDOM() {
    var b = market.base;
    var nb = document.querySelector('.marketbar__name');
    if (nb) nb.textContent = market.name;
    var cl = document.querySelector('.chart-legend__title');
    if (cl) cl.textContent = b + 'USD · 1h · Hyperliquid';
    var bh = document.querySelector('.book__head');
    if (bh) {
      var spans = bh.querySelectorAll('span');
      if (spans[1]) spans[1].textContent = 'Size (' + b + ')';
      if (spans[2]) spans[2].textContent = 'Total (' + b + ')';
    }
    var coin = document.querySelector('.panel--book .coin');
    if (coin) coin.textContent = b;
    var bu = document.getElementById('bookUnit');
    if (bu) bu.textContent = String(market.bookTick);
    var si = document.getElementById('sizeInput');
    if (si && si.parentNode) {
      var em = si.parentNode.querySelector('em');
      if (em) em.innerHTML = b + ' <span style="font-size:9px">⌄</span>';
    }
    document.title = market.mark.toLocaleString('en-US') + ' | ' + b + ' | Hyperliquid';
  }

  /* ---------------- boot ---------------- */
  applyMarketDOM();
  renderBook();
  setInterval(tick, 1000);
})();
