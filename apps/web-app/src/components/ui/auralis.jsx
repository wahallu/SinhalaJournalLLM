import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Auralis — WebGL ambient background: layered simplex noise, a glowing light
 * band, and film grain.
 *
 * Ported from a Next.js/TypeScript original. What changed and why:
 *
 *   Colour.  The original is near-black (`vec3(0.02, 0.01, 0.01)` base over a
 *            `#010103` container) with red glows floating on it. Here it has
 *            to *be* the brand red, so the flat base became a `u_base`
 *            uniform, the additive weights were rebalanced so peaks land on
 *            brand-600 instead of clipping to white, and the vignette now
 *            fades toward a darker base rather than to black — on a red panel
 *            the original vignette read as four dirty corners.
 *
 *   Cost.    An unconditional rAF loop runs forever. This sits on the
 *            dashboard, so it pauses when the tab is hidden or the section
 *            scrolls out of view, and honours prefers-reduced-motion by
 *            drawing one frame and stopping.
 *
 *   Safety.  Shader compilation and WebGL acquisition are reported instead of
 *            failing silently — `onUnsupported` lets the caller keep its own
 *            painted background rather than showing a blank canvas.
 *
 * @param {object} props
 * @param {string[]} [props.colors]  Two colours are used: [0] the noise field, [1] the light band.
 * @param {string} [props.base]      Flat colour everything is added on top of.
 * @param {number} [props.speed]
 * @param {number} [props.grain]
 * @param {string} [props.height]
 * @param {string} [props.className]
 * @param {() => void} [props.onUnsupported]  Called once if WebGL is unavailable or the program fails to build.
 */

const vertexShaderGLSL = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderGLSL = `
precision highp float;
varying vec2 vUv;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_grain;
uniform vec3  u_base;
uniform vec3  u_colors[2];

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vUv;
  float ratio = u_resolution.x / u_resolution.y;
  vec2 p = uv * vec2(ratio, 1.0);
  float t = u_time * 0.2;

  float n1 = snoise(p * 0.5 + t);
  float n2 = snoise(p * 0.9 - t * 0.5 + n1);

  float light = pow(abs(n2), 2.5) * 0.5;

  // Starts on the brand red rather than near-black, so the additive layers
  // below lighten an already-red field instead of revealing red out of the
  // dark. The 0.42 / 0.40 weights are what keep the peaks at roughly
  // brand-600 — at the original 0.5 / 1.0 the red channel clipped and the
  // bright bands went pink.
  vec3 col = u_base;
  col += u_colors[0] * smoothstep(0.1, 1.0, n1) * 0.42;
  // 0.40, not the 1.0 the original used: the light band is brand-400, which
  // is already pale, and at full weight its peaks went to near-white — fine
  // over the original's black field, but here white text sits on top of it.
  col += u_colors[1] * light * 0.40;

  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + u_time);
  col += (grain - 0.5) * u_grain * 0.5;

  // Toward a darker red, not toward black: multiplying by the vignette (as
  // the original did) drags the corners to near-black, which on a red panel
  // reads as dirt rather than depth.
  float dist = length(uv - 0.5);
  col = mix(u_base * 0.72, col, smoothstep(1.45, 0.15, dist));

  gl_FragColor = vec4(col, 1.0);
}
`;

const DEFAULT_COLORS = ['#cd191a', '#e97371']; // brand-600, brand-400
const DEFAULT_BASE = '#8d1213'; // brand-800

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  // The original never checked this, so a shader that failed to build left a
  // blank canvas and no explanation.
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Auralis shader failed to compile: ${log}`);
  }
  return shader;
}

export function Auralis({
  colors = DEFAULT_COLORS,
  base = DEFAULT_BASE,
  speed = 0.3,
  grain = 0.6,
  height = '100%',
  className,
  onUnsupported,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  // Held in a ref for the same reason `colors` is serialised below: an inline
  // arrow from the caller is a new identity every render, and in the effect's
  // dependency list that would rebuild the WebGL program on each one.
  const onUnsupportedRef = useRef(onUnsupported);
  useEffect(() => { onUnsupportedRef.current = onUnsupported; }, [onUnsupported]);

  // Serialised, so a caller passing an inline array literal does not tear the
  // WebGL program down and rebuild it on every single render.
  const colorKey = colors.join(',');

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) {
      setFailed(true);
      onUnsupportedRef.current?.();
      return undefined;
    }

    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexShaderGLSL));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShaderGLSL));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'link failed');
      }
    } catch (err) {
      console.error(err);
      setFailed(true);
      onUnsupportedRef.current?.();
      return undefined;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const locs = {
      res: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      grain: gl.getUniformLocation(program, 'u_grain'),
      baseColor: gl.getUniformLocation(program, 'u_base'),
      colors: gl.getUniformLocation(program, 'u_colors'),
    };

    // Constant for the lifetime of the effect — no reason to re-upload per frame.
    gl.uniform1f(locs.grain, grain);
    gl.uniform3fv(locs.baseColor, new Float32Array(hexToRgb(base)));
    gl.uniform3fv(
      locs.colors,
      new Float32Array(colorKey.split(',').slice(0, 2).flatMap(hexToRgb))
    );

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = Math.max(1, Math.round(container.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(container.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    const draw = (timeSeconds) => {
      gl.uniform2f(locs.res, canvas.width, canvas.height);
      gl.uniform1f(locs.time, timeSeconds);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let raf = 0;
    let running = false;
    let visible = true;

    const frame = (t) => {
      draw(t * 0.001 * speed);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      // One static frame instead of a permanent animation: this is decorative
      // motion behind a heading, exactly what the preference is asking about.
      if (reduceMotion.matches) {
        draw(0);
        return;
      }
      running = true;
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const sync = () => {
      if (visible && !document.hidden) start();
      else stop();
    };

    const ro = new ResizeObserver(() => {
      resize();
      // Repaint immediately so a resize while paused is not left stretched.
      if (!running) draw(0);
    });
    ro.observe(container);

    // Scrolled past the hero, there is nothing to animate for.
    const io = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; sync(); },
      { threshold: 0 }
    );
    io.observe(container);

    document.addEventListener('visibilitychange', sync);
    reduceMotion.addEventListener('change', sync);
    sync();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      reduceMotion.removeEventListener('change', sync);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      // Deliberately NOT WEBGL_lose_context here. The canvas element outlives
      // this effect — StrictMode remounts it, and so does any prop change —
      // and a lost context is permanent for that canvas: getContext returns
      // the same dead one, every subsequent compile fails with a null info
      // log, and the component silently falls back forever. The context is
      // released with the canvas when React unmounts it.
    };
  }, [colorKey, base, speed, grain]);

  // Nothing is painted here on failure — the caller keeps whatever background
  // it already had, which for the dashboard hero is the flat brand red.
  if (failed) return null;

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className={cn('relative w-full overflow-hidden', className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

export default Auralis;
