/* ============================================================
   Hyperliquid live client — real-connection scaffold
   ------------------------------------------------------------
   Default environment: TESTNET (no real funds at risk).
   Flip HLClient.env to 'mainnet' to target production.

   What this module does (and does NOT do):
   - Connect an injected EVM wallet (MetaMask / Rabby / etc.) via ethers.
   - Read market data through the public InfoService (REST + WS).
   - Sign & broadcast orders with the Hyperliquid EIP-712 scheme.
   - Mirror on-chain clearinghouse state back into the UI.

   It deliberately does NOT (yet):
   - Touch private keys or any secret. Signing happens in the wallet.
   - Implement TWAP / Chase on-chain — those remain TODO hooks.
     TP/SL is implemented (see placeOrder -> _tpslOrder).

   Network reachability note: the official endpoints are
   api.hyperliquid.xyz / api.hyperliquid-testnet.xyz. The page must
   be served from a context the browser can reach them from (the
   dev clone works out-of-the-box in "Demo" mode without any of this).
   ============================================================ */
(function () {
  'use strict';

  var HLClient = {
    env: 'testnet', // 'testnet' | 'mainnet'

    endpoints: function () {
      var testnet = {
        info: 'https://api.hyperliquid-testnet.xyz/info',
        exchange: 'https://api.hyperliquid-testnet.xyz/exchange',
        ws: 'wss://api.hyperliquid-testnet.xyz/ws',
        chainId: 421614, // Arbitrum Sepolia
      };
      var mainnet = {
        info: 'https://api.hyperliquid.xyz/info',
        exchange: 'https://api.hyperliquid.xyz/exchange',
        ws: 'wss://api.hyperliquid.xyz/ws',
        chainId: 42161, // Arbitrum One
      };
      return this.env === 'mainnet' ? mainnet : testnet;
    },

    coin: 'HYPE',          // coin to trade on this clone page
    maxSlippageBps: 50,    // 0.5% — used to cap market-order price

    /* ---- runtime state (read by app.js each tick) ---- */
    wallet: null,          // ethers Signer
    address: null,         // 0x...
    markPrice: null,       // number, latest mid/mark
    book: { asks: [], bids: [] },

    /* ---- callbacks set by app.js ---- */
    onWallet: null,        // (address|null) => void
    onBook: null,          // () => void
    onPrice: null,         // () => void
    onState: null,         // () => void
    onError: null,         // (msg) => void
    onEnvChange: null,     // (env) => void

    ws: null,
    _metaCache: null,

    /** switch environment (testnet|mainnet): clears caches + live state, reconnects WS */
    setEnv: function (env) {
      this.env = env;
      this._metaCache = null;
      this.markPrice = null;
      this.book = { asks: [], bids: [] };
      this.disconnectWs();
      if (this.onEnvChange) this.onEnvChange(env);
    },

    _err: function (m) { if (this.onError) this.onError(m); },

    /* ============================================================
       Wallet connection (injected provider)
       ============================================================ */
    async connectWallet() {
      if (typeof window.ethereum === 'undefined') {
        this._err('No injected wallet found (install MetaMask / Rabby).');
        return null;
      }
      if (typeof window.ethers === 'undefined') {
        this._err('ethers not loaded — check the CDN <script> in index.html.');
        return null;
      }
      try {
        const provider = new window.ethers.BrowserProvider(window.ethereum);
        // request accounts (prompts the wallet)
        await provider.send('eth_requestAccounts', []);
        const signer = await provider.getSigner();
        const addr = await signer.getAddress();
        this.wallet = signer;
        this.address = addr;
        if (this.onWallet) this.onWallet(addr);
        return addr;
      } catch (e) {
        this._err('Wallet connection failed: ' + (e && e.message ? e.message : e));
        return null;
      }
    },

    disconnectWallet() {
      this.wallet = null;
      this.address = null;
      if (this.onWallet) this.onWallet(null);
    },

    /* ============================================================
       InfoService (read)
       ============================================================ */
    async info(payload) {
      const ep = this.endpoints().info;
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Info API ' + res.status);
      return res.json();
    },

    async getMeta() {
      if (this._metaCache) return this._metaCache;
      const m = await this.info({ type: 'meta' });
      this._metaCache = m;
      return m;
    },

    /** resolve the numeric asset id for this.coin (e.g. HYPE -> 2).
        On mainnet meta items expose `indices.perp`; the testnet meta does not,
        so fall back to the index in the universe array (which is the same number). */
    async getAssetId() {
      const meta = await this.getMeta();
      const idx = meta.universe.findIndex((x) => x.name === this.coin);
      if (idx < 0) throw new Error('Coin ' + this.coin + ' not found in meta');
      const u = meta.universe[idx];
      return (u.indices && u.indices.perp != null) ? u.indices.perp : idx;
    },

    async getAllMids() {
      return this.info({ type: 'allMids' });
    },

    async refreshPrice() {
      const mids = await this.getAllMids();
      const p = parseFloat(mids[this.coin]);
      if (isFinite(p)) {
        this.markPrice = p;
        if (this.onPrice) this.onPrice();
      }
      return this.markPrice;
    },

    /** clearinghouse state -> positions/orders/balance (on-chain mirror) */
    async getClearinghouseState(user) {
      return this.info({ type: 'clearinghouseState', user: user || this.address });
    },

    /** open orders for the connected user */
    async getOpenOrders(user) {
      return this.info({ type: 'frontendOpenOrders', user: user || this.address });
    },

    /* ============================================================
       WebSocket subscription (book + mids)
       ============================================================ */
    connectWs() {
      if (this.ws) return;
      const self = this;
      const ws = new WebSocket(this.endpoints().ws);
      this.ws = ws;

      ws.onopen = function () {
        ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'l2Book', coin: self.coin } }));
        ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
      };
      ws.onmessage = function (ev) {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (!msg.channel) return;
        if (msg.channel === 'l2Book') {
          const data = msg.data;
          const asks = (data.levels[0] || []).map((l) => [parseFloat(l.px), parseFloat(l.sz)]);
          const bids = (data.levels[1] || []).map((l) => [parseFloat(l.px), parseFloat(l.sz)]);
          self.book = { asks: asks, bids: bids };
          // fallback mid if allMids hasn't populated markPrice yet
          if (!isFinite(self.markPrice)) {
            const topA = asks[0], topB = bids[0];
            if (topA && topB) self.markPrice = (topA[0] + topB[0]) / 2;
            else if (topA) self.markPrice = topA[0];
            else if (topB) self.markPrice = topB[0];
          }
          if (self.onBook) self.onBook();
        } else if (msg.channel === 'allMids') {
          // REST returns the dict directly; the WS message wraps it as {mids:{...}}
          const mids = (msg.data && msg.data.mids) ? msg.data.mids : msg.data;
          const p = mids ? parseFloat(mids[self.coin]) : NaN;
          if (isFinite(p)) {
            self.markPrice = p;
            if (self.onPrice) self.onPrice();
          }
        }
      };
      ws.onerror = function () { self._err('WebSocket error (network blocked?).'); };
      ws.onclose = function () { self.ws = null; };
    },

    disconnectWs() {
      if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
    },

    /* ============================================================
       EIP-712 signing (Hyperliquid scheme)
       ============================================================ */
    /* ============================================================
       EIP-712 signing (Hyperliquid L1-action scheme, current API)
       ------------------------------------------------------------
       L1 actions (order / cancel / modify / leverage) are signed as an
       EIP-712 "Agent" message over a FIXED signing chain id 1337, in the
       "Exchange" domain. The signed payload is NOT the JSON action — it is
       a 32-byte connectionId = keccak256( msgpack(action)
                                      + nonce(8 bytes, big-endian)
                                      + vaultFlag(1 byte, 0x00 = none)
                                      [+ vault address, if any] ).
       The /exchange POST body then carries { action, nonce, signature{r,s,v},
       vaultAddress }. This matches the official SDK's sign_l1_action.
       ============================================================ */

    /** minimal msgpack encoder — only the types Hyperliquid actions use:
        object(map w/ string keys, insertion order), array, string, boolean,
        integer. Floats are unsupported (actions never send them). */
    _msgpackEncode(value) {
      var out = [];
      function writeUint(n) {
        if (n < 0) throw new Error('negative int not supported by msgpack encoder');
        if (n <= 0x7f) out.push(n);
        else if (n <= 0xff) { out.push(0xcc); out.push(n); }
        else if (n <= 0xffff) { out.push(0xcd); out.push((n >>> 8) & 0xff); out.push(n & 0xff); }
        else if (n <= 0xffffffff) { out.push(0xce); out.push((n >>> 24) & 0xff); out.push((n >>> 16) & 0xff); out.push((n >>> 8) & 0xff); out.push(n & 0xff); }
        else { var N = BigInt(n); out.push(0xcf); for (var i = 7; i >= 0; i--) out.push(Number((N >> BigInt(8 * i)) & 0xffn)); }
      }
      function writeStr(s) {
        var b = new TextEncoder().encode(s);
        var len = b.length;
        if (len < 32) out.push(0xa0 + len);
        else if (len < 256) { out.push(0xd9); out.push(len); }
        else if (len < 65536) { out.push(0xda); out.push((len >>> 8) & 0xff); out.push(len & 0xff); }
        else { out.push(0xdb); out.push((len >>> 24) & 0xff); out.push((len >>> 16) & 0xff); out.push((len >>> 8) & 0xff); out.push(len & 0xff); }
        for (var i = 0; i < len; i++) out.push(b[i]);
      }
      function encode(v) {
        if (v === null || v === undefined) { out.push(0xc0); return; }
        if (typeof v === 'boolean') { out.push(v ? 0xc3 : 0xc2); return; }
        if (typeof v === 'number') {
          if (Number.isInteger(v)) { writeUint(v); return; }
          var buf = new ArrayBuffer(8); new DataView(buf).setFloat64(0, v);
          var u = new Uint8Array(buf); out.push(0xcb); for (var i = 0; i < 8; i++) out.push(u[i]); return;
        }
        if (typeof v === 'string') { writeStr(v); return; }
        if (Array.isArray(v)) {
          var al = v.length;
          if (al < 16) out.push(0x90 + al);
          else if (al < 65536) { out.push(0xdc); out.push((al >>> 8) & 0xff); out.push(al & 0xff); }
          else { out.push(0xdd); out.push((al >>> 24) & 0xff); out.push((al >>> 16) & 0xff); out.push((al >>> 8) & 0xff); out.push(al & 0xff); }
          for (var j = 0; j < al; j++) encode(v[j]);
          return;
        }
        if (typeof v === 'object') {
          var keys = Object.keys(v);
          var ml = keys.length;
          if (ml < 16) out.push(0x80 + ml);
          else if (ml < 65536) { out.push(0xde); out.push((ml >>> 8) & 0xff); out.push(ml & 0xff); }
          else { out.push(0xdf); out.push((ml >>> 24) & 0xff); out.push((ml >>> 16) & 0xff); out.push((ml >>> 8) & 0xff); out.push(ml & 0xff); }
          for (var k = 0; k < ml; k++) { writeStr(keys[k]); encode(v[keys[k]]); }
          return;
        }
        throw new Error('unsupported msgpack type: ' + typeof v);
      }
      encode(value);
      return Uint8Array.from(out);
    },

    /** keccak256( msgpack(action) + nonce(8B BE) + vaultFlag ) -> 0x-hex bytes32 */
    _hashAction(action, nonce) {
      var bytes = this._msgpackEncode(action);
      var buf = new Uint8Array(bytes.length + 8 + 1);
      buf.set(bytes, 0);
      var n = BigInt(nonce);
      for (var i = 0; i < 8; i++) buf[bytes.length + 7 - i] = Number((n >> BigInt(8 * i)) & 0xffn);
      buf[bytes.length + 8] = 0x00; // no vault
      return window.ethers.keccak256(buf); // 0x + 64 hex chars
    },

    /** format a number the way the HL SDK hashes it: up to 8 decimals,
        trailing zeros stripped (e.g. 75.000000 -> "75"). */
    _fmt(x) {
      var s = Number(x).toFixed(8);
      return s.replace(/\.?0+$/, '');
    },

    async _signAction(action, nonce) {
      if (!this.wallet) throw new Error('Wallet not connected');
      var isMainnet = this.env === 'mainnet';
      var connectionId = this._hashAction(action, nonce); // bytes32 hex
      var domain = {
        name: 'Exchange',
        version: '1',
        chainId: 1337, // FIXED signing chain for L1 actions
        verifyingContract: '0x0000000000000000000000000000000000000000',
      };
      var types = {
        Agent: [
          { name: 'source', type: 'string' },
          { name: 'connectionId', type: 'bytes32' },
        ],
      };
      var message = {
        source: isMainnet ? 'a' : 'b', // 'b' = isolated-margin testnet pool
        connectionId: connectionId,
      };
      // ethers v6 Signer.signTypedData(domain, types, message) -> 65-byte hex sig
      var sig = await this.wallet.signTypedData(domain, types, message);
      // split into the {r, s, v} shape the /exchange body expects
      return {
        r: '0x' + sig.slice(2, 66),
        s: '0x' + sig.slice(66, 130),
        v: parseInt(sig.slice(130, 132), 16),
      };
    },

    async _postExchange(action) {
      // ONE nonce for both the signature message and the POST body.
      var nonce = Date.now();
      var signature = await this._signAction(action, nonce);
      var body = {
        action: action,
        nonce: nonce,
        signature: signature, // {r, s, v}
        vaultAddress: null,
      };
      var ep = this.endpoints().exchange;
      var res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var txt = await res.text();
      var json;
      try { json = JSON.parse(txt); } catch (e) { throw new Error('Bad exchange response: ' + txt.slice(0, 200)); }
      if (json && json.status === 'err') throw new Error('Exchange error: ' + JSON.stringify(json.response));
      return json;
    },

    /* ============================================================
       Order placement
       order = { side:'buy'|'sell', size:Number, type:'market'|'limit',
                 price:Number|null, reduceOnly:Boolean,
                 tp:Number|null, sl:Number|null }   // optional take-profit / stop-loss
       ============================================================ */
    // Build a market-trigger TP/SL resting order. A TP/SL order is always
    // reduce-only and on the OPPOSITE side of the entry (long -> sells, short -> buys).
    _tpslOrder(assetId, isBuy, size, price, kind) {
      return {
        a: assetId,
        b: !isBuy,                 // opposite side of the position
        p: '0',                   // market trigger: no limit price
        s: this._fmt(size),
        r: true,                  // reduce only
        t: { trigger: { triggerPx: this._fmt(price), isMarket: true, tpsl: kind } },
      };
    },

    async placeOrder(order) {
      if (!this.address) throw new Error('Connect wallet first');
      const assetId = await this.getAssetId();
      const isBuy = order.side === 'buy';

      let px;
      if (order.type === 'limit') {
        if (!order.price || order.price <= 0) throw new Error('Limit order needs a price');
        px = this._fmt(order.price);
      } else {
        // market: Ioc limit bounded by slippage around current mark
        const ref = this.markPrice || (await this.refreshPrice());
        const bound = order.side === 'buy' ? ref * (1 + this.maxSlippageBps / 10000)
                                           : ref * (1 - this.maxSlippageBps / 10000);
        px = this._fmt(bound);
      }

      const tif = order.type === 'limit' ? 'Gtc' : 'Ioc';
      const action = {
        type: 'order',
        orders: [{
          a: assetId,
          b: isBuy,
          p: px,
          s: this._fmt(order.size),
          r: !!order.reduceOnly,
          t: { limit: { tif: tif } },
        }],
        grouping: 'na',
      };

      // TP/SL are encoded as additional market-trigger, reduce-only orders
      // sent atomically with the entry order (Hyperliquid gives the entry
      // and its TP/SL the same `oid` grouping when `grouping` is set).
      // Only meaningful when opening a position, not on a reduce-only close.
      if (!order.reduceOnly) {
        if (order.tp && order.tp > 0) {
          action.orders.push(this._tpslOrder(assetId, isBuy, order.size, order.tp, 'tp'));
        }
        if (order.sl && order.sl > 0) {
          action.orders.push(this._tpslOrder(assetId, isBuy, order.size, order.sl, 'sl'));
        }
      }

      const res = await this._postExchange(action);
      return res;
    },

    async cancelOrder(oid) {
      if (!this.address) throw new Error('Connect wallet first');
      const assetId = await this.getAssetId();
      const action = { type: 'cancel', cancels: [{ a: assetId, o: oid }] };
      return this._postExchange(action);
    },

    /* ============================================================
       State mirror — map on-chain clearinghouseState + openOrders
       into the {positions, orders, balance} shape app.js renders.
       ============================================================ */
    async syncState() {
      if (!this.address) return null;
      const state = await this.getClearinghouseState(this.address);
      const open = await this.getOpenOrders(this.address);

      const positions = [];
      const acc = (state.assetPositions || []).find((a) => a.position.coin === this.coin);
      if (acc && parseFloat(acc.position.szi) !== 0) {
        const p = acc.position;
        const entry = parseFloat(p.entryPx);
        const size = parseFloat(p.szi);
        const side = size >= 0 ? 'long' : 'short';
        positions.push({
          side: side,
          size: Math.abs(size),
          entry: entry,
          margin: parseFloat(p.marginUsed || 0),
          liq: parseFloat(p.liquidationPx || 0),
          tp: null,
          sl: null,
        });
      }

      const orders = (open || []).map((o) => ({
        side: parseFloat(o.szi) >= 0 ? 'long' : 'short',
        price: parseFloat(o.limitPx),
        size: Math.abs(parseFloat(o.szi)),
        reduceOnly: !!o.reduceOnly,
        oid: o.oid,
        tp: null,
        sl: null,
      }));

      const balance = parseFloat((state.marginSummary && state.marginSummary.accountValue) || 0);

      if (this.onState) this.onState({ positions: positions, orders: orders, balance: balance });
      return { positions: positions, orders: orders, balance: balance };
    },
  };

  window.HLClient = HLClient;
})();
