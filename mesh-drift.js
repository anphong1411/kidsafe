// Decorative Mesh drift, scoped to the navigation and installation cards.
// Fragment source/uniforms are the user's supplied WebGL1 recipe; no dependencies.
(() => {
  const hosts = [...document.querySelectorAll('[data-mesh]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const instances = [];
  let suspended = false, raf = 0, previous = 0, clock = 0;
  const moving = () => !reduced.matches && !document.hidden && !suspended && !navigator.connection?.saveData;
  const visible = item => item.visible && !item.lost;
  const vertexSource = 'attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0.0,1.0);}';
  const colours = new Float32Array([.039,0,.471,.098,0,1,.639,.639,1,0,.031,1,0,0,0,0,0,0,0,0,0,0,0,0]);

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw Error('Shader compile failed'); }
    return shader;
  }
  function initialise(item, fragment) {
    const gl = item.gl;
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    let pixel;
    try { pixel = compile(gl, gl.FRAGMENT_SHADER, fragment); }
    catch (error) { gl.deleteShader(vertex); throw error; }
    const program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, pixel); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(pixel);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw Error('Shader link failed'); }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(['u_colors[0]','u_scene','u_shape','u_surface','u_finish','u_transform','u_space','u_cursor'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.uniform3fv(uniforms['u_colors[0]'], colours);
    gl.uniform4f(uniforms.u_shape, 1.02, .59, .65, .09);
    gl.uniform4f(uniforms.u_surface, 2.30, 1.16, .05, .90);
    gl.uniform4f(uniforms.u_finish, 1.10, .15, .005, .05);
    gl.uniform4f(uniforms.u_transform, 115, 4.28, .14, 1);
    Object.assign(item, {program, buffer, uniforms, lost: false});
    item.canvas.style.visibility = '';
    item.host.dataset.meshState = 'ready';
    resize(item);
  }
  function resize(item) {
    const width = item.host.clientWidth, height = item.host.clientHeight;
    // Soft fields need no retina-scale framebuffer. Bound both DPR and pixel work.
    const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(160000 / Math.max(width * height, 1)));
    const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
    if (item.canvas.width !== w || item.canvas.height !== h) { item.canvas.width = w; item.canvas.height = h; }
    if (!item.lost) { item.gl.viewport(0, 0, w, h); draw(item, 0); }
  }
  function draw(item, delta) {
    const gl = item.gl, u = item.uniforms;
    if (!u || item.lost) return;
    const ease = 1 - Math.exp(-delta / 80);
    item.pointer[0] += (item.target[0] - item.pointer[0]) * ease;
    item.pointer[1] += (item.target[1] - item.pointer[1]) * ease;
    item.presence += ((item.over && fine.matches && moving() ? 1 : 0) - item.presence) * ease;
    gl.uniform4f(u.u_scene, item.canvas.width, item.canvas.height, clock * -.31, 4);
    gl.uniform4f(u.u_space, .24, -.12, item.pointer[0], item.pointer[1]);
    gl.uniform4f(u.u_cursor, item.presence, 4, .86, .70);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function tick(now) {
    raf = 0;
    if (!moving() || !instances.some(visible)) { previous = 0; return; }
    // One scheduler, at most 24 draws/second per visible surface.
    const delta = now - previous;
    if (!previous || delta >= 1000 / 24) {
      clock += previous ? Math.min(delta, 100) / 1000 : 0;
      previous = now;
      instances.filter(visible).forEach(item => draw(item, Math.min(delta, 100)));
    }
    raf = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(raf); raf = 0; previous = 0;
    const any = instances.some(visible);
    if (moving() && any) raf = requestAnimationFrame(tick);
    else instances.filter(visible).forEach(item => {
      item.presence = 0; draw(item, 0);
    });
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const item = instances.find(item => item.host === entry.target);
      if (item) item.visible = entry.isIntersecting;
    });
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  fine.addEventListener('change', sync);
  navigator.connection?.addEventListener('change', sync);
  addEventListener('pagehide', event => {
    suspended = true; sync();
    if (!event.persisted) instances.forEach(item => {
      item.gl.deleteBuffer(item.buffer); item.gl.deleteProgram(item.program);
    });
  });
  addEventListener('pageshow', () => { suspended = false; sync(); });

  fetch(new URL('mesh-drift.frag', document.currentScript.src)).then(response => {
    if (!response.ok) throw Error('Shader unavailable');
    return response.text();
  }).then(fragment => {
    hosts.forEach(host => {
      const canvas = document.createElement('canvas');
      canvas.className = 'mesh-canvas'; canvas.setAttribute('aria-hidden', 'true');
      const gl = canvas.getContext('webgl', {alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power'});
      if (!gl) { host.dataset.meshState = 'fallback'; return; }
      const item = {host, canvas, gl, visible: false, pointer: [0,0], target: [0,0], presence: 0, over: false, lost: false};
      try { initialise(item, fragment); }
      catch { host.dataset.meshState = 'fallback'; gl.getExtension('WEBGL_lose_context')?.loseContext(); return; }
      host.prepend(canvas); instances.push(item);
      host.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch' || !fine.matches || !moving()) return;
        const rect = host.getBoundingClientRect();
        item.target = [2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height];
        item.over = true;
      }, {passive: true});
      host.addEventListener('pointerleave', () => { item.over = false; }, {passive: true});
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); item.lost = true; canvas.style.visibility = 'hidden'; host.dataset.meshState = 'fallback'; sync();
      });
      canvas.addEventListener('webglcontextrestored', () => {
        try { initialise(item, fragment); } catch { item.lost = true; host.dataset.meshState = 'fallback'; }
        sync();
      });
      new ResizeObserver(() => { resize(item); }).observe(host);
      observer.observe(host);
    });
    sync();
  }).catch(() => { hosts.forEach(host => { host.dataset.meshState = 'fallback'; }); });
})();
