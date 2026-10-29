/**
 * Bộ giải lưới Boltzmann 2D (D2Q9, BGK + mô hình xoáy Smagorinsky) chạy trên GPU bằng WebGL2 (fragment shader, ping-pong 3 texture
 * RGBA float qua MRT). Một lát cắt ngang ở cao độ đi bộ: khối nhà là ô rắn (dội ngược nửa bước), gió vào đều ở biên trái (x = 0, vận tốc
 * U0 theo +x), biên khác lấy gradient 0. Cộng dồn vận tốc trung bình sau giai đoạn ổn định để có trường tốc độ trung bình theo thời gian.
 *
 * ƯỚC LƯỢNG NHANH, KHÔNG THAY CFD: 2D (không có dòng vượt mái / xoáy chân tòa 3D), Reynolds lưới thấp hơn thực tế nhiều bậc, không có lớp
 * biên khí quyển. Dùng để so sánh tương đối các phương án bố trí (chỗ tăng tốc ở góc nhà, khe giữa hai tòa, vùng khuất gió).
 * Tham khảo: Krüger et al., "The Lattice Boltzmann Method" (Springer 2017); Hou et al. 1996 (LBM + Smagorinsky).
 */
const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const CHUNG = `#version 300 es
precision highp float; precision highp int;
uniform highp sampler2D f0; uniform highp sampler2D f1; uniform highp sampler2D f2; uniform highp sampler2D msk;
uniform float U0; uniform float tau0; uniform float cs2; uniform int N;
const ivec2 E[9] = ivec2[9](ivec2(0,0), ivec2(1,0), ivec2(0,1), ivec2(-1,0), ivec2(0,-1), ivec2(1,1), ivec2(-1,1), ivec2(-1,-1), ivec2(1,-1));
const float W[9] = float[9](4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0);
const int OPP[9] = int[9](0, 3, 4, 1, 2, 7, 8, 5, 6);
float layF(int i, ivec2 p) {
  if (i < 4) { vec4 a = texelFetch(f0, p, 0); return a[i]; }
  if (i < 8) { vec4 a = texelFetch(f1, p, 0); return a[i - 4]; }
  return texelFetch(f2, p, 0).x;
}
bool ran(ivec2 p) { return texelFetch(msk, p, 0).r > 0.5; }
float feq(int i, float rho, vec2 u) {
  float eu = dot(vec2(E[i]), u), uu = dot(u, u);
  return W[i] * rho * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * uu);
}
`;

const FS_KHOI = CHUNG + `
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float f[9];
  vec2 u = ran(p) ? vec2(0.0) : vec2(U0, 0.0);
  for (int i = 0; i < 9; i++) f[i] = ran(p) ? 0.0 : feq(i, 1.0, u);
  o0 = vec4(f[0], f[1], f[2], f[3]); o1 = vec4(f[4], f[5], f[6], f[7]); o2 = vec4(f[8], 0.0, 0.0, 0.0);
}`;

const FS_BUOC = CHUNG + `
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (ran(p)) { o0 = vec4(0.0); o1 = vec4(0.0); o2 = vec4(0.0); return; }
  float f[9];
  if (p.x == 0) {
    for (int i = 0; i < 9; i++) f[i] = feq(i, 1.0, vec2(U0, 0.0));
  } else {
    for (int i = 0; i < 9; i++) {
      ivec2 s = clamp(p - E[i], ivec2(0), ivec2(N - 1));
      f[i] = ran(s) ? layF(OPP[i], p) : layF(i, s);
    }
  }
  float rho = 0.0; vec2 m = vec2(0.0);
  for (int i = 0; i < 9; i++) { rho += f[i]; m += f[i] * vec2(E[i]); }
  rho = max(rho, 0.2);
  vec2 u = m / rho;
  float lu = length(u);
  if (lu > 0.3) u *= 0.3 / lu;
  // Smagorinsky: tensor ứng suất không cân bằng → tau hiệu dụng
  float pxx = 0.0, pyy = 0.0, pxy = 0.0, fq[9];
  for (int i = 0; i < 9; i++) {
    fq[i] = feq(i, rho, u);
    float d = f[i] - fq[i]; vec2 e = vec2(E[i]);
    pxx += e.x * e.x * d; pyy += e.y * e.y * d; pxy += e.x * e.y * d;
  }
  float Q = sqrt(2.0 * (pxx * pxx + pyy * pyy + 2.0 * pxy * pxy));
  float tau = 0.5 * (tau0 + sqrt(tau0 * tau0 + 18.0 * cs2 * Q / rho));
  for (int i = 0; i < 9; i++) f[i] = f[i] - (f[i] - fq[i]) / tau;
  o0 = vec4(f[0], f[1], f[2], f[3]); o1 = vec4(f[4], f[5], f[6], f[7]); o2 = vec4(f[8], 0.0, 0.0, 0.0);
}`;

const FS_CONG = CHUNG + `
uniform highp sampler2D acc;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(acc, p, 0);
  if (ran(p)) { o = a; return; }
  float rho = 0.0; vec2 m = vec2(0.0);
  for (int i = 0; i < 9; i++) { float fi = layF(i, p); rho += fi; m += fi * vec2(E[i]); }
  vec2 u = m / max(rho, 0.2);
  o = a + vec4(u, length(u), 1.0);
}`;

export type BoGiai = {
  N: number; U0: number;
  /** Chờ trình điều khiển dịch xong shader (KHR_parallel_shader_compile — không chặn luồng chính). */
  sanSang: () => Promise<void>;
  /** Nạp ô rắn mới (`mask[y * N + x]` = 1) và khởi tạo lại trường + bộ cộng dồn — dùng lại shader / texture giữa các hướng gió. */
  batDau: (mask: Uint8Array) => void;
  /** Chạy thêm `n` bước (chỉ xếp lệnh GPU, không chờ). `cong` = cộng dồn trung bình sau mỗi bước. */
  chay: (n: number, cong: boolean) => void;
  /** Đọc trường trung bình (N × N × 4: Σux, Σuy, Σ|u|, số mẫu) không chặn: đọc qua PBO + fence, thăm dò mỗi khung. */
  doc: () => Promise<Float32Array>;
  huy: () => void;
};

/** Có chạy được không (WebGL2 + render vào texture float). */
export function hoTroLBM(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ok = !!gl && !!gl.getExtension('EXT_color_buffer_float');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch { return false; }
}

/** Tạo bộ giải N × N (gọi `batDau(mask)` trước khi chạy). Null nếu thiết bị không hỗ trợ. */
export function taoBoGiai(N: number, U0 = 0.08, tau0 = 0.515, cs = 0.16): BoGiai | null {
  const cv = document.createElement('canvas');
  cv.width = 1; cv.height = 1;
  const gl = cv.getContext('webgl2', { antialias: false, depth: false, stencil: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
  // dịch song song (KHR_parallel_shader_compile): không hỏi trạng thái ngay — hỏi sau khi trình điều khiển báo xong, khỏi chặn luồng chính
  const ss = gl.getExtension('KHR_parallel_shader_compile') as { COMPLETION_STATUS_KHR: number } | null;
  const sh = (loai: number, src: string) => { const x = gl.createShader(loai)!; gl.shaderSource(x, src); gl.compileShader(x); return x; };
  const vs = sh(gl.VERTEX_SHADER, VS);
  const dsSh: WebGLShader[] = [vs];
  const ct = (fs: string) => {
    const p = gl.createProgram()!, f = sh(gl.FRAGMENT_SHADER, fs);
    dsSh.push(f);
    gl.attachShader(p, vs); gl.attachShader(p, f); gl.linkProgram(p);
    return p;
  };
  const pKhoi = ct(FS_KHOI), pBuoc = ct(FS_BUOC), pCong = ct(FS_CONG);
  const kiemLink = () => {
    for (const p of [pKhoi, pBuoc, pCong]) if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('LBM shader: ' + (gl.getProgramInfoLog(p) || dsSh.map((x) => gl.getShaderInfoLog(x)).join(' ')));
    }
  };
  const tex = (fmt: number, type: number, iFmt: number, data: ArrayBufferView | null) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, iFmt, N, N, 0, fmt, type, data);
    return t;
  };
  const f32 = () => tex(gl.RGBA, gl.FLOAT, gl.RGBA32F, null);
  const tMask = tex(gl.RED, gl.UNSIGNED_BYTE, gl.R8, new Uint8Array(N * N));
  const bo = [[f32(), f32(), f32()], [f32(), f32(), f32()]];
  const cong = [f32(), f32()];
  const fbBo = bo.map((ts) => {
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    ts.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    return fb;
  });
  const fbCong = cong.map((t) => {
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return fb;
  });
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.viewport(0, 0, N, N);
  const datChung = (p: WebGLProgram, nguon: WebGLTexture[] | null) => {
    gl.useProgram(p);
    const u = (k: string) => gl.getUniformLocation(p, k);
    gl.uniform1f(u('U0'), U0); gl.uniform1f(u('tau0'), tau0); gl.uniform1f(u('cs2'), cs * cs); gl.uniform1i(u('N'), N);
    ['f0', 'f1', 'f2'].forEach((k, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, nguon ? nguon[i] : null); gl.uniform1i(u(k), i); });
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tMask); gl.uniform1i(u('msk'), 3);
  };
  let cur = 0, curC = 0, daKiem = false;
  const pbo = gl.createBuffer();
  let mat = false;
  cv.addEventListener('webglcontextlost', () => { mat = true; });
  return {
    N, U0,
    sanSang() {
      return new Promise((ok, loi) => {
        const tham = () => {
          if (ss && ![pKhoi, pBuoc, pCong].every((p) => gl.getProgramParameter(p, ss.COMPLETION_STATUS_KHR))) { requestAnimationFrame(tham); return; }
          try { kiemLink(); daKiem = true; ok(); } catch (e) { loi(e); }
        };
        tham();
      });
    },
    batDau(mask) {
      if (!daKiem) { kiemLink(); daKiem = true; }
      const m8 = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) m8[i] = mask[i] ? 255 : 0;
      gl.bindTexture(gl.TEXTURE_2D, tMask);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RED, gl.UNSIGNED_BYTE, m8);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbBo[0]);
      datChung(pKhoi, null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cur = 0;
      fbCong.forEach((fb) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); });
      curC = 0;
    },
    chay(n, congDon) {
      if (mat) return;
      for (let k = 0; k < n; k++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbBo[1 - cur]);
        datChung(pBuoc, bo[cur]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        cur = 1 - cur;
        if (congDon) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbCong[1 - curC]);
          datChung(pCong, bo[cur]);
          gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, cong[curC]); gl.uniform1i(gl.getUniformLocation(pCong, 'acc'), 4);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          curC = 1 - curC;
        }
      }
      gl.flush();
    },
    doc() {
      if (mat) return Promise.reject(new Error('WebGL mất ngữ cảnh'));
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbCong[curC]);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, N * N * 16, gl.STREAM_READ);
      gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
      gl.flush();
      return new Promise((ok, loi) => {
        const tham = () => {
          if (mat) { loi(new Error('WebGL mất ngữ cảnh')); return; }
          const s = gl.clientWaitSync(sync, 0, 0);
          if (s === gl.TIMEOUT_EXPIRED) { requestAnimationFrame(tham); return; }
          gl.deleteSync(sync);
          if (s === gl.WAIT_FAILED) { loi(new Error('LBM: đọc lỗi')); return; }
          const out = new Float32Array(N * N * 4);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
          gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
          ok(out);
        };
        requestAnimationFrame(tham);
      });
    },
    huy() {
      [...bo.flat(), ...cong, tMask].forEach((t) => gl.deleteTexture(t));
      [...fbBo, ...fbCong].forEach((f) => gl.deleteFramebuffer(f));
      [pKhoi, pBuoc, pCong].forEach((p) => gl.deleteProgram(p));
      dsSh.forEach((x) => gl.deleteShader(x));
      gl.deleteBuffer(pbo);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
