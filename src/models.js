/* =============================================================================
   SCALE — procedural 3D models
   Every model is generated from maths at load time: no .glb downloads, no
   external assets. Each builder returns a THREE.Group whose userData carries
   { annotations, unitMeters, zoom, tick }.
   ========================================================================== */
(function () {
  'use strict';
  var T = window.THREE;
  var TAU = Math.PI * 2;
  var SCALE = (window.SCALE = window.SCALE || {});

  /* ---------------------------------------------------------------- palette */
  var C = {
    skin: 0x5b86e0,
    skinDeep: 0x3d63b8,
    bone: 0xf1ead9,
    boneShade: 0xd9cfb6,
    brain: 0xe9a8bd,
    lung: 0xf0a6ad,
    heart: 0xd9455f,
    liver: 0x8e4a3c,
    stomach: 0xdfa066,
    kidney: 0x9c5b52,
    gut: 0xd9a06a,
    cellBody: 0x8fd8cc,
    nucleusSoft: 0x6b7ff0,
    nucleolus: 0x3b4fc9,
    mito: 0xe2714b,
    er: 0xc98ad6,
    golgi: 0xf0b040,
    ribosome: 0x7a8fa6,
    envelope: 0x9d8ff0,
    chromatin: 0x7a6bd8,
    chromatid: 0x7f6be0,
    centromere: 0x4a3fb0,
    strandA: 0x3f6fd8,
    strandB: 0x2fa88f,
    atomC: 0x46586b,
    atomN: 0x3b6fe0,
    atomO: 0xe0473b,
    atomP: 0xe08a2b,
    proton: 0xe0503f,
    neutron: 0x4a7fe0,
    gluon: 0xf0c040,
    electron: 0x3f8fdd,
    up: 0xe0473b,
    down: 0x3b7fe0
  };

  /* --------------------------------------------------------------- material */
  function std(color, o) {
    o = o || {};
    var m = new T.MeshPhysicalMaterial({
      color: color,
      roughness: o.roughness !== undefined ? o.roughness : 0.42,
      metalness: o.metalness !== undefined ? o.metalness : 0.05,
      clearcoat: o.clearcoat !== undefined ? o.clearcoat : 0.18,
      clearcoatRoughness: o.clearcoatRoughness !== undefined ? o.clearcoatRoughness : 0.28,
      flatShading: !!o.flat,
      side: o.side || T.FrontSide
    });
    m.envMapIntensity = o.envMapIntensity !== undefined ? o.envMapIntensity : 0.85;
    if (o.emissive) {
      m.emissive = new T.Color(o.emissive);
      m.emissiveIntensity = o.emissiveIntensity !== undefined ? o.emissiveIntensity : 0.6;
    }
    if (o.opacity !== undefined) {
      m.transparent = true;
      m.opacity = o.opacity;
      m.depthWrite = o.depthWrite !== undefined ? o.depthWrite : false;
    }
    return m;
  }

  /** Translucent shell used for membranes, envelopes, boundaries. */
  function shell(color, opacity, o) {
    o = o || {};
    var m = new T.MeshPhysicalMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      roughness: o.roughness !== undefined ? o.roughness : 0.12,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.25,
      side: o.side || T.DoubleSide,
      depthWrite: false,
      blending: o.additive ? T.AdditiveBlending : T.NormalBlending
    });
    return m;
  }

  /* ------------------------------------------------------------------ noise */
  function hash3(x, y, z) {
    var s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function noise3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    function c(a, b, d) { return hash3(xi + a, yi + b, zi + d); }
    function lp(a, b, t) { return a + (b - a) * t; }
    var x00 = lp(c(0, 0, 0), c(1, 0, 0), u), x10 = lp(c(0, 1, 0), c(1, 1, 0), u);
    var x01 = lp(c(0, 0, 1), c(1, 0, 1), u), x11 = lp(c(0, 1, 1), c(1, 1, 1), u);
    return lp(lp(x00, x10, v), lp(x01, x11, v), w);
  }
  function fbm(x, y, z, oct) {
    oct = oct || 3;
    var a = 0.5, f = 1, s = 0, norm = 0;
    for (var i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); norm += a; f *= 2.03; a *= 0.5; }
    return s / norm;
  }
  /** Deterministic pseudo-random in [0,1). */
  function rng(seed) {
    var s = seed || 1;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /** Sphere-ish organic blob: icosphere displaced by fractal noise. */
  function blobGeometry(radius, detail, amp, seed) {
    var g = new T.IcosahedronGeometry(radius, detail || 3);
    var pos = g.attributes.position;
    var v = new T.Vector3();
    var s = (seed || 1) * 13.37;
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var n = fbm(v.x * 1.6 / radius + s, v.y * 1.6 / radius + s, v.z * 1.6 / radius + s, 3);
      var k = 1 + (n - 0.5) * 2 * amp;
      v.multiplyScalar(k);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }


  /* ------------------------------------------------------------------ build */
  function mesh(parent, geo, mat, px, py, pz) {
    var m = new T.Mesh(geo, mat);
    if (px !== undefined) m.position.set(px, py, pz);
    parent.add(m);
    return m;
  }

  /** Capsule stretched between two points — the workhorse for limbs and bones. */
  function limb(parent, a, b, r, mat) {
    var va = new T.Vector3(a[0], a[1], a[2]);
    var vb = new T.Vector3(b[0], b[1], b[2]);
    var dir = new T.Vector3().subVectors(vb, va);
    var len = dir.length();
    var geo = new T.CapsuleGeometry(r, Math.max(len - 2 * r, 0.0005), 6, 18);
    var m = new T.Mesh(geo, mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    parent.add(m);
    return m;
  }

  function tubeFrom(parent, points, radius, mat, closed, segs) {
    var curve = new T.CatmullRomCurve3(points.map(function (p) {
      return new T.Vector3(p[0], p[1], p[2]);
    }), !!closed);
    var geo = new T.TubeGeometry(curve, segs || 96, radius, 14, !!closed);
    return mesh(parent, geo, mat);
  }

  /** Helical spring between two points — used for gluon fields. */
  function springGeometry(a, b, turns, coilR, tubeR, segPerTurn) {
    var A = a.clone ? a.clone() : new T.Vector3(a[0], a[1], a[2]);
    var B = b.clone ? b.clone() : new T.Vector3(b[0], b[1], b[2]);
    var dir = new T.Vector3().subVectors(B, A);
    var n = Math.max(6, Math.round(turns * (segPerTurn || 10)));
    var up = new T.Vector3(0, 1, 0);
    if (Math.abs(dir.clone().normalize().dot(up)) > 0.94) up.set(1, 0, 0);
    var n1 = new T.Vector3().crossVectors(dir, up).normalize();
    var n2 = new T.Vector3().crossVectors(dir, n1).normalize();
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var ang = t * turns * TAU;
      pts.push(new T.Vector3()
        .copy(A)
        .addScaledVector(dir, t)
        .addScaledVector(n1, Math.cos(ang) * coilR)
        .addScaledVector(n2, Math.sin(ang) * coilR));
    }
    return new T.TubeGeometry(new T.CatmullRomCurve3(pts), n * 2, tubeR, 8, false);
  }

  /** Soft radial-gradient texture, used for glows and contact shadows. */
  function radialTexture(stops, size) {
    size = size || 128;
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    var grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { grd.addColorStop(s[0], s[1]); });
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  var _glowTex = null;
  function glowTexture() {
    if (!_glowTex) {
      _glowTex = radialTexture([
        [0, 'rgba(255,255,255,1)'],
        [0.25, 'rgba(190,220,255,0.55)'],
        [1, 'rgba(140,190,255,0)']
      ], 128);
    }
    return _glowTex;
  }

  function glowSprite(parent, color, size, opacity) {
    var mat = new T.SpriteMaterial({
      map: glowTexture(),
      color: color,
      transparent: true,
      opacity: opacity !== undefined ? opacity : 0.9,
      depthWrite: false,
      blending: T.AdditiveBlending
    });
    var sp = new T.Sprite(mat);
    sp.scale.set(size, size, 1);
    parent.add(sp);
    return sp;
  }

  function anno(g, x, y, z, text, tone) {
    g.userData.annotations.push({ p: [x, y, z], text: text, tone: tone || 'a' });
  }

  function level(zoom, unitMeters) {
    var g = new T.Group();
    g.userData.annotations = [];
    g.userData.zoom = zoom || 2.6;
    if (unitMeters) g.userData.unitMeters = unitMeters;
    return g;
  }

  /**
   * Door anchor - the spot inside this model where the NEXT level down lives.
   * It is parented into the model (never positioned in world space) so it
   * inherits every rotation, scale and animation the model applies to itself.
   * `r` is the radius of the ring the app should draw around it, in the
   * parent's local units.
   */
  function door(parent, x, y, z, r) {
    var o = new T.Object3D();
    o.name = 'door';
    o.position.set(x, y, z);
    o.userData.r = r;
    parent.add(o);
    return o;
  }

  /* ==========================================================================
     Shared human proportions (metres, feet at y = 0, head top at y = 1.70)
     ====================================================================== */
  var H = {
    top: 1.70,
    head: [0, 1.585, 0],
    headR: 0.104,
    neck: [0, 1.462, 0],
    shoulder: [0.185, 1.362, 0],
    elbow: [0.222, 1.095, 0.012],
    wrist: [0.246, 0.845, 0.028],
    hip: [0.088, 0.905, 0],
    knee: [0.092, 0.472, 0.012],
    ankle: [0.092, 0.062, -0.005],
    toe: [0.092, 0.032, 0.095]
  };
  function mirror(p, s) { return [p[0] * s, p[1], p[2]]; }

  var TORSO_PROFILE = [
    [0.115, 0.885], [0.128, 0.925], [0.132, 0.975], [0.140, 1.045],
    [0.150, 1.115], [0.157, 1.185], [0.160, 1.245], [0.155, 1.305],
    [0.132, 1.352], [0.100, 1.392], [0.070, 1.420], [0.052, 1.438]
  ];

  function bodyMaterial(opacity) {
    if (opacity !== undefined) {
      // Ghosts and silhouettes: at 5-10% opacity no surface detail is visible,
      // so skip the maps and keep those passes cheap.
      return std(C.skin, { roughness: 0.34, metalness: 0.16, opacity: opacity });
    }
    return std(C.skin, { roughness: 0.36, metalness: 0.10 });
  }

  /** The humanoid silhouette, reused by the body, skeleton and organ levels. */
  function buildFigure(parent, mat, detail) {
    detail = detail === undefined ? 1 : detail;
    var seg = detail ? 32 : 16;

    var head = mesh(parent, new T.SphereGeometry(H.headR, seg, Math.round(seg * 0.75)), mat, H.head[0], H.head[1], H.head[2]);
    head.scale.set(0.93, 1.14, 1.0);

    mesh(parent, new T.CylinderGeometry(0.049, 0.062, 0.10, seg, 1), mat, 0, 1.462, 0.004);

    var torso = new T.LatheGeometry(
      TORSO_PROFILE.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg);
    var tm = mesh(parent, torso, mat, 0, 0, 0);
    tm.scale.set(1.0, 1.0, 0.74);

    var pelvis = mesh(parent, new T.SphereGeometry(0.132, seg, Math.round(seg * 0.7)), mat, 0, 0.895, 0);
    pelvis.scale.set(1.02, 0.86, 0.78);

    [1, -1].forEach(function (s) {
      mesh(parent, new T.SphereGeometry(0.076, seg, Math.round(seg * 0.7)), mat, s * H.shoulder[0], H.shoulder[1], 0);
      limb(parent, mirror(H.shoulder, s), mirror(H.elbow, s), 0.049, mat);
      limb(parent, mirror(H.elbow, s), mirror(H.wrist, s), 0.041, mat);
      var hand = mesh(parent, new T.SphereGeometry(0.048, seg, Math.round(seg * 0.7)), mat,
        s * (H.wrist[0] + 0.006), H.wrist[1] - 0.062, H.wrist[2] + 0.004);
      hand.scale.set(0.78, 1.18, 0.6);
      limb(parent, mirror(H.hip, s), mirror(H.knee, s), 0.077, mat);
      limb(parent, mirror(H.knee, s), mirror(H.ankle, s), 0.056, mat);
      var foot = mesh(parent, new T.BoxGeometry(0.088, 0.062, 0.215), mat, s * 0.092, 0.036, 0.045);
      foot.geometry.translate(0, 0, 0);
    });
    return parent;
  }

  /* ==========================================================================
     LEVEL 1 — Human body
     ====================================================================== */
  function buildBody() {
    var g = level(2.5, 1);
    var skin = bodyMaterial();
    buildFigure(g, skin, 1);

    // a soft inner glow so the silhouette reads against a pale background
    var rim = buildFigure(new T.Group(), shell(0x9dc0ff, 0.10, { side: T.BackSide }), 0);
    rim.scale.setScalar(1.045);
    rim.position.y = 0.0;
    g.add(rim);

    g.position.y = -0.85;

    anno(g, 0, 1.735, 0, 'Head · 23 cm', 'a');
    anno(g, 0.20, 1.19, 0.09, 'Heart · 12 cm', 'b');
    anno(g, 0.30, 0.79, 0.05, 'Hand · 19 cm', 'c');
    anno(g, 0.14, 0.03, 0.16, 'Foot · 26 cm', 'a');
    anno(g, -0.30, 0.60, 0.0, 'Femur · 48 cm', 'b');
    anno(g, -0.42, 1.62, 0.0, '1.7 m tall', 'c');
    anno(g, 0.00, 0.85, 0.22, 'Torso · 60 cm', 'a');
    anno(g, 0.38, 1.40, -0.08, 'Pelvis · 30 cm', 'b');

    // door: the chest, where the skeleton sits just under the skin
    door(g, 0, 1.24, 0.10, 0.17);

    g.userData.unitMeters = 1;
    g.userData.tick = function (t) { };
    return g;
  }

  /* ==========================================================================
     LEVEL 2 — Skeleton
     ====================================================================== */
  function buildSkeleton() {
    var g = level(2.5, 1);
    var bone = std(C.bone, { roughness: 0.54, metalness: 0.02 });
    var boneDim = std(C.boneShade, { roughness: 0.62 });

    // translucent body outline for context
    var ghost = buildFigure(new T.Group(), bodyMaterial(0.055), 0);
    ghost.traverse(function (o) { if (o.isMesh) o.renderOrder = -1; });
    g.add(ghost);

    // skull
    var socket = std(0x9c9484, { roughness: 0.85 });
    var skull = mesh(g, new T.SphereGeometry(0.098, 26, 20), bone, 0, 1.590, 0.004);
    skull.scale.set(0.90, 1.04, 1.0);
    var jaw = mesh(g, new T.SphereGeometry(0.062, 20, 14), bone, 0, 1.506, 0.034);
    jaw.scale.set(1.0, 0.58, 1.12);
    [1, -1].forEach(function (s) {
      var eye = mesh(g, new T.SphereGeometry(0.027, 12, 10), socket, s * 0.038, 1.556, 0.072);
      eye.scale.set(1.0, 1.05, 0.55);
    });
    mesh(g, new T.ConeGeometry(0.020, 0.034, 10), socket, 0, 1.526, 0.082).rotation.x = 0.35;
    mesh(g, new T.BoxGeometry(0.135, 0.016, 0.030), bone, 0, 1.585, 0.074).rotation.x = 0.18;

    // spine: 24 vertebrae following a gentle S-curve
    for (var i = 0; i < 24; i++) {
      var y = 1.428 - i * 0.0215;
      var z = -0.030 * Math.sin(((1.428 - y) / 0.52) * Math.PI * 1.05) + 0.012;
      var r = 0.036 - Math.abs(i - 12) * 0.0004 + (i > 16 ? 0.004 : 0);
      mesh(g, new T.CylinderGeometry(r, r * 1.06, 0.012, 10, 1), bone, 0, y, z);
      mesh(g, new T.SphereGeometry(r * 0.62, 10, 8), boneDim, 0, y - 0.012, z - 0.004);
    }

    // ribcage: each rib sweeps from the spine, round one side, to the sternum
    for (var k = 0; k < 10; k++) {
      var ry = 1.340 - k * 0.0345;
      var rr = 0.098 + 0.070 * Math.sin((Math.PI * (k + 0.8)) / 11.2);
      var tilt = -(0.10 + k * 0.030);
      [1, -1].forEach(function (s) {
        var holder = new T.Group();
        holder.position.set(0, ry, -0.014);
        holder.scale.set(1, 1, 0.78);
        var rib = new T.Mesh(new T.TorusGeometry(rr, 0.0095, 6, 44, Math.PI), bone);
        rib.rotation.set(Math.PI / 2 + tilt, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2);
        holder.add(rib);
        g.add(holder);
      });
    }
    var sternum = mesh(g, new T.BoxGeometry(0.050, 0.180, 0.018), bone, 0, 1.232, 0.104);
    sternum.rotation.x = -0.10;

    // clavicles + scapulae
    [1, -1].forEach(function (s) {
      limb(g, [0, 1.400, 0.030], [s * 0.170, 1.362, 0.042], 0.013, bone);
      var sc = mesh(g, new T.SphereGeometry(0.062, 14, 10), bone, s * 0.128, 1.298, -0.072);
      sc.scale.set(1.0, 1.25, 0.32);
    });

    // pelvis
    [1, -1].forEach(function (s) {
      var il = mesh(g, new T.SphereGeometry(0.082, 16, 12), bone, s * 0.082, 0.902, -0.006);
      il.scale.set(0.72, 0.92, 0.58);
      limb(g, [s * 0.088, 0.900, 0], mirror(H.hip, s), 0.028, bone);
    });
    mesh(g, new T.BoxGeometry(0.115, 0.048, 0.062), bone, 0, 0.845, -0.020);

    // limbs
    [1, -1].forEach(function (s) {
      limb(g, mirror(H.shoulder, s), mirror(H.elbow, s), 0.0195, bone);
      limb(g, mirror(H.elbow, s), mirror(H.wrist, s), 0.0145, bone);
      limb(g, [s * (H.elbow[0] - 0.016), H.elbow[1], H.elbow[2] + 0.012], [s * (H.wrist[0] - 0.014), H.wrist[1], H.wrist[2] + 0.012], 0.0105, bone);
      var hand = new T.Group();
      hand.position.set(s * (H.wrist[0] + 0.004), H.wrist[1] - 0.050, H.wrist[2] + 0.004);
      mesh(hand, new T.BoxGeometry(0.028, 0.052, 0.050), bone, 0, 0, 0);
      for (var fi = 0; fi < 4; fi++) {
        var fz = -0.017 + fi * 0.0115;
        limb(hand, [0, -0.024, fz], [0, -0.062, fz * 1.2], 0.0044, bone);
      }
      limb(hand, [0, -0.010, 0.022], [0, -0.030, 0.040], 0.0050, bone);
      g.add(hand);
      limb(g, mirror(H.hip, s), mirror(H.knee, s), 0.0245, bone);
      limb(g, mirror(H.knee, s), mirror(H.ankle, s), 0.0185, bone);
      limb(g, [s * (H.knee[0] + 0.018), H.knee[1] - 0.01, H.knee[2]], [s * (H.ankle[0] + 0.018), H.ankle[1] + 0.02, H.ankle[2]], 0.0105, bone);
      mesh(g, new T.SphereGeometry(0.026, 12, 10), bone, s * H.knee[0], H.knee[1] + 0.012, H.knee[2] + 0.038).scale.set(1, 1.1, 0.5);
      mesh(g, new T.BoxGeometry(0.062, 0.032, 0.185), bone, s * 0.092, 0.022, 0.040);
    });

    g.position.y = -0.85;

    anno(g, 0.13, 1.70, 0, 'Skull · 22 bones', 'a');
    anno(g, -0.24, 1.20, 0.09, 'Ribcage · 24 ribs', 'b');
    anno(g, 0.20, 0.66, 0.03, 'Femur · 48 cm', 'c');
    anno(g, -0.16, 1.44, -0.06, 'Spine · 33 vertebrae', 'a');
    anno(g, 0.30, 0.86, 0.05, 'Hand · 27 bones', 'b');
    anno(g, -0.28, 0.98, -0.12, 'Pelvis · 26 bones', 'c');
    anno(g, 0.02, 1.52, 0.12, 'Jaw · 14 bones', 'a');

    // door: inside the ribcage, where the organs are held
    door(g, 0, 1.18, 0.02, 0.16);

    g.userData.unitMeters = 1;
    g.userData.tick = function () { };
    return g;
  }

  /* ==========================================================================
     LEVEL 3 — Organs
     ====================================================================== */
  function buildOrgans() {
    var g = level(2.4, 0.258);
    var bodyMat = bodyMaterial(0.10);

    // torso silhouette, ~2.4 units tall = 62 cm
    var profile = [
      [0.36, -1.15], [0.40, -0.95], [0.42, -0.70], [0.41, -0.42],
      [0.42, -0.12], [0.45, 0.18], [0.49, 0.46], [0.52, 0.72],
      [0.50, 0.92], [0.42, 1.04], [0.26, 1.12], [0.17, 1.18]
    ];
    var torso = mesh(g, new T.LatheGeometry(profile.map(function (p) { return new T.Vector2(p[0], p[1]); }), 40), bodyMat);
    torso.scale.set(1.0, 1.0, 0.72);
    var neck = mesh(g, new T.CylinderGeometry(0.17, 0.22, 0.22, 24), bodyMat, 0, 1.28, 0.01);
    var head = mesh(g, new T.SphereGeometry(0.34, 28, 20), bodyMat, 0, 1.62, 0.01);
    head.scale.set(0.93, 1.12, 1.0);
    [1, -1].forEach(function (s) {
      mesh(g, new T.SphereGeometry(0.24, 20, 14), bodyMat, s * 0.62, 0.88, 0);
      limb(g, [s * 0.60, 0.82, 0], [s * 0.84, 0.05, 0.02], 0.15, bodyMat);
    });
    g.children.forEach(function (o) { if (o.isMesh) o.renderOrder = 4; });

    /* ---- brain
       Real cortex is deeply folded; the folds are what make it readable as a
       brain rather than a pink stone, so push the displacement hard and give
       it the fine tissue grain on top. */
    var brainMat = std(C.brain, { roughness: 0.52 });
    var brain = mesh(g, blobGeometry(0.26, 5, 0.155, 7), brainMat, 0, 1.62, 0.01);
    brain.scale.set(1.0, 0.86, 1.06);
    var stem = limb(g, [0, 1.44, -0.02], [0, 1.20, 0.02], 0.048,
      std(0xc98fa4, { roughness: 0.55 }));

    /* ---- trachea + lungs */
    var airway = std(0xd8c2c6, { roughness: 0.48 });
    limb(g, [0, 1.16, 0.06], [0, 0.62, 0.06], 0.048, airway);
    [1, -1].forEach(function (s) {
      var lung = mesh(g, blobGeometry(0.30, 5, 0.10, s > 0 ? 3 : 9),
        std(C.lung, { roughness: 0.55 }), s * 0.33, 0.50, 0.01);
      lung.scale.set(0.82, 1.55, 0.80);
      limb(g, [0, 0.66, 0.06], [s * 0.22, 0.78, 0.03], 0.032, airway);
      limb(g, [s * 0.22, 0.78, 0.03], [s * 0.36, 0.62, 0.02], 0.022, airway);
      limb(g, [s * 0.22, 0.78, 0.03], [s * 0.30, 0.86, -0.02], 0.020, airway);
    });

    /* ---- heart: wet, glossy, high relief */
    var heartMat = std(C.heart, { roughness: 0.40, metalness: 0.06 });
    var heart = new T.Group();
    heart.position.set(0.07, 0.42, 0.13);
    mesh(heart, blobGeometry(0.20, 5, 0.085, 21), heartMat, -0.045, 0.055, 0);
    mesh(heart, blobGeometry(0.18, 5, 0.085, 22), heartMat, 0.055, 0.045, 0);
    var apex = mesh(heart, new T.ConeGeometry(0.155, 0.30, 22, 1, true), heartMat, 0.005, -0.12, 0.01);
    apex.rotation.x = Math.PI;
    var aorta = new T.Group();
    tubeFrom(aorta, [[0.0, 0.16, 0.0], [0.02, 0.30, -0.02], [0.06, 0.44, -0.06], [0.10, 0.52, -0.02]], 0.052,
      std(0xc23a52, { roughness: 0.44 }), false, 40);
    tubeFrom(aorta, [[-0.10, 0.12, 0.02], [-0.16, 0.28, 0.0], [-0.14, 0.44, -0.04]], 0.036,
      std(0x4a6fc0, { roughness: 0.44 }), false, 30);
    heart.add(aorta);
    g.add(heart);

    /* ---- liver / stomach / kidneys / gut */
    var liver = mesh(g, blobGeometry(0.34, 5, 0.10, 31),
      std(C.liver, { roughness: 0.46 }), -0.26, 0.04, 0.05);
    liver.scale.set(1.05, 0.62, 0.80);
    var stomach = mesh(g, blobGeometry(0.24, 5, 0.10, 41),
      std(C.stomach, { roughness: 0.46 }), 0.24, 0.10, 0.02);
    stomach.scale.set(0.92, 1.20, 0.78);
    [1, -1].forEach(function (s) {
      var kid = mesh(g, blobGeometry(0.13, 4, 0.10, s > 0 ? 51 : 53),
        std(C.kidney, { roughness: 0.46 }), s * 0.27, -0.02, -0.14);
      kid.scale.set(0.78, 1.25, 0.80);
    });

    // gut: a coiled tube
    var gutPts = [];
    for (var i = 0; i <= 60; i++) {
      var t = i / 60;
      var ang = t * TAU * 3.4;
      var rad = 0.30 - 0.10 * t + 0.05 * Math.sin(t * 9);
      gutPts.push([Math.cos(ang) * rad, 0.02 - t * 1.02, Math.sin(ang) * rad * 0.72 + 0.02]);
    }
    tubeFrom(g, gutPts, 0.062, std(C.gut, { roughness: 0.5 }), false, 260);

    // door: the surface of the right lung, lined with epithelium
    door(g, 0.33, 0.50, 0.28, 0.20);
    mesh(g, new T.SphereGeometry(0.10, 16, 12),
      std(0xd8c07a, { roughness: 0.5 }), 0, -1.02, 0.06).scale.set(1, 0.85, 0.9);

    anno(g, 0, 1.98, 0.02, 'Brain · 1.3 kg', 'a');
    anno(g, -0.42, 0.50, 0.02, 'Lungs · 480 M alveoli', 'b');
    anno(g, 0.30, 0.56, 0.20, 'Heart · 5 L/min', 'c');
    anno(g, -0.52, 0.10, 0.10, 'Liver · 1.5 kg', 'b');
    anno(g, 0.46, 0.14, 0.05, 'Stomach', 'a');
    anno(g, 0.44, -0.06, -0.20, 'Kidney ×2', 'c');
    anno(g, -0.10, -1.05, 0.30, 'Small intestine · 6 m', 'b');
    anno(g, 0.10, 1.26, -0.08, 'Trachea', 'a');
    anno(g, -0.36, 0.18, -0.24, 'Aorta', 'c');

    g.userData.tick = function () { };
    return g;
  }

  /* ==========================================================================
     LEVEL 4 — Tissue (epithelium slab)
     ====================================================================== */
  function buildTissue() {
    var g = level(2.5);
    var R = 0.44;
    var dx = R * Math.sqrt(3);
    var dz = R * 1.5;
    var cols = 8, rows = 7;
    var h = 1.05;

    var bodyMat = std(C.cellBody, { roughness: 0.28, metalness: 0.02, opacity: 0.66, side: T.DoubleSide });
    var nucMat = std(0x4666d8, { roughness: 0.45 });

    var rnd = rng(17);
    var cx = (cols - 1) * dx / 2;
    var cz = (rows - 1) * dz / 2;

    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var x = i * dx - cx + (j % 2 ? dx / 2 : 0);
        var z = j * dz - cz;
        var taller = 1 + (rnd() - 0.5) * 0.16;
        var geo = new T.CylinderGeometry(R, R, h * taller, 6, 1);
        var c = mesh(g, geo, bodyMat, x, h * taller / 2, z);
        c.rotation.y = Math.PI / 6;
        var nuc = mesh(g, new T.SphereGeometry(0.155, 14, 12), nucMat, x, h * taller * 0.42, z);
        nuc.scale.set(1, 0.9, 1);
      }
    }

    // basement membrane
    var bm = mesh(g, new T.PlaneGeometry(cols * dx + 1.4, rows * dz + 1.4), std(0xbfded8, { roughness: 0.8, opacity: 0.9 }), 0, -0.012, 0);
    bm.rotation.x = -Math.PI / 2;

    // one cell lifted clear of the sheet, as a specimen
    var spec = new T.Group();
    spec.position.set(cx * 0.62, h * 1.05, cz * 0.74);
    mesh(spec, new T.CylinderGeometry(R, R, h, 6, 1), bodyMat, 0, 0, 0).rotation.y = Math.PI / 6;
    mesh(spec, new T.SphereGeometry(0.155, 16, 12), nucMat, 0, h * 0.10, 0);
    g.add(spec);

    g.position.y = -h * 0.5;

    // door: the specimen cell lifted clear of the sheet
    door(g, spec.position.x, spec.position.y, spec.position.z, 0.46);
    anno(g, spec.position.x, spec.position.y + h * 0.72, spec.position.z, 'Columnar cell · 20 µm', 'a');
    anno(g, -1.9, 0.30, 0.6, 'Nucleus', 'b');
    anno(g, 0.42, 0.60, 1.99, 'Tight junction', 'c');
    anno(g, 0.4, -0.16, 2.1, 'Basement membrane', 'a');
    anno(g, -2.6, 0.95, -1.4, '2 mm of tissue ≈ 100,000 cells', 'b');
    anno(g, 1.75, 0.12, 0.95, 'Epithelium', 'a');
    anno(g, -1.10, 1.10, -1.10, 'Cell sheet', 'c');

    g.userData.unitMeters = 0.002 / (cols * dx + R);
    g.userData.tick = function () { };
    return g;
  }

  /* ==========================================================================
     LEVEL 5 — The cell
     ====================================================================== */
  function buildCell() {
    var g = level(2.6, 1e-5);
    var rnd = rng(101);

    // membrane
    var memGeo = blobGeometry(1.0, 4, 0.075, 5);
    var mem = mesh(g, memGeo, shell(0x8fd4ff, 0.13));
    mem.renderOrder = 20;
    var rim = mesh(g, memGeo.clone(), shell(0x4aa8ff, 0.13, { additive: true, side: T.BackSide }));
    rim.scale.setScalar(1.006);
    rim.renderOrder = 21;

    // nucleus
    var nuc = mesh(g, blobGeometry(0.34, 4, 0.055, 11), std(C.nucleusSoft, { roughness: 0.4, opacity: 0.92 }), -0.16, 0.10, 0.06);
    mesh(g, blobGeometry(0.115, 3, 0.10, 12), std(C.nucleolus, { roughness: 0.45 }), -0.22, 0.02, 0.10);
    // nuclear pores
    for (var i = 0; i < 18; i++) {
      var v = fibPoint(i, 18, 0.345);
      var ring = mesh(g, new T.TorusGeometry(0.035, 0.011, 6, 14), std(0xb9a8f0, { roughness: 0.4 }), v.x - 0.16, v.y + 0.10, v.z + 0.06);
      ring.lookAt(new T.Vector3(v.x * 3 - 0.16, v.y * 3 + 0.10, v.z * 3 + 0.06));
    }

    // mitochondria
    var mitoShell = shell(C.mito, 0.55);
    var cristae = std(0xb8482a, { roughness: 0.5 });
    var mitoSpots = [[0.42, -0.34, 0.28], [-0.46, -0.42, -0.20], [0.24, 0.52, -0.42],
    [-0.30, 0.46, 0.44], [0.58, 0.16, -0.10], [-0.62, 0.02, 0.30]];
    mitoSpots.forEach(function (p, idx) {
      var mg = new T.Group();
      mg.position.set(p[0], p[1], p[2]);
      mg.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      var body = mesh(mg, new T.CapsuleGeometry(0.078, 0.20, 4, 16), mitoShell);
      var pts = [];
      for (var s = 0; s <= 14; s++) {
        var t = s / 14;
        pts.push([Math.sin(t * Math.PI * 4.2) * 0.055, (t - 0.5) * 0.30, Math.cos(t * Math.PI * 4.2) * 0.055]);
      }
      tubeFrom(mg, pts, 0.017, cristae, false, 60);
      g.add(mg);
    });

    // rough endoplasmic reticulum wrapped around the nucleus
    var erPts = [];
    for (var e = 0; e <= 46; e++) {
      var t2 = e / 46;
      var ang = t2 * TAU * 2.1;
      var rr = 0.48 + 0.10 * Math.sin(t2 * 7);
      erPts.push([Math.cos(ang) * rr - 0.14, (t2 - 0.5) * 0.85, Math.sin(ang) * rr * 0.85 + 0.05]);
    }
    tubeFrom(g, erPts, 0.042, std(C.er, { roughness: 0.45 }), false, 200);
    for (var rb = 0; rb < 26; rb++) {
      var q = erPts[Math.floor(rnd() * erPts.length)];
      mesh(g, new T.SphereGeometry(0.024, 8, 6), std(C.ribosome, { roughness: 0.6 }),
        q[0] + (rnd() - 0.5) * 0.1, q[1] + (rnd() - 0.5) * 0.1, q[2] + (rnd() - 0.5) * 0.1);
    }

    // golgi stacks
    var gg = new T.Group();
    gg.position.set(0.40, -0.06, 0.38);
    gg.rotation.set(0.3, -0.6, 0.15);
    for (var s2 = 0; s2 < 5; s2++) {
      var disc = mesh(gg, new T.TorusGeometry(0.20 - s2 * 0.012, 0.030, 8, 26), std(C.golgi, { roughness: 0.4 }), 0, s2 * 0.062 - 0.12, 0);
      disc.scale.set(1, 0.5, 1);
    }
    g.add(gg);

    // free ribosomes + vesicles + cytoskeleton
    for (var f = 0; f < 70; f++) {
      var p2 = randomInSphere(rnd, 0.9);
      mesh(g, new T.SphereGeometry(0.018, 6, 5), std(C.ribosome, { roughness: 0.6 }), p2.x, p2.y, p2.z);
    }
    for (var v2 = 0; v2 < 9; v2++) {
      var p3 = randomInSphere(rnd, 0.8);
      mesh(g, new T.SphereGeometry(0.05 + rnd() * 0.03, 12, 10), shell(0xb9d8f0, 0.6), p3.x, p3.y, p3.z);
    }
    var filament = std(0x9fb3c8, { roughness: 0.5, opacity: 0.55 });
    for (var k2 = 0; k2 < 16; k2++) {
      var a2 = randomInSphere(rnd, 0.85), b2 = randomInSphere(rnd, 0.85);
      if (a2.distanceTo(b2) < 0.5) continue;
      limb(g, [a2.x, a2.y, a2.z], [b2.x, b2.y, b2.z], 0.008, filament);
    }

    anno(g, 0.0, 1.10, 0.0, 'Plasma membrane · 5 nm', 'a');
    anno(g, -0.50, 0.30, 0.30, 'Nucleus', 'b');
    anno(g, 0.66, -0.46, 0.42, 'Mitochondrion', 'c');
    anno(g, -0.72, -0.52, -0.30, 'Rough ER', 'b');
    anno(g, 0.52, 0.10, 0.72, 'Golgi apparatus', 'a');
    anno(g, 0.30, -0.86, -0.30, 'Ribosomes', 'c');
    anno(g, -1.12, 0.64, -0.35, 'Cytosol', 'a');
    anno(g, 0.82, 0.82, -0.70, 'Cell membrane', 'b');

    // door: the nucleus, the control room
    door(g, -0.16, 0.10, 0.06, 0.42);

    g.userData.tick = function (t) { g.rotation.y = t * 0.06; };
    return g;
  }

  /* ==========================================================================
     LEVEL 6 — Cell nucleus
     ====================================================================== */
  function buildNucleus() {
    var g = level(2.6, 3e-6);
    var rnd = rng(211);

    var envGeo = blobGeometry(1.0, 4, 0.045, 3);
    var env = mesh(g, envGeo, shell(C.envelope, 0.12));
    env.renderOrder = 20;
    var rim = mesh(g, envGeo.clone(), shell(0x6f5fe0, 0.12, { additive: true, side: T.BackSide }));
    rim.scale.setScalar(1.006);
    rim.renderOrder = 21;

    // nuclear pores distributed over the surface
    for (var i = 0; i < 30; i++) {
      var v = fibPoint(i, 30, 0.995);
      var pore = new T.Group();
      pore.position.copy(v);
      pore.lookAt(new T.Vector3(v.x * 2, v.y * 2, v.z * 2));
      mesh(pore, new T.TorusGeometry(0.062, 0.019, 6, 16), std(0xc3b4f5, { roughness: 0.35 }));
      mesh(pore, new T.CircleGeometry(0.05, 14), shell(0x4a3fb0, 0.35));
      g.add(pore);
    }

    // chromatin: tangled strands of DNA + protein
    var tones = [0x6b5fd0, 0x8f7de0, 0x5a4fc0];
    for (var c = 0; c < 16; c++) {
      var pts = [];
      var start = randomInSphere(rnd, 0.55);
      for (var s = 0; s < 8; s++) {
        var p = randomInSphere(rnd, 0.86);
        pts.push([p.x, p.y, p.z]);
      }
      pts.unshift([start.x, start.y, start.z]);
      tubeFrom(g, pts, 0.020 + rnd() * 0.012, std(tones[c % 3], { roughness: 0.45 }), false, 150);
    }

    // nucleolus
    mesh(g, blobGeometry(0.30, 4, 0.07, 61), std(0x4a3fb0, { roughness: 0.42 }), 0.26, -0.12, 0.16);
    mesh(g, blobGeometry(0.16, 3, 0.09, 62), std(0x3a2f96, { roughness: 0.42 }), -0.30, 0.30, -0.24);

    // protein speckles
    for (var k = 0; k < 60; k++) {
      var q = randomInSphere(rnd, 0.92);
      mesh(g, new T.SphereGeometry(0.016 + rnd() * 0.014, 6, 5), std(0x9d8ff0, { roughness: 0.5 }), q.x, q.y, q.z);
    }

    anno(g, 0.0, 1.14, 0.0, 'Nuclear envelope', 'a');
    anno(g, 0.86, 0.52, 0.42, 'Nuclear pore', 'c');
    anno(g, -0.62, 0.44, 0.36, 'Chromatin · 2 m of DNA', 'b');
    anno(g, 0.30, 0.06, 0.26, 'Nucleolus', 'a');
    anno(g, -0.30, -1.02, -0.20, '6 µm across', 'c');
    anno(g, 0.96, -0.56, -0.38, 'Nucleoplasm', 'a');
    anno(g, -0.94, 0.98, 0.52, 'Chromatin loop', 'b');

    // door: the first chromatin strand - the DNA that condenses into a
    // chromosome when this cell divides.
    var strand = null;
    g.traverse(function (o) {
      if (!strand && o.isMesh && o.geometry && o.geometry.type === 'TubeGeometry') strand = o;
    });
    if (strand && strand.geometry.parameters.path) {
      var dm = strand.geometry.parameters.path.getPoint(0.5);
      door(g, dm.x, dm.y, dm.z, 0.26);
    }

    g.userData.tick = function (t) { g.rotation.y = -t * 0.05; };
    return g;
  }

  /* ==========================================================================
     LEVEL 7 — Chromosome
     ====================================================================== */
  function chromatidPoints(sign) {
    var pts = [];
    var spine = [
      [0.34, 1.54, 0.00], [0.32, 1.16, 0.05], [0.26, 0.78, 0.02],
      [0.15, 0.38, -0.03], [0.050, 0.06, 0.00], [0.050, -0.10, 0.02],
      [0.15, -0.46, 0.03], [0.26, -0.88, 0.00], [0.32, -1.26, -0.04], [0.34, -1.58, 0.00]
    ];
    spine.forEach(function (p) { pts.push([p[0] * sign, p[1], p[2]]); });
    return pts;
  }

  function buildChromatid(parent, sign, scale, mat, segs) {
    var spine = chromatidPoints(sign);
    var curve = new T.CatmullRomCurve3(spine.map(function (p) {
      return new T.Vector3(p[0], p[1], p[2]);
    }));
    var n = segs || 60;
    var geo = new T.SphereGeometry(1, 12, 9);
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var p = curve.getPoint(t);
      var lump = 0.105 * (0.76 + 0.28 * Math.abs(Math.sin(t * 21.7)) + 0.10 * Math.sin(t * 7.3));
      var taper = 1 - 0.30 * Math.pow(Math.abs(t - 0.5) * 2, 6);
      var m = new T.Mesh(geo, mat);
      m.position.copy(p);
      m.scale.setScalar(lump * taper * scale);
      parent.add(m);
    }
    return curve;
  }

  function buildChromosome() {
    var g = level(2.5, 4.5e-7);

    // the hero chromosome
    var hero = new T.Group();
    var matA = std(C.chromatid, { roughness: 0.42, metalness: 0.06 });
    var matB = std(0x6a58d4, { roughness: 0.45, metalness: 0.05 });
    buildChromatid(hero, 1, 1, matA, 62);
    buildChromatid(hero, -1, 1, matB, 62);
    g.add(hero);

    // centromere: the waist that holds the two sisters together
    mesh(g, new T.CylinderGeometry(0.135, 0.135, 0.26, 24), std(C.centromere, { roughness: 0.5 }), 0, 0.0, 0.005);
    mesh(g, new T.TorusGeometry(0.148, 0.024, 8, 30), std(0x2f2a7a, { roughness: 0.5 }), 0, 0.0, 0.005)
      .rotation.x = Math.PI / 2;

    anno(g, 0.58, 0.92, 0.08, 'Chromatid', 'a');
    anno(g, -0.60, 1.30, 0.08, 'Sister chromatid', 'a');
    anno(g, 0.32, 0.02, 0.26, 'Centromere', 'c');
    anno(g, -0.52, -1.22, 0.08, 'One DNA molecule', 'b');
    anno(g, 0.0, 1.88, 0.0, '1.4 µm when condensed', 'b');
    anno(g, 0.62, -0.72, 0.18, 'Telomere', 'c');
    anno(g, -0.72, 0.38, 0.22, 'Histone core', 'a');

    // door: one arm of a chromatid - a single DNA molecule
    door(g, 0.29, -1.05, 0.0, 0.22);

    g.userData.tick = function (t) { g.rotation.y = t * 0.12; };
    return g;
  }

  /* ==========================================================================
     LEVEL 8 — DNA double helix
     ====================================================================== */
  function buildDNA() {
    var g = level(2.5, 1e-9);
    var N = 26;                 // base pairs
    var R = 1.0;                // helix radius (nm)
    var rise = 0.34;            // nm per base pair
    var twist = 36 * Math.PI / 180;
    var y0 = -(N - 1) * rise / 2;

    var baseColors = { A: 0xe0473b, T: 0xf0b429, G: 0x3fa85f, C: 0x3f8fdd };
    var seq = 'ATGCTAGGCATTCGACTGACCTAG'.split('');
    var half = [];

    var strandA = [], strandB = [];
    for (var i = 0; i < N; i++) {
      var a = i * twist;
      var b = a + Math.PI;
      var y = y0 + i * rise;
      strandA.push([Math.cos(a) * R, y, Math.sin(a) * R]);
      strandB.push([Math.cos(b) * R, y, Math.sin(b) * R]);
    }
    var matA = std(C.strandA, { roughness: 0.34, metalness: 0.12 });
    var matB = std(C.strandB, { roughness: 0.34, metalness: 0.12 });
    tubeFrom(g, strandA, 0.155, matA, false, 200);
    tubeFrom(g, strandB, 0.155, matB, false, 200);

    var geo = new T.CylinderGeometry(0.072, 0.072, 1, 10, 1, false);
    for (var k = 0; k < N; k++) {
      var A = new T.Vector3(strandA[k][0], strandA[k][1], strandA[k][2]);
      var B = new T.Vector3(strandB[k][0], strandB[k][1], strandB[k][2]);
      var base = seq[k % seq.length];
      var pair = { A: 'T', T: 'A', G: 'C', C: 'G' }[base];
      addRung(g, geo, A, B, baseColors[base]);
      addRung(g, geo, B, A, baseColors[pair]);
    }

    anno(g, 1.55, 0.9, 0.0, 'Sugar–phosphate backbone', 'a');
    anno(g, -1.35, -0.75, 0.4, 'Base pair (A–T / G–C)', 'c');
    anno(g, 0.0, y0 + (N - 1) * rise + 0.55, 0.0, '3.4 nm per full turn', 'b');
    anno(g, 0.0, y0 - 0.62, 0.0, '2 nm across', 'b');
    anno(g, 1.70, -1.20, 0.12, 'Major groove', 'a');
    anno(g, -1.80, 0.80, -0.20, 'Minor groove', 'c');

    // door: a base-pair rung, dead centre of the helix
    door(g, 0, y0 + 13 * rise, 0, 0.44);

    g.userData.tick = function (t) { g.rotation.y = t * 0.22; };
    return g;
  }

  function addRung(parent, geo, from, to, color) {
    var mid = new T.Vector3().addVectors(from, to).multiplyScalar(0.5);
    var dir = new T.Vector3().subVectors(mid, from);
    var len = dir.length();
    var m = new T.Mesh(geo, std(color, { roughness: 0.4 }));
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    parent.add(m);
  }

  /* ==========================================================================
     LEVEL 9 — Molecule (ATP)
     ====================================================================== */
  function buildMolecule() {
    var g = level(2.3);
    var ATOM_R = { C: 0.42, N: 0.40, O: 0.38, P: 0.47 };
    var ATOM_C = { C: C.atomC, N: C.atomN, O: C.atomO, P: C.atomP };

    // (x, y, element) in ångström — hydrogens omitted for clarity
    var atoms = [
      [1.400, 0.000, 'N'], [0.700, 1.212, 'C'], [-0.700, 1.212, 'N'], [-1.400, 0.000, 'C'],
      [-0.700, -1.212, 'C'], [0.700, -1.212, 'C'], [-1.636, -2.253, 'N'], [-2.915, -1.684, 'C'],
      [-2.769, -0.291, 'N'], [1.375, -2.381, 'N'],
      [-3.225, -0.493, 'C'], [-3.518, -1.873, 'C'], [-4.921, -2.020, 'C'], [-5.495, -0.732, 'C'],
      [-4.446, 0.212, 'O'], [-4.455, -2.913, 'O'], [-5.621, -3.232, 'O'], [-6.962, -0.420, 'C'],
      [-8.331, -0.129, 'O'],
      [-9.930, -0.290, 'P'], [-11.450, -0.770, 'O'], [-13.050, -0.610, 'P'],
      [-14.570, -0.130, 'O'], [-16.170, -0.290, 'P'],
      [-9.830, 1.210, 'O'], [-9.830, -1.790, 'O'],
      [-12.950, 0.890, 'O'], [-12.950, -2.110, 'O'],
      [-16.070, 1.210, 'O'], [-16.070, -1.790, 'O'], [-17.600, -0.290, 'O']
    ];
    var bonds = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
      [3, 8], [8, 7], [7, 6], [6, 4],
      [5, 9], [8, 10],
      [10, 11], [11, 12], [12, 13], [13, 14], [14, 10],
      [11, 15], [12, 16], [13, 17], [17, 18], [18, 19],
      [19, 20], [20, 21], [21, 22], [22, 23],
      [19, 24], [19, 25], [21, 26], [21, 27], [23, 28], [23, 29], [23, 30]
    ];

    // centre on the origin
    var cx = 0, cy = 0;
    atoms.forEach(function (a) { cx += a[0]; cy += a[1]; });
    cx /= atoms.length; cy /= atoms.length;

    var spheres = {};
    Object.keys(ATOM_R).forEach(function (el) {
      spheres[el] = new T.SphereGeometry(ATOM_R[el], 20, 16);
    });

    var pos = atoms.map(function (a, i) {
      var z = 0.16 * Math.sin(i * 1.7);
      return new T.Vector3(a[0] - cx, a[1] - cy, z);
    });

    // bonds first so they sit behind the atom spheres
    var bondGeo = new T.CylinderGeometry(0.14, 0.14, 1, 10, 1, false);
    var bondMat = std(0x8fa0b3, { roughness: 0.5, metalness: 0.1 });
    bonds.forEach(function (b) {
      var from = pos[b[0]], to = pos[b[1]];
      var dir = new T.Vector3().subVectors(to, from);
      var len = dir.length();
      var m = new T.Mesh(bondGeo, bondMat);
      m.position.copy(from).addScaledVector(dir, 0.5);
      m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
      g.add(m);
    });

    var tailP = null;
    atoms.forEach(function (a, i) {
      var el = a[2];
      var am = mesh(g, spheres[el], std(ATOM_C[el], {
        roughness: el === 'P' ? 0.32 : 0.30,
        metalness: el === 'P' ? 0.35 : 0.12
      }), pos[i].x, pos[i].y, pos[i].z);
      if (i === 23) tailP = am;      // the terminal phosphate
    });

    var S = 0.22;
    var rot = new T.Euler(0.16, -0.22, 0.07);
    var group = new T.Group();
    g.children.slice().forEach(function (c) { group.add(c); });
    g.add(group);
    group.scale.setScalar(S);
    group.rotation.copy(rot);

    // annotation anchors follow the group's rotation so labels stay on their atoms
    var anchors = [
      [new T.Vector3(1.30, 0.75, 0.12), 'Adenine ring', 'a'],
      [new T.Vector3(-4.30, -2.45, 0.12), 'Ribose sugar', 'b'],
      [new T.Vector3(-13.20, -1.45, 0.12), 'Triphosphate tail', 'c'],
      [new T.Vector3(1.90, -3.40, 0.12), '31 atoms · ~1 nm', 'b']
    ];
    anchors.forEach(function (a) {
      var v = new T.Vector3(a[0].x - cx, a[0].y - cy, a[0].z).applyEuler(rot).multiplyScalar(S);
      a[3] = v;
      anno(g, v.x, v.y, v.z, a[1], a[2]);
    });

    // door: the terminal phosphate - the bond ATP spends to do work. Parented
    // to the atom itself so the ring sways with the molecule.
    if (tailP) door(tailP, 0, 0, 0, 0.95);

    g.userData.unitMeters = 1e-10 / S;
    g.userData.tick = function (t) {
      rot.y = -0.22 + Math.sin(t * 0.22) * 0.11;
      group.rotation.copy(rot);
      var list = g.userData.annotations;
      for (var i = 0; i < anchors.length && i < list.length; i++) {
        var v = new T.Vector3(anchors[i][0].x - cx, anchors[i][0].y - cy, anchors[i][0].z)
          .applyEuler(rot).multiplyScalar(S);
        list[i].p[0] = v.x; list[i].p[1] = v.y; list[i].p[2] = v.z;
        if (list[i].local) list[i].local.set(v.x, v.y, v.z);
      }
    };
    return g;
  }

  /* ==========================================================================
     LEVEL 10 — Atom
     ====================================================================== */
  function buildAtom() {
    var g = level(2.35, 1.79e-11);
    var rnd = rng(509);

    // nucleus (deliberately exaggerated — see annotation)
    var nucGroup = new T.Group();
    var protonMat = std(C.proton, { roughness: 0.35, emissive: 0x3a0d06, emissiveIntensity: 0.4 });
    var neutronMat = std(C.neutron, { roughness: 0.35, emissive: 0x061a3a, emissiveIntensity: 0.4 });
    for (var i = 0; i < 16; i++) {
      var p = fibPoint(i, 16, 0.17);
      mesh(nucGroup, new T.SphereGeometry(0.085, 14, 10), i % 2 ? protonMat : neutronMat, p.x, p.y, p.z);
    }
    glowSprite(nucGroup, 0xffb0a0, 1.2, 0.55);
    g.add(nucGroup);

    var shells = [
      { r: 1.25, n: 2, tilt: [0.35, 0.0, 0.15], speed: 1.5 },
      { r: 2.65, n: 6, tilt: [-0.45, 0.3, 0.0], speed: 0.85 }
    ];

    shells.forEach(function (sh, si) {
      var shl = new T.Group();
      shl.rotation.set(sh.tilt[0], sh.tilt[1], sh.tilt[2]);
      g.add(shl);

      mesh(shl, new T.SphereGeometry(sh.r, 40, 28), shell(C.electron, si ? 0.05 : 0.07));

      // two great circles so the shell reads as a shell, not a fog
      [[0, 0, 0], [Math.PI / 2, 0, 0]].forEach(function (rr) {
        mesh(shl, new T.TorusGeometry(sh.r, 0.0085, 6, 140), shell(0x4f8fe0, 0.22, { additive: true }))
          .rotation.set(rr[0], rr[1], rr[2]);
      });

      var orbits = si === 0 ? 1 : 3;
      sh.orbitGroups = [];
      for (var o = 0; o < orbits; o++) {
        var og = new T.Group();
        og.rotation.set(
          (o === 0 ? 0 : (o === 1 ? 1.05 : -1.05)) + sh.tilt[0] * 0.4,
          (o * 2.1) % Math.PI,
          o * 0.7
        );
        mesh(og, new T.TorusGeometry(sh.r, 0.011, 6, 140), shell(0x2f7fd8, 0.5, { additive: true }))
          .rotation.x = Math.PI / 2;
        shl.add(og);
        og.userData.speed = sh.speed * (1 + o * 0.22);
        og.userData.r = sh.r;
        og.userData.count = Math.round(sh.n / orbits);
        og.userData.phase = (o / orbits) * TAU;
        og.userData.electrons = [];
        for (var e = 0; e < og.userData.count; e++) {
          var em = mesh(og, new T.SphereGeometry(0.125, 16, 12),
            std(0x2f7fd8, { roughness: 0.18, metalness: 0.2, emissive: 0x6fb0ff, emissiveIntensity: 0.85 }));
          var sp = glowSprite(em, 0x6fb0ff, 0.52, 0.55);
          sp.position.set(0, 0, 0);
          og.userData.electrons.push(em);
        }
        sh.orbitGroups.push(og);
      }
      sh.group = shl;
    });

    // electron cloud
    var cloudGeo = new T.BufferGeometry();
    var pts = new Float32Array(1800 * 3);
    for (var c = 0; c < 1800; c++) {
      var v = randomInSphere(rnd, 1);
      var rr = 1.0 + Math.pow(rnd(), 0.6) * 1.75;
      pts[c * 3] = v.x * rr;
      pts[c * 3 + 1] = v.y * rr;
      pts[c * 3 + 2] = v.z * rr;
    }
    cloudGeo.setAttribute('position', new T.BufferAttribute(pts, 3));
    g.add(new T.Points(cloudGeo, new T.PointsMaterial({
      color: 0x4f8fe0, size: 0.085, transparent: true, opacity: 0.5,
      depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
    })));

    anno(g, -2.30, 1.80, 0.0, 'Electron shell', 'a');
    anno(g, 0.40, 0.30, 0.0, 'Nucleus (shown ~1,000× too big)', 'c');
    anno(g, 2.40, -1.55, 0.0, 'Electron cloud', 'b');
    anno(g, 0.0, -3.30, 0.0, '0.1 nm across · 99.9999% empty', 'b');

    // door: the nucleus at the centre, 100,000x smaller than the atom
    door(g, 0, 0, 0, 0.42);

    var t0 = 0;
    g.userData.tick = function (t, dt) {
      shells.forEach(function (sh) {
        sh.orbitGroups.forEach(function (og) {
          og.rotation.y += dt * 0.10 * (og.userData.speed > 1 ? 1 : -1);
          var r = og.userData.r;
          og.userData.electrons.forEach(function (em, idx) {
            var ang = og.userData.phase + idx * (TAU / og.userData.electrons.length) + t * og.userData.speed;
            em.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
          });
        });
      });
      nucGroup.rotation.y = t * 0.3;
      nucGroup.rotation.x = Math.sin(t * 0.4) * 0.1;
    };
    return g;
  }

  /* ==========================================================================
     LEVEL 11 — Atomic nucleus
     ====================================================================== */
  function buildNucleon() {
    var g = level(2.4, 2.3e-15);
    var rnd = rng(613);

    var protons = [], neutrons = [];
    var home = [];
    for (var i = 0; i < 12; i++) {
      var p = fibPoint(i, 12, 0.60 + (rnd() - 0.5) * 0.10);
      home.push(p);
      var isProton = i < 6;
      var m = mesh(g, new T.SphereGeometry(0.215, 22, 16),
        isProton
          ? std(C.proton, { roughness: 0.32, metalness: 0.1, emissive: 0x4a0f06, emissiveIntensity: 0.55 })
          : std(C.neutron, { roughness: 0.32, metalness: 0.1, emissive: 0x06182f, emissiveIntensity: 0.55 }),
        p.x, p.y, p.z);
      m.userData.home = p.clone();
      m.userData.phase = rnd() * TAU;
      m.userData.amp = 0.012 + rnd() * 0.018;
      (isProton ? protons : neutrons).push(m);
    }

    // gluon springs between close neighbours
    var springs = [];
    var springMat = std(C.gluon, { roughness: 0.3, emissive: 0x6a4c00, emissiveIntensity: 0.9 });
    var nucleons = protons.concat(neutrons);
    for (var a = 0; a < nucleons.length; a++) {
      for (var b = a + 1; b < nucleons.length; b++) {
        if (nucleons[a].userData.home.distanceTo(nucleons[b].userData.home) < 1.05) {
          var s = new T.Mesh(springGeometry(nucleons[a].position, nucleons[b].position, 2.6, 0.075, 0.026, 9), springMat);
          g.add(s);
          springs.push([s, nucleons[a], nucleons[b]]);
        }
      }
    }

    // boundary
    var boundGeo = blobGeometry(1.34, 3, 0.05, 71);
    var bound = mesh(g, boundGeo, shell(0xe0a0a0, 0.07));
    bound.renderOrder = 18;
    var brim = mesh(g, boundGeo.clone(), shell(0xff8a6a, 0.09, { additive: true, side: T.BackSide }));
    brim.scale.setScalar(1.008);
    brim.renderOrder = 19;

    anno(g, 0.90, 0.75, 0.30, 'Proton · +1', 'a');
    anno(g, -0.85, 0.62, -0.35, 'Neutron · 0', 'b');
    anno(g, 0.0, -0.35, 1.05, 'Gluon field', 'c');
    anno(g, 0.0, 1.72, 0.0, '5 femtometres', 'b');
    anno(g, 1.25, -0.20, -0.80, 'Strong force', 'a');
    anno(g, -1.15, 0.25, 0.90, 'Nucleon core', 'b');

    // door: one particular proton, ringed so you can follow it as it jiggles
    if (protons[0]) door(protons[0], 0, 0, 0, 0.32);

    var _a = new T.Vector3(), _b = new T.Vector3();
    g.userData.tick = function (t, dt) {
      nucleons.forEach(function (n) {
        var h = n.userData.home, ph = n.userData.phase, am = n.userData.amp;
        n.position.set(
          h.x + Math.sin(t * 3.1 + ph) * am,
          h.y + Math.cos(t * 2.7 + ph * 1.7) * am,
          h.z + Math.sin(t * 3.5 + ph * 2.3) * am
        );
      });
      springs.forEach(function (sp) {
        _a.copy(sp[1].position); _b.copy(sp[2].position);
        sp[0].geometry.dispose();
        sp[0].geometry = springGeometry(_a, _b, 2.6, 0.075, 0.026, 9);
      });
      g.rotation.y = t * 0.14;
    };
    return g;
  }

  /* ==========================================================================
     LEVEL 12 — Quarks inside a proton
     ====================================================================== */
  function buildQuark() {
    var g = level(2.4, 8.5e-16);

    var boundGeo = blobGeometry(1.0, 4, 0.03, 91);
    var bound = mesh(g, boundGeo, shell(0x9fb6ff, 0.10));
    bound.renderOrder = 18;
    var brim = mesh(g, boundGeo.clone(), shell(0x5f7fff, 0.14, { additive: true, side: T.BackSide }));
    brim.scale.setScalar(1.008);
    brim.renderOrder = 19;

    var quarks = [
      { el: 'u', charge: '+2/3', color: C.up, home: new T.Vector3(0.42, 0.20, 0.22), phase: 0.0 },
      { el: 'u', charge: '+2/3', color: C.up, home: new T.Vector3(-0.30, 0.46, -0.34), phase: 2.1 },
      { el: 'd', charge: '-1/3', color: C.down, home: new T.Vector3(-0.18, -0.50, 0.28), phase: 4.2 }
    ];

    // No door on this level: quarks are the bottom of the ladder, so this is a
    // terminus rather than a threshold.
    var springMat = std(C.gluon, { roughness: 0.28, emissive: 0x6a4c00, emissiveIntensity: 1.1 });

    quarks.forEach(function (q) {
      var meshQ = mesh(g, blobGeometry(0.235, 3, 0.08, q.phase * 10 + 3), std(q.color, {
        roughness: 0.3, metalness: 0.15, emissive: q.color, emissiveIntensity: 0.22
      }), q.home.x, q.home.y, q.home.z);
      glowSprite(meshQ, q.color, 1.0, 0.5);
      q.mesh = meshQ;
    });

    var springs = [];
    for (var i = 0; i < quarks.length; i++) {
      for (var j = i + 1; j < quarks.length; j++) {
        var s = new T.Mesh(springGeometry(quarks[i].home, quarks[j].home, 4.5, 0.10, 0.030, 10), springMat);
        g.add(s);
        springs.push([s, quarks[i], quarks[j]]);
      }
    }

    anno(g, 0.72, 0.46, 0.36, 'up quark · +2/3', 'a');
    anno(g, -0.62, 0.86, -0.42, 'up quark · +2/3', 'a');
    anno(g, -0.34, -0.94, 0.42, 'down quark · \u22121/3', 'c');
    anno(g, 0.0, 1.42, 0.0, 'Gluons bind them — they never travel alone', 'b');
    anno(g, 0.0, -1.45, 0.0, 'Quarks show no measurable size (< 10\u207b\u00b9\u2078 m)', 'b');

    var _a = new T.Vector3(), _b = new T.Vector3();
    g.userData.tick = function (t, dt) {
      quarks.forEach(function (q, idx) {
        var h = q.home, ph = q.phase;
        q.mesh.position.set(
          h.x + Math.sin(t * 1.1 + ph) * 0.22,
          h.y + Math.cos(t * 0.9 + ph * 1.4) * 0.22,
          h.z + Math.sin(t * 1.3 + ph * 0.8) * 0.22
        );
        q.mesh.rotation.y += dt * 0.8;
        q.mesh.rotation.x += dt * 0.4;
      });
      springs.forEach(function (sp) {
        _a.copy(sp[1].mesh.position); _b.copy(sp[2].mesh.position);
        sp[0].geometry.dispose();
        sp[0].geometry = springGeometry(_a, _b, 4.5, 0.10, 0.030, 10);
      });
      g.rotation.y = t * 0.16;
    };
    return g;
  }

  /* --------------------------------------------------------------- helpers */
  function fibPoint(i, n, radius) {
    var k = i + 0.5;
    var phi = Math.acos(1 - 2 * k / n);
    var theta = Math.PI * (1 + Math.sqrt(5)) * k;
    return new T.Vector3(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius,
      Math.sin(phi) * Math.sin(theta) * radius
    );
  }
  function randomInSphere(rnd, radius) {
    var u = rnd(), v = rnd(), w = rnd();
    var r = radius * Math.cbrt(u);
    var theta = v * TAU, phi = Math.acos(2 * w - 1);
    return new T.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  /* --------------------------------------------------------------- exports */
  SCALE.MODELS = {
    body: buildBody,
    skeleton: buildSkeleton,
    organs: buildOrgans,
    tissue: buildTissue,
    cell: buildCell,
    nucleus: buildNucleus,
    chromosome: buildChromosome,
    dna: buildDNA,
    molecule: buildMolecule,
    atom: buildAtom,
    nucleon: buildNucleon,
    quark: buildQuark
  };
  SCALE.util = { radialTexture: radialTexture, rng: rng, fibPoint: fibPoint };
})();
