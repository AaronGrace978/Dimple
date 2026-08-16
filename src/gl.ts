export function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("Could not create shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "unknown shader error";
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

export function program(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
): WebGLProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  const p = gl.createProgram();
  if (!p) throw new Error("Could not create program");
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) ?? "unknown link error";
    gl.deleteProgram(p);
    throw new Error(log);
  }
  return p;
}

export function loc(
  gl: WebGL2RenderingContext,
  p: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const u = gl.getUniformLocation(p, name);
  if (!u) throw new Error(`Missing uniform ${name}`);
  return u;
}
