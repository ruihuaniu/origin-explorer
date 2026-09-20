/* =============================================================================
   SCALE — application shell
   Camera rig, level transitions, depth navigation, annotations, live scale bar.
   ========================================================================== */
(function () {
  'use strict';
  var T = window.THREE;
  var SCALE = window.SCALE;
  var LEVELS = SCALE.LEVELS;
  var FOV = 38;
  var TRANSITION_MS = 900;
  var PAD = 1.22;   // framing margin so models and their labels breathe

  /* ------------------------------------------------------------------ state */
  var app = {
    index: 0,
    dist: 1, distTarget: 1,
    dir: new T.Vector3(0.55, 0.34, 0.76).normalize(),
    phase: 'idle',          // idle | moving
    t0: 0, from: null, to: null, dirSign: 1,
    autoRotate: false,
    locked: false
  };
  var cache = {};

  /* -------------------------------------------------------------------- dom */
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    canvas: $('gl'), warp: $('warp'), anno: $('anno-layer'), rail: $('rail'),
    name: $('lv-name'), kind: $('lv-kind'), scale: $('lv-scale'), blurb: $('lv-blurb'),
    compare: $('lv-compare'), facts: $('lv-facts'), num: $('lv-num'), total: $('lv-total'),
    hint: $('hint'), sbWrap: $('scalebar'), sbLine: $('scalebar-line'), sbLabel: $('scalebar-label'),
    prev: $('btn-prev'), next: $('btn-next'), rotate: $('btn-rotate'), reset: $('btn-reset'),
    panel: $('panel'), panelToggle: $('panel-toggle'), toast: $('toast'),
    brandSub: $('brand-sub'), langBtn: $('btn-lang'),
    trail: $('trail'), links: $('links'), ribbon: $('ribbon')
  };

  /* --------------------------------------------------------------- renderer */
  var renderer = new T.WebGLRenderer({ canvas: el.canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(FOV, 1, 0.1, 100);
  var world = new T.Group();
  scene.add(world);

  // pale studio backdrop
  (function () {
    var cv = document.createElement('canvas');
    cv.width = 8; cv.height = 256;
    var ctx = cv.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#e9f0fa');
    g.addColorStop(0.48, '#f8fbfe');
    g.addColorStop(1, '#e6edf7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    scene.background = tex;
  })();

  var pmrem = new T.PMREMGenerator(renderer);
  try {
    scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.55;
  } catch (err) { /* environment is a nice-to-have */ }

  scene.add(new T.HemisphereLight(0xffffff, 0xdfe7f2, 1.5));
  var key = new T.DirectionalLight(0xffffff, 2.1);
  key.position.set(4, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004;
  scene.add(key);
  var fill = new T.DirectionalLight(0xcfe0ff, 0.9);
  fill.position.set(-5, -2, -4);
  scene.add(fill);
  var rim = new T.PointLight(0x9fc4ff, 60, 60);
  rim.position.set(-4, 3, -6);
  scene.add(rim);

  // soft contact shadow that follows the current model
  var shadow = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({
      map: SCALE.util.radialTexture([
        [0, 'rgba(52,74,110,0.55)'],
        [0.45, 'rgba(52,74,110,0.24)'],
        [1, 'rgba(52,74,110,0)']
      ], 256),
      transparent: true, depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = -2;
  scene.add(shadow);

  /* -------------------------------------------------------------- controls */
  var controls = new T.OrbitControls(camera, el.canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.rotateSpeed = 0.72;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = Math.PI - 0.22;
  controls.autoRotateSpeed = 0.7;

  /* ------------------------------------------------------------ level build */
  function disposeGroup(g) {
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        // NB: textures are deliberately NOT disposed. The radial glow texture is a
        // module-level singleton shared by the atom / nucleon / quark levels, so
        // freeing it here would blank out levels that are still alive.
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
          m.dispose();
        });
      }
    });
  }

  function getLevel(i) {
    var lv = LEVELS[i];
    if (cache[lv.id]) return cache[lv.id];
    var g = SCALE.MODELS[lv.id]();
    g.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    g.visible = false;
    g.userData.id = lv.id;
    cache[lv.id] = g;
    world.add(g);
    return g;
  }

  function pruneCache(keepIdx) {
    var keep = [];
    keepIdx.forEach(function (i) { if (LEVELS[i]) keep.push(LEVELS[i].id); });
    Object.keys(cache).forEach(function (id) {
      if (keep.indexOf(id) === -1) {
        world.remove(cache[id]);
        disposeGroup(cache[id]);
        delete cache[id];
      }
    });
  }

  /** Exact distance needed to fit a bounding box for the current camera basis. */
  function fitDistance(box, dir, padding) {
    var center = box.getCenter(new T.Vector3());
    var back = dir.clone().normalize();
    var up = new T.Vector3(0, 1, 0);
    if (Math.abs(back.dot(up)) > 0.985) up.set(1, 0, 0);
    var right = new T.Vector3().crossVectors(up, back).normalize();
    up.crossVectors(back, right).normalize();

    var vT = Math.tan((camera.fov * Math.PI / 180) / 2);
    var hT = vT * camera.aspect;

    var min = box.min, max = box.max;
    var need = 0;
    for (var i = 0; i < 8; i++) {
      var p = new T.Vector3(
        i & 1 ? max.x : min.x,
        i & 2 ? max.y : min.y,
        i & 4 ? max.z : min.z
      ).sub(center);
      var z = p.dot(back);
      need = Math.max(need, z + Math.abs(p.dot(right)) / hT);
      need = Math.max(need, z + Math.abs(p.dot(up)) / vT);
    }
    return { dist: need * (padding || 1.05), center: center };
  }

  function measure(group) {
    group.updateMatrixWorld(true);
    var box = new T.Box3().setFromObject(group);
    var f = fitDistance(box, app.dir, (group.userData.zoom || 2.6) / 2.6 * PAD);
    group.userData.fit = f.dist;
    group.userData.center = f.center;
    group.userData.box = box;
    return group.userData;
  }

  /* ---------------------------------------------------------- annotations */
  function buildAnnotations(group) {
    el.anno.innerHTML = '';
    var list = group.userData.annotations || [];
    list.forEach(function (a) {
      var node = document.createElement('div');
      node.className = 'anno tone-' + a.tone;
      node.innerHTML = '<span class="anno-dot"></span><span class="anno-text"></span>';
      var label = node.querySelector('.anno-text');
      label.textContent = annoText(a.text);
      el.anno.appendChild(node);
      a.el = node;
      a.labelEl = label;
      a.local = new T.Vector3(a.p[0], a.p[1], a.p[2]);
    });
  }

  var _wp = new T.Vector3();
  function updateAnnotations(group, opacity) {
    var list = group.userData.annotations || [];
    var w = el.canvas.clientWidth, h = el.canvas.clientHeight;
    var pad = 24;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!a.el) continue;
      _wp.copy(a.local);
      group.localToWorld(_wp);
      _wp.project(camera);
      var on = opacity > 0.02 && _wp.z < 1;
      a.el.style.opacity = on ? opacity.toFixed(2) : '0';
      if (!on) continue;
      var sx = (_wp.x * 0.5 + 0.5) * w;
      var sy = (-_wp.y * 0.5 + 0.5) * h;
      a.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
      var flip = sx > w * 0.6;
      if (flip !== a.flipped) { a.flipped = flip; a.el.classList.toggle('flip', flip); }
      // keep the label on screen even when its anchor sits near an edge
      var dy = sy < pad ? pad - sy : (sy > h - pad ? (h - pad) - sy : 0);
      if (dy !== a.dy) {
        a.dy = dy;
        a.labelEl.style.transform = 'translateY(calc(-50% + ' + dy.toFixed(1) + 'px))';
      }
    }
  }

  /* ---------------------------------------------------------------- scalebar */
  function niceNumber(v) {
    if (!(v > 0)) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(v)));
    var m = v / e;
    var pick = m >= 5 ? 5 : m >= 2 ? 2 : 1;
    return pick * e;
  }
  function fmtMeters(m) {
    function r(n) { return Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : n.toFixed(1); }
    if (m >= 1) return r(m) + ' m';
    if (m >= 0.01) return r(m * 100) + ' cm';
    if (m >= 0.001) return r(m * 1000) + ' mm';
    if (m >= 1e-6) return r(m * 1e6) + ' \u00b5m';
    if (m >= 1e-9) return r(m * 1e9) + ' nm';
    if (m >= 1e-12) return r(m * 1e12) + ' pm';
    if (m >= 1e-15) return r(m * 1e15) + ' fm';
    if (m >= 1e-18) return r(m * 1e18) + ' am';
    return m.toExponential(0).replace('e-', '\u00d710\u207b') + ' m';
  }
  function updateScaleBar() {
    var g = app.to || app.from;
    if (!g) return;
    var lv = LEVELS[app.index];
    var unitMeters = g.userData.unitMeters || lv.unitMeters;
    var h = el.canvas.clientHeight || 1;
    var worldPerPx = (2 * Math.tan((camera.fov * Math.PI / 180) / 2) * app.dist) / h;
    var metersPerPx = worldPerPx * unitMeters;
    var nice = niceNumber(metersPerPx * 120);
    var px = nice / metersPerPx;
    px = Math.max(28, Math.min(px, 260));
    el.sbLine.style.width = px.toFixed(0) + 'px';
    el.sbLabel.textContent = fmtMeters(nice);
  }

  /* ------------------------------------------------------------- info panel */
  function paintPanel(i) {
    var lv = LV(i);
    el.num.textContent = String(i + 1).padStart(2, '0');
    el.kind.textContent = lv.kind;
    el.name.textContent = lv.name;
    el.scale.textContent = lv.scale;
    el.blurb.textContent = lv.blurb;
    el.compare.textContent = lv.compare;
    el.facts.innerHTML = lv.facts.map(function (f) {
      return '<li><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></li>';
    }).join('');
    el.panel.style.setProperty('--accent', lv.accent);
    el.panel.classList.remove('swap');
    void el.panel.offsetWidth;
    el.panel.classList.add('swap');
    el.prev.disabled = i === 0;
    el.next.disabled = i === LEVELS.length - 1;
    Array.prototype.forEach.call(el.rail.querySelectorAll('.rail-item'), function (node, k) {
      node.classList.toggle('active', k === i);
      node.classList.toggle('passed', k < i);
    });
    // edge k joins level k to level k+1, so it is behind us once both ends are
    Array.prototype.forEach.call(el.rail.querySelectorAll('.rail-edge'), function (node, k) {
      node.classList.toggle('passed', k < i - 1);
    });
    paintLinks(i);
    paintTrail(i);
  }

  function buildRail() {
    el.rail.innerHTML = '';
    LEVELS.forEach(function (raw, i) {
      var lv = LV(i);
      // the ratio rung: how much smaller the next stop is
      if (i > 0) {
        var lk = LNK(i - 1);
        var e = document.createElement('div');
        e.className = 'rail-edge';
        e.innerHTML = '<span>' + esc(lk.ratio) + '</span>';
        e.title = LV(i - 1).name + ' \u2192 ' + lv.name + ': ' + lk.rel;
        el.rail.appendChild(e);
      }
      var b = document.createElement('button');
      b.className = 'rail-item';
      b.type = 'button';
      b.innerHTML = '<span class="rail-label"><b>' + esc(lv.name) + '</b><i>' + esc(lv.scale) + '</i></span>' +
        '<span class="rail-dot"></span>';
      b.title = lv.name + ' \u2014 ' + lv.scale;
      b.addEventListener('click', function () { goTo(i); });
      el.rail.appendChild(b);
    });
    el.total.textContent = String(LEVELS.length);
    if (el.rail.setAttribute) el.rail.setAttribute('aria-label', t('railAria'));
  }

  /* -------------------------------------------------------- level relations */
  /* The connective tissue between adjacent stops.

     Every level except the last carries a `door` anchor, parented inside the
     model at the spot where the next level down actually lives. The app draws a
     billboarded ring around it and lets you click straight through, so the
     descent follows a real physical relationship instead of a jump cut.

     Each edge then states itself in words in three places: the trail along the
     top (the containment chain), the panel rows (part of / contains), and a
     ribbon across the screen at the moment of the transition. */
  var LINKS = SCALE.LINKS;
  var doorMark = null, doorRing = null, doorHalo = null, doorPill = null;
  var doorNode = null, doorR = 0, doorPillW = 0, doorPillH = 0, panelBox = null;
  var ribbonTimer = null, toastTimer = null;
  var _dv = new T.Vector3(), _ds = new T.Vector3(), _dp = new T.Vector3();

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** The door anchor is the only object in a model named 'door'. */
  function findDoor(group) {
    var found = null;
    group.traverse(function (o) { if (!found && o.name === 'door') found = o; });
    return found;
  }

  /** The edge leaving level i (i -> i+1), or null at the bottom of the ladder. */
  function linkDown(i) { return LINKS[i] || null; }
  /** The edge entering level i (i-1 -> i), or null at the top of the ladder. */
  function linkUp(i) { return i > 0 ? LINKS[i - 1] : null; }

  /* --- trail: the containment chain, always showing what encloses what ----- */
  function paintTrail(i) {
    if (!el.trail) return;
    var from = Math.max(0, i - 2);
    var to = Math.min(LEVELS.length - 1, i + 1);
    var html = '';
    if (from > 0) html += '<span class="trail-more">' + from + ' ' + esc(t('above')) + '</span>';
    for (var k = from; k <= to; k++) {
      var cls = k === i ? ' cur' : (k < i ? ' up' : ' down');
      var lk = k < i ? LNK(k) : null;
      html += '<button type="button" class="trail-chip' + cls + '" data-i="' + k + '"' +
        (lk ? ' title="' + esc(lk.rel) + '"' : '') + '>' +
        (k < i ? '\u2191 ' : k > i ? '\u2193 ' : '') + esc(LV(k).name) + '</button>';
      if (k < to) html += '<span class="trail-sep">' + esc(LNK(k).ratio) + '</span>';
    }
    el.trail.innerHTML = html;
    if (el.trail.setAttribute) el.trail.setAttribute('aria-label', t('trailAria'));
    Array.prototype.forEach.call(el.trail.querySelectorAll('.trail-chip'), function (b) {
      b.addEventListener('click', function () {
        goTo(parseInt(b.getAttribute('data-i'), 10));
      });
    });
  }

  /* --- panel rows: what this sits inside, and what sits inside it ---------- */
  function linkRow(key, i, note, ratio, dir) {
    var on = i >= 0;
    return '<button type="button" class="link-row ' + dir + (on ? '' : ' off') + '"' +
      (on ? ' data-i="' + i + '"' : ' disabled') + '>' +
      '<span class="lr-key">' + esc(key) + '</span>' +
      '<span class="lr-body"><b>' + esc(on ? LV(i).name : '\u2014') + '</b>' +
      '<i>' + esc(note) + '</i></span>' +
      '<span class="lr-ratio">' + esc(ratio) + '</span>' +
      '</button>';
  }

  function paintLinks(i) {
    if (!el.links) return;
    var up = linkUp(i), down = linkDown(i);
    var upTr = up ? LNK(i - 1) : null;
    var downTr = down ? LNK(i) : null;
    el.links.innerHTML =
      linkRow(t('partOf'), up ? i - 1 : -1, upTr ? upTr.up : t('nothingAbove'),
        up ? up.ratio : '', 'up') +
      linkRow(t('contains'), down ? i + 1 : -1, downTr ? downTr.down : t('nothingBelow'),
        down ? down.ratio : '', 'down');
    Array.prototype.forEach.call(el.links.querySelectorAll('.link-row[data-i]'), function (b) {
      b.addEventListener('click', function () {
        goTo(parseInt(b.getAttribute('data-i'), 10));
      });
    });
  }

  /* --- the door: a ring around the next level, plus a clickable pill ------- */
  function measurePill() {
    if (doorPill) {
      doorPillW = doorPill.offsetWidth || 0;
      doorPillH = doorPill.offsetHeight || 0;
    }
    // the info panel is opaque, so the pill must never slide underneath it
    panelBox = (el.panel && el.panel.classList && !el.panel.classList.contains('hidden'))
      ? el.panel.getBoundingClientRect() : null;
  }

  function initDoors() {
    doorMark = new T.Group();
    doorMark.visible = false;
    scene.add(doorMark);

    doorRing = new T.Mesh(new T.TorusGeometry(1, 0.026, 8, 80), new T.MeshBasicMaterial({
      color: 0x2f6bff, transparent: true, opacity: 0.92,
      depthTest: false, depthWrite: false
    }));
    doorRing.renderOrder = 60;
    doorMark.add(doorRing);

    doorHalo = new T.Mesh(new T.TorusGeometry(1, 0.009, 6, 80), new T.MeshBasicMaterial({
      color: 0x2f6bff, transparent: true, opacity: 0.4,
      depthTest: false, depthWrite: false, blending: T.AdditiveBlending
    }));
    doorHalo.renderOrder = 59;
    doorMark.add(doorHalo);

    doorPill = document.getElementById('door-pill');
    if (doorPill) {
      doorPill.addEventListener('click', function () { goTo(app.index + 1); });
    }
  }

  /** Aim the door at level i's exit: recolour it and fill in the pill. */
  function setDoor(i) {
    var g = app.to || app.from;
    var lk = LNK(i);
    doorNode = (lk && g) ? findDoor(g) : null;
    if (!doorMark) return;
    if (!doorNode || !doorPill) {
      doorMark.visible = false;
      if (doorPill) doorPill.classList.remove('show');
      return;
    }
    doorR = doorNode.userData.r || 0.3;
    var accent = LEVELS[i + 1].accent;
    doorRing.material.color.set(accent);
    doorHalo.material.color.set(accent);
    doorPill.style.setProperty('--door-accent', accent);
    doorPill.querySelector('.dp-name').textContent = LV(i + 1).name;
    doorPill.querySelector('.dp-hook').textContent = lk.down;
    doorPill.querySelector('.dp-ratio').textContent = lk.ratio;
    doorPill.title = lk.rel;
    measurePill();
  }

  /** Per-frame: billboard the ring onto its anchor and park the pill beside it. */
  function updateDoor(now) {
    if (!doorMark) return;
    var g = app.to || app.from;
    if (!doorNode || !g || !g.visible || app.phase === 'moving') {
      doorMark.visible = false;
      if (doorPill) doorPill.classList.remove('show');
      return;
    }
    doorNode.updateWorldMatrix(true, false);
    doorNode.getWorldPosition(_dv);
    doorNode.getWorldScale(_ds);

    var rWorld = doorR * _ds.x;
    doorMark.visible = true;
    doorMark.position.copy(_dv);
    doorMark.quaternion.copy(camera.quaternion);
    doorMark.scale.setScalar(rWorld * (1 + Math.sin(now * 0.0022) * 0.045));

    // a slow sonar ping so the eye finds it
    var ph = (now % 2300) / 2300;
    doorHalo.scale.setScalar(1 + ph * 0.5);
    doorHalo.material.opacity = 0.42 * (1 - ph);

    if (!doorPill) return;
    _dp.copy(_dv).project(camera);
    if (_dp.z > 1) { doorPill.classList.remove('show'); return; }

    var w = el.canvas.clientWidth, h = el.canvas.clientHeight;
    var sx = (_dp.x * 0.5 + 0.5) * w;
    var sy = (-_dp.y * 0.5 + 0.5) * h;
    var pxPerWorld = h / (2 * Math.tan((camera.fov * Math.PI / 180) / 2) * app.dist);
    var rs = rWorld * pxPerWorld;
    if (!doorPillW) measurePill();

    var gap = 16;
    var flip = sx + rs + gap + doorPillW > w - 18;
    var px = flip ? sx - rs - gap - doorPillW : sx + rs + gap;
    var py = clamp(sy - doorPillH * 0.5, 78, Math.max(78, h - doorPillH - 96));
    px = clamp(px, 18, Math.max(18, w - doorPillW - 18));
    // dodge the panel rather than disappearing behind it
    if (panelBox && py + doorPillH > panelBox.top && py < panelBox.bottom) {
      px = Math.min(Math.max(px, panelBox.right + 12), Math.max(18, w - doorPillW - 18));
    }

    doorPill.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
    doorPill.classList.toggle('flip', flip);
    doorPill.classList.add('show');
  }

  /* --- ribbon: the relation, stated across the screen at the swap ---------- */
  function showRibbon(fromIdx, toIdx) {
    if (!el.ribbon) return;
    var down = toIdx > fromIdx;
    var big = down ? LV(fromIdx) : LV(toIdx);
    var small = down ? LV(toIdx) : LV(fromIdx);
    var lk = down ? LNK(fromIdx) : LNK(toIdx);
    el.ribbon.innerHTML =
      '<div class="rb-line">' +
      '<span class="rb-side">' + esc(big.name) + '</span>' +
      '<span class="rb-mid"><i>' + esc(lk.ratio) + '</i>' + (down ? '\u2193' : '\u2191') + '</span>' +
      '<span class="rb-side">' + esc(small.name) + '</span>' +
      '</div>' +
      '<div class="rb-rel">' + esc(lk.rel) + '</div>';
    el.ribbon.style.setProperty('--door-accent', small.accent);
    el.ribbon.classList.add('show');
    hideToast();                 // the toast shares this band; only one shows
    clearTimeout(ribbonTimer);
    ribbonTimer = setTimeout(function () { el.ribbon.classList.remove('show'); }, 2800);
  }

  /* The toast and the transition ribbon both sit centred near the bottom of the
     screen, so they would overlap if both were ever shown at once. Whichever
     fires last wins. */
  function hideToast() {
    clearTimeout(toastTimer);
    if (el.toast) el.toast.classList.remove('show');
  }
  function hideRibbon() {
    clearTimeout(ribbonTimer);
    if (el.ribbon) el.ribbon.classList.remove('show');
  }

  /* ------------------------------------------------------------- translation */
  /* Every user-visible string is routed through here.
     Chinese is merged FIELD BY FIELD over the English source, so a translation
     that omits a field falls back to English instead of rendering blank.
     Model annotations are keyed by the exact English string the builders baked
     into the geometry, which keeps models.js language-agnostic. */
  var I18N = SCALE.I18N || {
    langs: [{ id: 'en', tag: 'EN', name: 'English', htmlLang: 'en' }],
    ui: { en: {} }, levels: {}, links: {}, annotations: {}
  };
  var LANG_KEY = 'scale.lang';
  var lang = 'en';

  /** The language record for an id, falling back to the first offered. */
  function langDef(id) {
    var list = I18N.langs || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || { id: 'en', tag: 'EN', name: 'English', htmlLang: 'en' };
  }

  /** Is this a language we actually offer? (langDef always returns something.) */
  function hasLang(id) {
    return (I18N.langs || []).some(function (l) { return l.id === id; });
  }

  /** Shallow own-property merge: `base`, then every field `over` actually sets. */
  function merge(base, over) {
    var out = {}, k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    if (over) for (k in over) if (Object.prototype.hasOwnProperty.call(over, k)) out[k] = over[k];
    return out;
  }

  /** A piece of chrome copy, in the active language. */
  function t(key) {
    var d = (I18N.ui && I18N.ui[lang]) || {};
    var en = (I18N.ui && I18N.ui.en) || {};
    return d[key] !== undefined ? d[key] : (en[key] !== undefined ? en[key] : key);
  }

  /** Level i's copy, in the active language. */
  function LV(i) {
    var base = LEVELS[i];
    if (!base) return base;
    var over = (I18N.levels && I18N.levels[lang] && I18N.levels[lang][base.id]) || null;
    return over ? merge(base, over) : base;
  }

  /** Edge i's copy (i -> i+1), in the active language. */
  function LNK(i) {
    var base = LINKS[i];
    if (!base) return null;
    var over = (I18N.links && I18N.links[lang] && I18N.links[lang][i]) || null;
    return over ? merge(base, over) : base;
  }

  /** One of the labels baked into a model, in the active language. */
  function annoText(s) {
    if (lang === 'en') return s;
    var d = (I18N.annotations && I18N.annotations[lang]) || {};
    return d[s] !== undefined ? d[s] : s;
  }

  function storeLang(id) {
    // localStorage throws outright on file:// in some browsers
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(LANG_KEY, id); }
    catch (err) { /* no persistence, no problem */ }
  }

  function readStoredLang() {
    try {
      if (typeof localStorage === 'undefined') return 'en';
      var v = localStorage.getItem(LANG_KEY);
      if (v && I18N.langs.some(function (l) { return l.id === v; })) return v;
    } catch (err) { /* ignore */ }
    return 'en';
  }

  /** Swap the visible text on a dock button, leaving its arrow glyph alone. */
  function setNavLabel(btn, text) {
    if (!btn || !btn.querySelector) return;
    var n = btn.querySelector('.nav-label');
    if (n) n.textContent = text;
  }

  /** Push the active language onto every piece of static chrome. */
  function paintChrome() {
    var d = langDef(lang);
    if (document.documentElement) document.documentElement.lang = d.htmlLang;
    document.title = t('docTitle');
    if (el.brandSub) el.brandSub.textContent = t('brandSub');
    if (el.hint) el.hint.innerHTML = t('hint');
    setNavLabel(el.prev, t('prev'));
    setNavLabel(el.next, t('next'));
    if (el.rotate) el.rotate.title = t('rotateTitle');
    if (el.reset) el.reset.title = t('resetTitle');
    if (el.langBtn) {
      el.langBtn.title = t('langTitle');
      el.langBtn.innerHTML = I18N.langs.map(function (l) {
        return '<span data-lang="' + l.id + '"' + (l.id === lang ? ' class="on"' : '') + '>' +
          esc(l.tag) + '</span>';
      }).join('');
    }
  }

  /** Switch language and repaint everything that carries words. */
  function setLang(id) {
    if (id === lang || !hasLang(id)) return;
    lang = id;
    storeLang(id);
    paintChrome();
    buildRail();
    paintPanel(app.index);
    setDoor(app.index);
    if (app.to) buildAnnotations(app.to);
    measurePill();
    toast(langDef(id).name);
  }

  function cycleLang() {
    var list = I18N.langs || [];
    if (list.length < 2) return;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === lang) { setLang(list[(i + 1) % list.length].id); return; }
    }
    setLang(list[0].id);
  }

  /* ------------------------------------------------------------- transition */
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  function goTo(target, opts) {
    opts = opts || {};
    if (app.phase !== 'idle' || app.locked) return;
    if (target < 0) { toast(t('topOfLadder')); return; }
    if (target > LEVELS.length - 1) { toast(t('bottomOfLadder')); return; }
    if (target === app.index && !opts.force) { resetView(); return; }

    var prev = app.index;
    var sign = target > app.index ? 1 : -1;
    var from = app.from || app.to;
    var to = getLevel(target);
    measure(to);

    app.index = target;
    app.phase = 'moving';
    app.dirSign = sign;
    app.from = from;
    app.to = to;
    app.t0 = performance.now();
    app.distTarget = to.userData.fit;

    paintPanel(target);
    setDoor(target);
    // State the relation at the moment of the swap — but only for a single
    // step. The ribbon describes ONE edge, so on a rail or number-key jump
    // (which spans several edges) it would mislabel its own endpoints.
    if (Math.abs(target - prev) === 1) {
      setTimeout(function () { showRibbon(prev, target); }, TRANSITION_MS * 0.42);
    }
    buildAnnotations(to);
    positionShadow(to);
    to.visible = true;
    to.scale.setScalar(sign > 0 ? 0.04 : 8);
    if (from) from.visible = true;

    // keep the camera orientation, retarget to the new model
    controls.target.copy(to.userData.center);
    camera.position.copy(controls.target).addScaledVector(app.dir, app.dist);
    camera.near = Math.max(to.userData.fit * 0.004, 1e-4);
    camera.far = to.userData.fit * 400;
    camera.updateProjectionMatrix();
  }

  function finishTransition() {
    if (app.from && app.from !== app.to) {
      app.from.visible = false;
      app.from.scale.setScalar(1);
    }
    app.to.scale.setScalar(1);
    app.from = app.to;
    app.phase = 'idle';
    app.locked = true;
    setTimeout(function () { app.locked = false; }, 180);
    pruneCache([app.index - 1, app.index, app.index + 1]);
  }

  function positionShadow(group) {
    var box = group.userData.box;
    var size = box.getSize(new T.Vector3());
    var center = box.getCenter(new T.Vector3());
    var s = Math.max(size.x, size.z) * 1.5 + size.y * 0.2;
    shadow.scale.set(s, s, 1);
    shadow.position.set(center.x, box.min.y - size.y * 0.035, center.z);
    var dim = Math.min(1, 0.34 * (group.userData.fit || 1) / 3 + 0.12);
    shadow.material.opacity = Math.max(0.16, Math.min(0.4, dim));
  }

  /* ------------------------------------------------------------------- toast */
  function toast(msg) {
    hideRibbon();
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2200);
  }

  /* --------------------------------------------------------------- view ops */
  function resetView() {
    var g = app.to || app.from;
    if (!g) return;
    app.dir.set(0.55, 0.34, 0.76).normalize();
    app.distTarget = g.userData.fit;
    app.dist = g.userData.fit;
    controls.target.copy(g.userData.center);
    camera.position.copy(controls.target).addScaledVector(app.dir, app.dist);
    camera.fov = FOV;
    camera.updateProjectionMatrix();
    controls.update();
  }

  /* ------------------------------------------------------------------ input */
  var ZOOM_MIN = 0.42;   // fraction of the fitted distance that triggers a descent
  var ZOOM_MAX = 2.45;   // ...and an ascent
  function zoomBy(factor) {
    if (app.phase !== 'idle') return;
    var g = app.to || app.from;
    var fit = g.userData.fit;
    app.distTarget = clamp(app.distTarget * factor, fit * (ZOOM_MIN - 0.02), fit * ZOOM_MAX);
    if (app.distTarget <= fit * (ZOOM_MIN - 0.015)) goTo(app.index + 1);
    else if (app.distTarget >= fit * (ZOOM_MAX - 0.02)) goTo(app.index - 1);
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // One wheel notch (~100px) is exp(-0.34) = 0.71x, so three notches take you
  // down a level: responsive, but not so twitchy that a stray flick jumps scale.
  el.canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    zoomBy(Math.exp(clamp(d, -120, 120) * 0.0034));
  }, { passive: false });

  el.canvas.addEventListener('dblclick', function () { zoomBy(0.55); });

  // two-finger pinch
  var pinch = null;
  el.canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      pinch = { d: touchDist(e), start: app.distTarget };
    }
  }, { passive: true });
  el.canvas.addEventListener('touchmove', function (e) {
    if (pinch && e.touches.length === 2) {
      var d = touchDist(e);
      if (d > 0) {
        var next = pinch.start * (pinch.d / d);
        var g = app.to || app.from;
        var fit = g.userData.fit;
        var before = app.distTarget;
        app.distTarget = clamp(next, fit * (ZOOM_MIN - 0.02), fit * ZOOM_MAX);
        if (app.distTarget <= fit * (ZOOM_MIN - 0.015) && before > fit * (ZOOM_MIN - 0.015)) goTo(app.index + 1);
        else if (app.distTarget >= fit * (ZOOM_MAX - 0.02) && before < fit * (ZOOM_MAX - 0.02)) goTo(app.index - 1);
      }
    }
  }, { passive: true });
  el.canvas.addEventListener('touchend', function () { pinch = null; }, { passive: true });
  function touchDist(e) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'j' || k === 'n') {
      e.preventDefault(); goTo(app.index + 1);
    } else if (k === 'ArrowUp' || k === 'PageUp' || k === 'k' || k === 'p') {
      e.preventDefault(); goTo(app.index - 1);
    } else if (k === 'Home') { goTo(0); }
    else if (k === 'End') { goTo(LEVELS.length - 1); }
    else if (k === 'Enter') {
      // step through the door, unless a button has focus and wants the key
      var ae = document.activeElement;
      if (ae && ae.tagName === 'BUTTON') return;
      e.preventDefault();
      goTo(app.index + 1);
    }
    else if (k === 'r' || k === 'R') { resetView(); }
    else if (k === 'a' || k === 'A') { toggleRotate(); }
    else if (k === 'l' || k === 'L') { cycleLang(); }
    else if (k === 'h' || k === 'H') { el.panel.classList.toggle('hidden'); }
    else if (/^[1-9]$/.test(k)) { goTo(parseInt(k, 10) - 1); }
  });

  function toggleRotate() {
    app.autoRotate = !app.autoRotate;
    controls.autoRotate = app.autoRotate;
    el.rotate.classList.toggle('on', app.autoRotate);
  }

  el.prev.addEventListener('click', function () { goTo(app.index - 1); });
  el.next.addEventListener('click', function () { goTo(app.index + 1); });
  el.rotate.addEventListener('click', toggleRotate);
  el.reset.addEventListener('click', resetView);
  if (el.panelToggle) {
    el.panelToggle.addEventListener('click', function () {
      var collapsed = el.panel.classList.toggle('collapsed');
      el.panelToggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }
  if (el.langBtn) {
    // clicking a segment jumps straight to that language; the pill itself cycles
    el.langBtn.addEventListener('click', function (e) {
      var seg = e && e.target && e.target.getAttribute && e.target.getAttribute('data-lang');
      if (seg) setLang(seg); else cycleLang();
    });
  }

  /* ------------------------------------------------------------------- loop */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    var g = app.to || app.from;
    if (g && app.phase === 'idle') {
      var f = fitDistance(g.userData.box, app.dir, (g.userData.zoom || 2.6) / 2.6 * PAD);
      g.userData.fit = f.dist;
      app.distTarget = f.dist;
      app.dist = f.dist;
    }
    measurePill();
  }
  window.addEventListener('resize', resize);

  var last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    var t = now / 1000;

    // ---- transition timeline
    if (app.phase === 'moving') {
      var raw = clamp((now - app.t0) / TRANSITION_MS, 0, 1);
      var e = easeInOut(raw);
      var down = app.dirSign > 0;
      if (app.from && app.from !== app.to) {
        app.from.scale.setScalar(down ? 1 + e * 7 : 1 - e * 0.96);
        app.from.visible = !down || e < 0.98;
      }
      if (app.to) {
        app.to.scale.setScalar(down ? 0.04 + e * 0.96 : 8 - e * 7);
        app.to.visible = true;
      }
      // warp flash: peaks at the swap
      var flash = 1 - Math.abs(raw - 0.5) * 2;
      el.warp.style.opacity = (flash * 0.9).toFixed(3);
      camera.fov = FOV + Math.sin(raw * Math.PI) * 7;
      camera.updateProjectionMatrix();
      if (raw >= 1) {
        el.warp.style.opacity = '0';
        camera.fov = FOV;
        camera.updateProjectionMatrix();
        finishTransition();
      }
    } else if (el.warp.style.opacity !== '0') {
      el.warp.style.opacity = '0';
    }

    // ---- camera rig
    controls.update();
    var target = app.to ? app.to.userData.center : controls.target;
    controls.target.lerp(target, 0.18);
    app.dir.subVectors(camera.position, controls.target);
    if (app.dir.lengthSq() < 1e-9) app.dir.set(0.55, 0.34, 0.76);
    app.dir.normalize();
    app.dist += (app.distTarget - app.dist) * Math.min(1, dt * 7.5);
    camera.position.copy(controls.target).addScaledVector(app.dir, app.dist);
    camera.lookAt(controls.target);

    // ---- per-level animation
    if (app.to && app.to.userData.tick) app.to.userData.tick(t, dt);
    if (app.from && app.from !== app.to && app.from.userData.tick) app.from.userData.tick(t, dt);

    // ---- overlays
    if (app.to) {
      var ao = app.phase === 'moving' ? Math.max(0, 1 - Math.abs((now - app.t0) / TRANSITION_MS - 0.5) * 4) : 1;
      updateAnnotations(app.to, ao);
    }
    if (app.autoRotate) controls.autoRotate = true;
    updateDoor(now);
    updateScaleBar();

    renderer.render(scene, camera);
  }

  /* -------------------------------------------------------------------- boot */
  function boot() {
    lang = readStoredLang();
    paintChrome();
    buildRail();
    initDoors();
    app.total = LEVELS.length;
    var first = getLevel(0);
    measure(first);
    app.to = first;
    app.from = first;
    first.visible = true;
    first.scale.setScalar(1);
    controls.target.copy(first.userData.center);
    app.dist = first.userData.fit;
    app.distTarget = first.userData.fit;
    camera.position.copy(controls.target).addScaledVector(app.dir, app.dist);
    camera.near = Math.max(app.dist * 0.004, 1e-4);
    camera.far = app.dist * 400;
    camera.updateProjectionMatrix();
    controls.update();
    paintPanel(0);
    setDoor(0);
    buildAnnotations(first);
    positionShadow(first);
    resize();
    el.warp.style.opacity = '0';
    document.body.classList.add('ready');
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 0);
  } else {
    window.addEventListener('DOMContentLoaded', boot);
  }
  window.SCALE_APP = app;
  // exposed for debugging / inspection from the console
  app.camera = camera;
  app.scene = scene;
  app.controls = controls;
  app.fitDistance = fitDistance;
  app.measure = measure;
  app.goTo = goTo;
  app.LEVELS = LEVELS;
  app.LINKS = LINKS;
  app.findDoor = findDoor;
  app.setDoor = setDoor;
  app.updateDoor = updateDoor;
  app.getDoorMark = function () { return doorMark; };
  app.setLang = setLang;
  app.cycleLang = cycleLang;
  app.getLang = function () { return lang; };
  app.I18N = I18N;
  app.t = t;
  app.LV = LV;
  app.LNK = LNK;
  app.annoText = annoText;
  app.merge = merge;
  app.langDef = langDef;
  app.paintChrome = paintChrome;
})();
