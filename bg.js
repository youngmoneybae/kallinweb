/* ============================================================
   Живой фон: шёлковые фиолетовые потоки на WebGL.
   Реагирует на курсор и прокрутку. Если WebGL недоступен —
   остаётся обычный CSS-фон.
   ============================================================ */
(() => {
  const canvas = document.getElementById("bgShader");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const FRAG = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uScroll;

    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    const mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++){ v += a * noise(p); p = R * p * 2.02; a *= 0.5; }
      return v;
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float t = uTime * 0.045;

      // the field drifts upward as you scroll down the page
      vec2 sp = p * 1.4 + vec2(0.0, uScroll * 2.2);

      // gentle pull toward the cursor
      float md = length(p - m);
      sp += (m - p) * 0.12 * exp(-md * 2.2);

      // domain warping -> silky flowing shapes
      vec2 q = vec2(fbm(sp + vec2(0.0, t)), fbm(sp + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(sp + 3.2 * q + vec2(1.7, 9.2) + t * 1.4),
                    fbm(sp + 3.2 * q + vec2(8.3, 2.8) - t * 1.1));
      float f = fbm(sp + 3.0 * r);

      vec3 black   = vec3(0.027, 0.023, 0.043);
      vec3 deep    = vec3(0.13, 0.04, 0.30);
      vec3 violet  = vec3(0.42, 0.19, 0.88);
      vec3 magenta = vec3(0.72, 0.16, 0.78);
      vec3 lilac   = vec3(0.80, 0.72, 1.00);

      // k: how "lit" this point of the silk is
      float k = smoothstep(0.3, 0.72, f);

      vec3 col = black;
      col = mix(col, deep * 1.6, smoothstep(0.15, 0.7, k));
      col = mix(col, violet * 0.7, pow(k, 2.0) * smoothstep(0.25, 0.85, length(q)) * 0.75);
      col = mix(col, magenta * 0.75, smoothstep(0.5, 0.9, r.y) * k * 0.45);

      // glowing silk threads following the flow
      float threads = pow(1.0 - abs(sin(f * 10.0 + t * 4.0)), 14.0);
      col += mix(violet, lilac, k) * threads * (0.2 + 0.8 * k) * 0.45;

      // bright crests where the folds catch the light
      col += lilac * pow(k, 6.0) * 0.18;

      // soft light following the cursor
      col += violet * exp(-md * 3.0) * 0.22;

      // vignette keeps edges deep black and text readable
      float vig = smoothstep(1.4, 0.2, length((uv - 0.5) * vec2(1.3, 1.05)));
      col *= 0.6 + 0.5 * vig;

      // tiny dither to kill gradient banding
      col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0 * 2.0;

      gl_FragColor = vec4(col, 1.0);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res: gl.getUniformLocation(prog, "uRes"),
    time: gl.getUniformLocation(prog, "uTime"),
    mouse: gl.getUniformLocation(prog, "uMouse"),
    scroll: gl.getUniformLocation(prog, "uScroll"),
  };

  // Render at reduced resolution: the image is soft anyway, and this keeps it at full frame rate.
  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 2) * (innerWidth < 768 ? 0.4 : 0.5);
    const w = Math.max(1, Math.round(innerWidth * scale));
    const h = Math.max(1, Math.round(innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();
  window.addEventListener("resize", resize);

  let mx = 0.5, my = 0.6, tmx = mx, tmy = my;
  window.addEventListener("pointermove", (e) => {
    tmx = e.clientX / innerWidth;
    tmy = 1 - e.clientY / innerHeight;
  }, { passive: true });

  let sc = 0;
  const scrollTarget = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? scrollY / max : 0;
  };

  const draw = (time) => {
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;
    sc += (scrollTarget() - sc) * 0.08;
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, time);
    gl.uniform2f(u.mouse, mx, my);
    gl.uniform1f(u.scroll, sc);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Wall-clock time keeps the pattern continuous when switching between tabs/pages.
  const now = () => (Date.now() / 1000) % 3600;

  // Already seen on a previous page this session → show instantly (no fade-in).
  try {
    if (sessionStorage.getItem("svr-bg")) document.documentElement.classList.add("bg-instant");
    sessionStorage.setItem("svr-bg", "1");
  } catch (_) {}

  sc = scrollTarget();
  draw(reduce ? 20 : now()); // first frame before the page is shown
  document.documentElement.classList.add("has-shader-bg");
  if (reduce) return;

  const loop = () => {
    if (!document.hidden) draw(now());
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
