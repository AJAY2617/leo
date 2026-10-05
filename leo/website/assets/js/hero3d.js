// Leo Tech: three.js particle scene.
// ~15k particles assemble into the lion emblem where .hero-visual sits, scatter away from the pointer,
// then morph on scroll: lion -> rotating globe -> "</>" (code). Falls back to the static emblem image
// when WebGL is unavailable; with reduced motion the lion is drawn once, without animation.
(function () {
  'use strict';

  var root = document.documentElement;
  var canvas = document.getElementById('bg3d');
  var anchor = document.querySelector('.hero-visual');
  var hero = document.querySelector('.hero');
  var band = document.querySelector('.cta-band');
  var DATA = window.LEO_LION;
  if (!canvas || !anchor || !hero || !DATA || !window.THREE) return;
  var THREE = window.THREE;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.matchMedia('(max-width: 640px)').matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    return; // no WebGL: the CSS emblem image stays visible
  }
  root.classList.add('webgl');

  var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  // ---------- geometry ----------
  function decode(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  var srcPos = new Int16Array(decode(DATA.pos).buffer);
  var srcDark = decode(DATA.dark), srcLight = decode(DATA.light);
  var stride = small ? 2 : 1;
  var N = Math.floor(DATA.count / stride);

  var aLion = new Float32Array(N * 3), aSphere = new Float32Array(N * 3), aCode = new Float32Array(N * 3);
  var aScatter = new Float32Array(N * 3), aColDark = new Float32Array(N * 3), aColLight = new Float32Array(N * 3);
  var aRand = new Float32Array(N * 3);

  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // "</>" as three thick strokes
  var strokes = [
    [[-0.55, 0.48], [-1.02, 0]], [[-1.02, 0], [-0.55, -0.48]],
    [[0.2, 0.66], [-0.2, -0.66]],
    [[0.55, 0.48], [1.02, 0]], [[1.02, 0], [0.55, -0.48]],
  ];
  var lens = strokes.map(function (s) { return Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]); });
  var total = lens.reduce(function (a, b) { return a + b; }, 0);

  var golden = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < N; i++) {
    var j = i * stride, o = i * 3;
    aLion[o] = srcPos[j * 3] * DATA.unit; aLion[o + 1] = srcPos[j * 3 + 1] * DATA.unit; aLion[o + 2] = srcPos[j * 3 + 2] * DATA.unit;
    // dark-theme white ink is softened a little so additive glow does not blow out
    aColDark[o] = srcDark[j * 3] / 255 * 0.92; aColDark[o + 1] = srcDark[j * 3 + 1] / 255 * 0.95; aColDark[o + 2] = srcDark[j * 3 + 2] / 255;
    aColLight[o] = srcLight[j * 3] / 255; aColLight[o + 1] = srcLight[j * 3 + 1] / 255; aColLight[o + 2] = srcLight[j * 3 + 2] / 255;

    // globe: even fibonacci sphere
    var yy = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - yy * yy), th = golden * i, k = 1 + (rnd() - 0.5) * 0.03;
    aSphere[o] = Math.cos(th) * rad * k; aSphere[o + 1] = yy * k; aSphere[o + 2] = Math.sin(th) * rad * k;

    // code glyph
    var pick = rnd() * total, s = 0;
    while (pick > lens[s] && s < strokes.length - 1) { pick -= lens[s]; s++; }
    var a = strokes[s][0], b = strokes[s][1], u = pick / lens[s];
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), w = (rnd() - 0.5) * 0.16;
    aCode[o] = a[0] + dx * u - (dy / l) * w; aCode[o + 1] = a[1] + dy * u + (dx / l) * w; aCode[o + 2] = (rnd() - 0.5) * 0.12;

    // start cloud for the intro
    aScatter[o] = (rnd() - 0.5) * 14; aScatter[o + 1] = (rnd() - 0.5) * 9; aScatter[o + 2] = (rnd() - 0.5) * 8;

    aRand[o] = rnd(); aRand[o + 1] = rnd(); aRand[o + 2] = rnd();
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(aLion, 3));
  geo.setAttribute('aLion', new THREE.BufferAttribute(aLion, 3));
  geo.setAttribute('aSphere', new THREE.BufferAttribute(aSphere, 3));
  geo.setAttribute('aCode', new THREE.BufferAttribute(aCode, 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(aScatter, 3));
  geo.setAttribute('aColDark', new THREE.BufferAttribute(aColDark, 3));
  geo.setAttribute('aColLight', new THREE.BufferAttribute(aColLight, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50); // positions move in the shader

  var uniforms = {
    uTime: { value: 0 }, uIntro: { value: reduceMotion ? 1 : 0 },
    uMorph1: { value: 0 }, uMorph2: { value: 0 }, uOpacity: { value: 1 },
    uPixel: { value: DPR }, uSize: { value: small ? 3.1 : 2.6 }, uDark: { value: 1 },
    uLionOffset: { value: new THREE.Vector3() }, uLionScale: { value: 1 }, uRot: { value: new THREE.Vector2() },
    uSphereOffset: { value: new THREE.Vector3() }, uSphereScale: { value: 1 },
    uCodeOffset: { value: new THREE.Vector3() }, uCodeScale: { value: 1 },
    uMouse: { value: new THREE.Vector3(99, 99, 0) }, uMouseStrength: { value: 0 },
    uA: { value: new THREE.Color('#1E8BFF') }, uB: { value: new THREE.Color('#5CD2FF') },
  };

  var material = new THREE.ShaderMaterial({
    uniforms: uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'uniform float uTime, uIntro, uMorph1, uMorph2, uPixel, uSize, uDark, uLionScale, uSphereScale, uCodeScale, uMouseStrength;',
      'uniform vec3 uLionOffset, uSphereOffset, uCodeOffset, uMouse, uA, uB;',
      'uniform vec2 uRot;',
      'attribute vec3 aLion, aSphere, aCode, aScatter, aColDark, aColLight, aRand;',
      'varying vec3 vColor; varying float vShade;',
      'mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }',
      'mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }',
      // each particle starts its move a little later than the last, so shapes dissolve rather than snap
      'float stagger(float p, float d){ float t = clamp(p * 1.7 - d * 0.7, 0., 1.); return t * t * (3. - 2. * t); }',
      'void main(){',
      '  vec3 lion = rotY(uRot.x) * rotX(uRot.y) * aLion * uLionScale + uLionOffset;',
      '  vec3 sLocal = rotY(uTime * 0.07) * rotX(0.38) * aSphere;',
      '  vec3 sphere = sLocal * uSphereScale + uSphereOffset;',
      '  vec3 code = rotY(sin(uTime * 0.35) * 0.3) * aCode * uCodeScale + uCodeOffset;',
      '  float m1 = stagger(uMorph1, aRand.x), m2 = stagger(uMorph2, aRand.x);',
      '  vec3 p = mix(mix(lion, sphere, m1), code, m2);',
      '  p = mix(aScatter, p, stagger(uIntro, aRand.y));',
      '  float drift = 0.012 + 0.03 * m1 * (1. - m2);',
      '  p += vec3(sin(uTime * 0.9 + aRand.z * 6.28), cos(uTime * 0.7 + aRand.z * 5.1), sin(uTime * 0.6 + aRand.z * 4.3)) * drift;',
      '  vec2 d = p.xy - uMouse.xy; float dist = length(d);',
      '  float f = uMouseStrength * (1. - smoothstep(0., 0.85, dist));',
      '  p.xy += normalize(d + 1e-4) * f * 0.32; p.z += f * 0.35;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.);',
      '  gl_Position = projectionMatrix * mv;',
      '  vShade = mix(1., 0.16 + 0.84 * (sLocal.z * 0.5 + 0.5), m1 * (1. - m2));',
      '  gl_PointSize = uSize * uPixel * (0.75 + aRand.y * 0.5) * (1. + 0.3 * max(m1, m2)) * (10. / -mv.z);',
      '  vec3 lionCol = mix(aColLight, aColDark, uDark);',
      '  vec3 accent = mix(uA, uB, aRand.y);',
      '  vColor = mix(lionCol, accent, max(m1, m2));',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform float uOpacity, uDark;',
      'varying vec3 vColor; varying float vShade;',
      'void main(){',
      '  float r = length(gl_PointCoord - 0.5);',
      '  if (r > 0.5) discard;',
      '  float a = mix(1. - smoothstep(0.3, 0.5, r), 1. - smoothstep(0.0, 0.5, r), uDark);',
      '  gl_FragColor = vec4(vColor, a * uOpacity * vShade);',
      '}',
    ].join('\n'),
  });
  scene.add(new THREE.Points(geo, material));

  // ---------- theme ----------
  function applyTheme() {
    var dark = root.getAttribute('data-theme') !== 'light';
    uniforms.uDark.value = dark ? 1 : 0;
    material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    uniforms.uA.value.set(dark ? '#1E8BFF' : '#0A4FD0');
    uniforms.uB.value.set(dark ? '#5CD2FF' : '#0A8BEA');
    material.needsUpdate = true;
  }
  applyTheme();
  new MutationObserver(applyTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- layout: map DOM positions into the z=0 plane ----------
  var view = { w: 1, h: 1, halfW: 1, halfH: 1 };
  function resize() {
    view.w = window.innerWidth; view.h = window.innerHeight;
    renderer.setSize(view.w, view.h, false);
    camera.aspect = view.w / view.h; camera.updateProjectionMatrix();
    view.halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    view.halfW = view.halfH * camera.aspect;
  }
  function toWorld(px, py, out) {
    out.set((px / view.w * 2 - 1) * view.halfW, -(py / view.h * 2 - 1) * view.halfH, 0);
    return out;
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- pointer ----------
  var pointer = { x: 0, y: 0, active: false, nx: 0, ny: 0 };
  var target = new THREE.Vector3();
  function onMove(e) {
    var p = e.touches ? e.touches[0] : e;
    pointer.x = p.clientX; pointer.y = p.clientY; pointer.active = true;
    pointer.nx = p.clientX / view.w * 2 - 1; pointer.ny = p.clientY / view.h * 2 - 1;
  }
  if (!reduceMotion) {
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('pointerleave', function () { pointer.active = false; });
    window.addEventListener('touchend', function () { pointer.active = false; });
  }

  // ---------- scroll story ----------
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function scrollState(r, b) {
    var m1 = clamp01((view.h * 0.12 - r.top) / (r.height * 0.95));
    var m2 = b ? clamp01((view.h * 1.05 - b.top) / (view.h * 0.55)) : 0;
    return { m1: m1, m2: m2 };
  }

  // ---------- loop ----------
  var clock = new THREE.Clock();
  var tmp = new THREE.Vector3();
  var introStart = performance.now() + 150;
  var dark = function () { return uniforms.uDark.value > 0.5; };

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    if (!reduceMotion) uniforms.uTime.value += dt;

    // lion sits wherever the hero placeholder currently is
    var r = anchor.getBoundingClientRect();
    toWorld(r.left + r.width / 2, r.top + r.height / 2, uniforms.uLionOffset.value);
    uniforms.uLionScale.value = (r.height / view.h) * view.halfH * 0.94;

    var wide = view.w >= 1000;
    var br = band ? band.getBoundingClientRect() : null;
    uniforms.uSphereScale.value = wide ? view.halfH * 0.74 : Math.min(view.halfW, view.halfH) * 0.66;
    uniforms.uSphereOffset.value.set(wide ? view.halfW * 0.6 : 0, wide ? -view.halfH * 0.04 : 0, 0);
    if (br) {
      var pxToWorld = (2 * view.halfH) / view.h;
      // glow sits behind the call-to-action buttons, leaving the heading clean
      toWorld(br.left + br.width * (wide ? 0.76 : 0.5), br.top + br.height * (wide ? 0.5 : 0.62), uniforms.uCodeOffset.value);
      uniforms.uCodeScale.value = Math.min(br.width * 0.2, br.height * 0.7) * pxToWorld;
    }

    var st = scrollState(r, br);
    var k = reduceMotion ? 1 : 1 - Math.pow(0.001, dt); // frame-rate independent easing
    uniforms.uMorph1.value += (st.m1 - uniforms.uMorph1.value) * k;
    uniforms.uMorph2.value += (st.m2 - uniforms.uMorph2.value) * k;

    // keep the background calm behind text: dim once the lion has dissolved
    var mid = dark() ? 0.62 : 0.42, end = dark() ? 0.6 : 0.42;
    var m1 = uniforms.uMorph1.value, m2 = uniforms.uMorph2.value;
    uniforms.uOpacity.value = (1 - m1) * 1 + m1 * ((1 - m2) * mid + m2 * end);

    if (!reduceMotion) {
      var it = clamp01((performance.now() - introStart) / 2600);
      uniforms.uIntro.value = 1 - Math.pow(1 - it, 3);
      // gentle tilt towards the pointer, plus a slow idle sway
      var tx = pointer.nx * 0.38 + Math.sin(uniforms.uTime.value * 0.4) * 0.1;
      var ty = pointer.ny * 0.22;
      uniforms.uRot.value.x += (tx - uniforms.uRot.value.x) * 0.05;
      uniforms.uRot.value.y += (ty - uniforms.uRot.value.y) * 0.05;
      toWorld(pointer.x, pointer.y, tmp);
      uniforms.uMouse.value.lerp(tmp, 0.18);
      var want = pointer.active ? 1 : 0;
      uniforms.uMouseStrength.value += (want - uniforms.uMouseStrength.value) * 0.08;
    }

    renderer.render(scene, camera);
    if (!reduceMotion) requestAnimationFrame(frame);
  }
  if (reduceMotion) {
    // draw once, and again when the layout or theme changes
    var redraw = function () { requestAnimationFrame(frame); };
    window.addEventListener('scroll', redraw, { passive: true });
    window.addEventListener('resize', redraw);
    new MutationObserver(redraw).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }
  requestAnimationFrame(frame);
})();
