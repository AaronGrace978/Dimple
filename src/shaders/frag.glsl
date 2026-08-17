#version 300 es
precision highp float;

// Keep in lockstep with src/sdf.ts — SCENE REV 3

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamTarget;
uniform vec3 uAgentPos;
uniform vec3 uAgentVel;
uniform float uAgentMorph;
uniform float uAgentHue;
uniform float uAgentPulse;
uniform float uThought;
uniform vec3 uVisitorPos;
uniform float uVisitorOn;
uniform vec3 uTrail0;
uniform vec3 uTrail1;
uniform vec3 uTrail2;
uniform vec3 uTrailW;
uniform float uQuality;
uniform vec3 uLookAt;
uniform float uAffection;
uniform float uSleep;
uniform vec4 uEmotion[8];
uniform float uEmotionN;
uniform float uFearMean;
uniform float uJoyMean;
uniform float uGrowth;
uniform float uTrust;
uniform vec3 uGuestPos;
uniform vec3 uGuestVel;
uniform float uGuestMorph;
uniform float uGuestHue;
uniform float uGuestOn;
uniform float uGuestGrowth;
uniform vec3 uBead0;
uniform vec3 uBead1;
uniform vec3 uBead2;
uniform vec3 uBead3;
uniform vec4 uBeadW;
uniform vec3 uHandPos;
uniform float uHandOn;
uniform float uPortalOpen;

out vec4 fragColor;

const float FOV = 1.15;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash13(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  int oct = uQuality < 0.5 ? 2 : 4;
  for (int i = 0; i < 4; i++) {
    if (i >= oct) break;
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 2.3);
    a *= 0.5;
  }
  return s;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorusXZ(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdTorusXY(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xy) - t.x, p.z);
  return length(q) - t.y;
}

vec3 hsv(float h, float s, float v) {
  vec3 c = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), c, s);
}

float sdOctahedron(vec3 p, float s) {
  p = abs(p);
  return (p.x + p.y + p.z - s) * 0.57735027;
}

float sdCappedCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

vec2 feelXZ(vec2 xz) {
  float fear = 0.0;
  float joy = 0.0;
  int n = int(uEmotionN + 0.5);
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    vec4 e = uEmotion[i];
    vec2 d = xz - e.xy;
    float w = 1.0 / (1.0 + dot(d, d) * e.w);
    if (e.z < 0.0) fear += -e.z * w;
    else joy += e.z * w;
  }
  return vec2(fear, joy);
}

float mapLanterns(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < 4; i++) {
    float a = float(i) * 1.5707963 + 0.4;
    vec3 c = vec3(cos(a) * 3.1, 2.52, sin(a) * 3.1);
    d = min(d, sdSphere(p - c, 0.1));
  }
  return d;
}

float mapCrystals(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0471976 + 0.18;
    vec3 c = vec3(cos(a) * 5.25, 0.62, sin(a) * 5.25);
    vec2 f = feelXZ(c.xz);
    float size = 0.62 * mix(1.0, 0.52, clamp(f.x, 0.0, 1.0)) * mix(1.0, 1.28, clamp(f.y, 0.0, 1.0));
    vec3 q = p - c;
    d = min(d, sdOctahedron(q, size));
    d = min(d, sdOctahedron(q - vec3(0.0, 0.72, 0.0), size * 0.45));
  }
  return d;
}

float mapWorld(vec3 p) {
  float r = length(p.xz);
  float hills = 0.62 * sin(p.x * 0.21 + 0.7) * sin(p.z * 0.18 - 0.4);
  float ground = p.y - mix(0.0, hills, smoothstep(8.2, 13.5, r));
  ground -= uJoyMean * 0.07;
  ground += uFearMean * 0.03;
  float d = ground;

  float pool = max(abs(p.y - 0.025) - 0.02, r - 1.12);
  d = min(d, pool);

  d = min(d, sdCappedCylinder(p - vec3(0.0, 0.06, 0.0), 0.06, 1.28));
  d = min(d, sdTorusXZ(p - vec3(0.0, 0.05, 0.0), vec2(1.55, 0.045)));
  d = min(d, sdTorusXZ(p - vec3(0.0, 0.07, 0.0), vec2(2.45, 0.05)));
  d = min(d, sdTorusXZ(p - vec3(0.0, 0.08, 0.0), vec2(4.2, 0.08)));
  d = min(d, sdTorusXZ(p, vec2(6.8, 0.22)));
  d = min(d, sdTorusXZ(p - vec3(0.0, 0.12, 0.0), vec2(8.4, 0.16)));

  for (int i = 0; i < 4; i++) {
    float a = float(i) * 1.5707963 + 0.4;
    vec3 c = vec3(cos(a) * 3.1, 1.15, sin(a) * 3.1);
    vec2 f = feelXZ(c.xz);
    float al = length(c.xz);
    vec2 away = al > 0.01 ? c.xz / al : vec2(1.0, 0.0);
    c.xz += away * f.x * 0.42;
    c.y += f.y * 0.12;
    d = min(d, sdBox(p - c, vec3(0.28, 1.15, 0.28)));
    d = min(d, sdBox(p - c - vec3(0.0, 1.22, 0.0), vec3(0.38, 0.08, 0.38)));
  }

  d = min(d, mapCrystals(p));
  d = min(d, mapLanterns(p));

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a = uTime * 0.17 + fi * 2.094395;
    vec3 c = vec3(cos(a) * 2.35, 1.55 + 0.35 * sin(uTime * 0.31 + fi), sin(a) * 2.35);
    d = min(d, sdSphere(p - c, 0.20 - fi * 0.04));
  }

  vec3 portal = p - vec3(0.0, 1.15, -4.55);
  d = min(d, sdTorusXY(portal, vec2(0.95 + 0.08 * uPortalOpen, 0.07 + 0.03 * uPortalOpen)));
  d = min(d, sdBox(p - vec3(-1.05, 1.0, -4.55), vec3(0.12, 1.0, 0.12)));
  d = min(d, sdBox(p - vec3(1.05, 1.0, -4.55), vec3(0.12, 1.0, 0.12)));
  d = min(d, sdBox(p - vec3(0.0, 2.12, -4.55), vec3(1.18, 0.1, 0.12)));
  return d;
}

float mapAgent(vec3 p) {
  vec3 q = p - uAgentPos;
  float sp = length(uAgentVel);
  if (sp > 0.04) {
    vec3 vn = uAgentVel / sp;
    float along = dot(q, vn);
    vec3 par = vn * along;
    vec3 perp = q - par;
    float k = clamp(sp * 0.32, 0.0, 0.5);
    q = par * (1.0 - k) + perp * (1.0 + k * 0.4);
  }
  q.y *= mix(1.0, 1.7, uSleep);
  float t = uTime;
  float g = clamp(uGrowth, 0.04, 1.0);
  float breath = mix(0.055, 0.20, g) + 0.03 * sin(t * 2.6) + 0.05 * uAgentPulse;
  breath *= mix(1.0, 0.88, uSleep);
  float core = sdSphere(q, breath);

  float lobes = 1e5;
  int lobeN = g < 0.1 ? 0 : 3;
  if (uQuality > 0.5 && g > 0.42) lobeN = 5;
  for (int i = 0; i < 5; i++) {
    if (i >= lobeN) break;
    float fi = float(i);
    float a = t * (1.15 + 0.25 * uAgentMorph) + fi * 2.094395;
    float b = t * 0.9 + fi * 1.7;
    float spread = mix(0.08, 0.15 + 0.12 * uAgentMorph, g);
    vec3 o = vec3(
      cos(a) * spread * mix(1.0, 0.35, uSleep),
      sin(b) * (0.09 + 0.08 * uAgentMorph) * mix(1.0, 0.2, uSleep) * g,
      sin(a) * spread * mix(1.0, 0.35, uSleep)
    );
    lobes = smin(lobes, sdSphere(q - o, 0.05 + 0.04 * g + 0.02 * sin(t * 2.2 + fi)), 0.1);
  }

  float body = lobeN > 0 ? smin(core, lobes, 0.13) : core;

  if (uThought > 0.01 && uSleep < 0.7 && g > 0.14) {
    body = smin(body, sdSphere(q - vec3(0.0, 0.26, 0.0), 0.05 + 0.07 * uThought), 0.08);
  }

  float tw = mix(0.35, 1.0, g);
  body = smin(body, sdSphere(p - uTrail0, 0.09 * uTrailW.x * tw * mix(1.0, 0.4, uSleep)), 0.16);
  body = smin(body, sdSphere(p - uTrail1, 0.08 * uTrailW.y * tw * mix(1.0, 0.4, uSleep)), 0.16);
  body = smin(body, sdSphere(p - uTrail2, 0.07 * uTrailW.z * tw * mix(1.0, 0.4, uSleep)), 0.16);

  if (uGuestOn > 0.5) {
    float gap = length(uAgentPos - uGuestPos);
    if (gap < 1.85) {
      vec3 gq = p - uGuestPos;
      float gb = sdSphere(gq, mix(0.07, 0.18, clamp(uGuestGrowth, 0.04, 1.0)));
      float k = mix(0.3, 0.1, smoothstep(0.25, 1.85, gap));
      body = smin(body, gb, k);
    }
  }

  return body;
}

float mapGuestBody(vec3 p) {
  if (uGuestOn < 0.5) return 1e5;
  vec3 q = p - uGuestPos;
  float sp = length(uGuestVel);
  if (sp > 0.04 && uQuality > 0.5) {
    vec3 vn = uGuestVel / sp;
    float along = dot(q, vn);
    q = vn * along * 0.78 + (q - vn * along) * 1.12;
  }
  float g = clamp(uGuestGrowth, 0.04, 1.0);
  float core = sdSphere(q, mix(0.06, 0.17, g) * mix(0.9, 1.12, uGuestMorph));
  if (uQuality < 0.5) return core;
  float lobes = 1e5;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a = uTime * 1.05 + fi * 2.094395;
    vec3 o = vec3(cos(a) * 0.12 * g, sin(uTime * 0.8 + fi) * 0.07 * g, sin(a) * 0.12 * g);
    lobes = smin(lobes, sdSphere(q - o, 0.06), 0.1);
  }
  return smin(core, lobes, 0.12);
}

float mapBeads(vec3 p) {
  float d = 1e5;
  d = min(d, sdSphere(p - uBead0, 0.04 * uBeadW.x));
  d = min(d, sdSphere(p - uBead1, 0.038 * uBeadW.y));
  if (uQuality > 0.5) {
    d = min(d, sdSphere(p - uBead2, 0.036 * uBeadW.z));
    d = min(d, sdSphere(p - uBead3, 0.034 * uBeadW.w));
  }
  return d;
}

float mapHand(vec3 p) {
  if (uHandOn < 0.5) return 1e5;
  return sdSphere(p - uHandPos, 0.09 + 0.02 * uTrust);
}

vec3 agentLook() {
  vec3 look = uLookAt - uAgentPos;
  float ll = length(look);
  look = ll < 0.001 ? vec3(0.0, 0.0, 1.0) : look / ll;
  return normalize(mix(look, vec3(0.0, -1.0, 0.12), uSleep * 0.85));
}

float mapEyes(vec3 p) {
  vec3 look = agentLook();
  vec3 upRef = abs(look.y) > 0.92 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(look, upRef));
  vec3 up = normalize(cross(right, look));
  float sep = 0.05 + 0.012 * uAffection;
  float fwd = 0.16 + 0.03 * uAgentPulse;
  float lift = mix(0.04, -0.012, uSleep);
  vec3 mid = uAgentPos + look * fwd + up * lift;
  float r = mix(0.027, 0.035, uAffection);
  vec3 q1 = p - (mid + right * sep);
  vec3 q2 = p - (mid - right * sep);
  float squash = mix(1.0, 3.2, uSleep);
  q1.y *= squash;
  q2.y *= squash;
  float er = r * mix(1.0, 0.42, uSleep);
  return min(length(q1) - er, length(q2) - er);
}

float mapVisitor(vec3 p) {
  if (uVisitorOn < 0.5) return 1e5;
  return sdSphere(p - uVisitorPos, 0.11);
}

vec2 map(vec3 p) {
  float w = mapWorld(p);
  float a = mapAgent(p);
  float v = mapVisitor(p);
  float e = mapEyes(p);
  float b = mapBeads(p);
  float h = mapHand(p);
  float d = w;
  float id = 1.0;
  if (a < d) { d = a; id = 2.0; }
  if (v < d) { d = v; id = 3.0; }
  if (e < d) { d = e; id = 4.0; }
  if (b < d) { d = b; id = 5.0; }
  if (h < d) { d = h; id = 7.0; }
  if (uGuestOn > 0.5 && length(uAgentPos - uGuestPos) > 1.6) {
    float g = mapGuestBody(p);
    if (g < d) { d = g; id = 6.0; }
  }
  return vec2(d, id);
}

vec3 calcNormal(vec3 p) {
  const float e = 0.0007;
  vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * map(p + k.xyy * e).x +
    k.yyx * map(p + k.yyx * e).x +
    k.yxy * map(p + k.yxy * e).x +
    k.xxx * map(p + k.xxx * e).x
  );
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  int taps = uQuality < 0.5 ? 2 : (uQuality < 1.5 ? 3 : 5);
  for (int i = 0; i < 5; i++) {
    if (i >= taps) break;
    float h = 0.01 + 0.12 * float(i);
    float d = map(p + n * h).x;
    occ += (h - d) * sca;
    sca *= 0.85;
  }
  return clamp(1.0 - 1.8 * occ, 0.0, 1.0);
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0;
  float t = mint;
  int taps = uQuality < 0.5 ? 8 : (uQuality < 1.5 ? 14 : 24);
  for (int i = 0; i < 24; i++) {
    if (i >= taps) break;
    float h = map(ro + rd * t).x;
    res = min(res, 16.0 * h / t);
    t += clamp(h, 0.02, 0.35);
    if (res < 0.02 || t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 sky(vec3 rd) {
  vec3 col = mix(vec3(0.02, 0.03, 0.07), vec3(0.001, 0.002, 0.01), rd.y * 0.5 + 0.5);
  col += vec3(0.1, 0.04, 0.14) * pow(smoothstep(0.4, -0.05, rd.y), 2.0);
  float n = fbm(rd * 3.4);
  col += vec3(0.14, 0.05, 0.24) * pow(n, 3.0) * smoothstep(-0.15, 0.45, rd.y);
  if (uQuality > 0.5) {
    col += vec3(0.04, 0.09, 0.2) * pow(fbm(rd * 6.2 + 8.0), 4.0);
    float band = exp(-pow(rd.x * 0.4 + rd.z * 0.18 - rd.y * 0.12, 2.0) * 16.0);
    col += vec3(0.2, 0.18, 0.32) * band * fbm(rd * 11.0);
  }
  col += vec3(0.85, 0.9, 1.0) * pow(hash(rd.xy * 220.0), 80.0) * smoothstep(-0.05, 0.4, rd.y);
  col += vec3(0.65, 0.78, 1.0) * pow(hash(rd.yz * 90.0 + 3.1), 140.0) * 1.3;
  vec3 pd = normalize(vec3(-0.55, 0.32, 0.62));
  float ang = length(rd - pd);
  col += vec3(0.42, 0.2, 0.55) * smoothstep(0.11, 0.078, ang);
  col += vec3(0.9, 0.84, 1.0) * smoothstep(0.082, 0.068, ang) * 0.4;
  if (uQuality > 0.5) {
    col += vec3(0.04, 0.16, 0.12) * pow(fbm(rd * 2.2 + vec3(uTime * 0.03, 0.0, 0.0)), 5.0) * smoothstep(0.0, 0.45, rd.y);
  }
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  vec3 ro = uCamPos;
  vec3 fwd = normalize(uCamTarget - uCamPos);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 rd = normalize(fwd + uv.x * right * FOV + uv.y * up * FOV);

  float t = 0.0;
  float glow = 0.0;
  float visGlow = 0.0;
  float lampGlow = 0.0;
  float portalGlow = 0.0;
  vec2 hit = vec2(1e5, 0.0);
  bool found = false;

  int maxSteps = uQuality < 0.5 ? 48 : (uQuality < 1.5 ? 64 : 88);
  for (int i = 0; i < 88; i++) {
    if (i >= maxSteps) break;
    vec3 p = ro + rd * t;
    hit = map(p);
    float da = length(p - uAgentPos) - 0.22;
    glow += 0.018 / (0.012 + da * da);
    if (mod(float(i), 2.0) < 0.5) {
      float dl = mapLanterns(p);
      lampGlow += 0.012 / (0.01 + dl * dl);
      vec3 pr = p - vec3(0.0, 1.15, -4.55);
      float dp = sdTorusXY(pr, vec2(0.95, 0.07));
      portalGlow += 0.01 / (0.02 + dp * dp);
    }
    if (uVisitorOn > 0.5) {
      float dv = length(p - uVisitorPos) - 0.11;
      visGlow += 0.01 / (0.02 + dv * dv);
    }
    if (hit.x < 0.0007) { found = true; break; }
    t += hit.x;
    if (t > 55.0) break;
  }

  vec3 col = sky(rd);
  vec3 p = ro + rd * t;

  if (found) {
    vec3 n = calcNormal(p);
    vec3 l = normalize(vec3(0.35, 0.88, 0.28));
    vec3 l2 = normalize(vec3(-0.55, 0.4, 0.55));
    vec3 toDimple = uAgentPos - p;
    float dimpleAtt = 1.0 / (0.4 + dot(toDimple, toDimple));
    vec3 ld = normalize(toDimple);
    float diff = clamp(dot(n, l), 0.0, 1.0);
    float diff2 = clamp(dot(n, l2), 0.0, 1.0);
    float diffD = clamp(dot(n, ld), 0.0, 1.0) * dimpleAtt;
    float spec = pow(clamp(dot(reflect(-l, n), -rd), 0.0, 1.0), 42.0);
    float sha = softShadow(p + n * 0.02, l, 0.02, 18.0);
    float ao = calcAO(p, n);
    float fre = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);

    vec3 albedo = vec3(0.07, 0.075, 0.08);
    vec3 emit = vec3(0.0);
    float rr = length(p.xz);
    float lanternHit = mapLanterns(p);
    float crystalHit = mapCrystals(p);
    bool water = p.y < 0.07 && rr < 1.18;
    bool gold = abs(rr - 1.55) < 0.12 || abs(rr - 2.45) < 0.12 || abs(rr - 4.2) < 0.18 || abs(rr - 6.8) < 0.32;

    if (hit.y < 1.5) {
      if (lanternHit < 0.12) {
        emit = vec3(1.0, 0.72, 0.38) * 2.2;
        albedo = vec3(0.4, 0.28, 0.12);
      } else if (crystalHit < 0.08) {
        albedo = vec3(0.18, 0.12, 0.32);
        float pulse = 0.55 + 0.35 * sin(uTime * 1.7 + rr);
        emit = vec3(0.35, 0.18, 0.7) * pulse * mix(0.35, 1.0, 1.0 - clamp(uFearMean, 0.0, 1.0));
        emit += vec3(0.55, 0.32, 0.12) * uJoyMean * 0.45;
      } else if (water) {
        albedo = vec3(0.04, 0.1, 0.14);
      } else {
        float vein = fbm(p * 1.7);
        albedo = mix(vec3(0.035, 0.038, 0.048), vec3(0.11, 0.1, 0.09), vein);
        float grid = abs(fract(p.x * 0.35) - 0.5) + abs(fract(p.z * 0.35) - 0.5);
        albedo += vec3(0.03, 0.025, 0.02) * smoothstep(0.03, 0.0, abs(grid - 0.5)) * step(p.y, 0.08);
        if (gold) albedo = mix(albedo, vec3(0.32, 0.22, 0.1), 0.7);
        if (p.y > 0.25 && p.y < 2.4 && crystalHit > 0.2) {
          albedo = mix(albedo, vec3(0.08, 0.078, 0.09), 0.6);
        }
      }
    } else if (hit.y < 2.5) {
      vec3 agentCol = hsv(uAgentHue, 0.45 - 0.12 * uAffection, mix(0.55, 1.0, uGrowth));
      albedo = agentCol * 0.15;
      emit = agentCol * (1.15 + 0.8 * uAgentPulse + 0.6 * uThought + 0.5 * uAffection);
      emit *= mix(1.0, 0.4, uSleep);
      emit *= mix(0.55, 1.0, 0.4 + 0.6 * uGrowth);
    } else if (hit.y < 3.5) {
      albedo = vec3(0.2, 0.55, 0.7);
      emit = vec3(0.35, 0.85, 1.0) * 1.4;
    } else if (hit.y < 4.5) {
      albedo = vec3(0.025, 0.03, 0.045);
      float spark = pow(clamp(dot(n, -rd), 0.0, 1.0), 22.0);
      emit = vec3(0.92, 0.96, 1.0) * spark * (1.3 + 0.8 * uAffection) * mix(1.0, 0.15, uSleep);
    } else if (hit.y < 5.5) {
      albedo = hsv(uAgentHue + 0.08, 0.35, 0.8) * 0.2;
      emit = hsv(uAgentHue + 0.08, 0.4, 1.0) * 1.1;
    } else if (hit.y < 6.5) {
      vec3 guestCol = hsv(uGuestHue, 0.4, 1.0);
      albedo = guestCol * 0.14;
      emit = guestCol * (1.0 + 0.5 * uGuestGrowth);
    } else {
      albedo = vec3(0.3, 0.85, 0.9) * 0.2;
      emit = vec3(0.45, 0.95, 1.0) * (1.1 + 0.8 * uTrust);
    }

    vec3 agentCol = hsv(uAgentHue, 0.5, 1.0);
    vec3 lit = albedo * (0.05 + 0.75 * diff * sha + 0.25 * diff2 + 0.55 * diffD * agentCol) * ao;
    lit += spec * sha * vec3(0.75, 0.72, 0.65) * (water ? 1.1 : 0.32);
    lit += fre * vec3(0.1, 0.14, 0.22);
    lit += emit;
    col = lit;

    if ((water || (hit.y < 1.5 && p.y < 0.08)) && lanternHit > 0.12) {
      vec3 rrd = reflect(rd, n);
      vec3 rcol = sky(rrd);
      if (uQuality > 0.45) {
        float rt = 0.03;
        int rsteps = uQuality < 1.5 ? 12 : 28;
        for (int i = 0; i < 28; i++) {
          if (i >= rsteps) break;
          vec3 rp = p + rrd * rt;
          float h = map(rp).x;
          if (h < 0.002) {
            vec3 rn = calcNormal(rp);
            rcol = vec3(0.07, 0.08, 0.1) * (0.2 + 0.8 * clamp(dot(rn, l), 0.0, 1.0));
            if (mapAgent(rp) < 0.05) rcol += hsv(uAgentHue, 0.4, 1.0) * 0.9;
            if (mapLanterns(rp) < 0.12) rcol += vec3(1.0, 0.7, 0.35);
            break;
          }
          rt += h;
          if (rt > 16.0) break;
        }
      }
      col = mix(col, rcol, water ? 0.55 + 0.3 * fre : 0.2 + 0.22 * fre);
    }
  }

  vec3 agentCol = hsv(uAgentHue, 0.5, 1.0);
  col += agentCol * min(glow * 0.045, 1.6);
  col += vec3(0.35, 0.8, 1.0) * min(visGlow * 0.05, 0.8);
  col += vec3(1.0, 0.72, 0.35) * min(lampGlow * 0.04, 1.1);
  col += vec3(0.35, 0.7, 1.0) * min(portalGlow * (0.035 + 0.05 * uPortalOpen), 1.2);

  float fog = 1.0 - exp(-0.0007 * t * t);
  col = mix(col, sky(rd), found ? fog : 0.0);

  if (uQuality > 0.5) {
    float cloud = 0.0;
    float ct = 3.5;
    int csteps = uQuality < 1.5 ? 8 : 16;
    for (int i = 0; i < 16; i++) {
      if (i >= csteps) break;
      vec3 cp = ro + rd * ct;
      if (cp.y > 2.1 && cp.y < 6.0) {
        float dens = fbm(cp * 0.27 + vec3(uTime * 0.03, 0.0, uTime * 0.015));
        dens = smoothstep(0.52, 0.78, dens);
        dens *= smoothstep(2.1, 2.9, cp.y) * smoothstep(6.0, 4.5, cp.y);
        cloud += dens * 0.09;
      }
      ct += 0.52;
    }
    float cloudAmt = clamp(cloud, 0.0, 0.72) * mix(1.0, smoothstep(4.0, 14.0, t), found ? 1.0 : 0.0);
    if (!found) cloudAmt = clamp(cloud, 0.0, 0.72);
    col = mix(col, vec3(0.62, 0.66, 0.82), cloudAmt * 0.85);
  }

  col *= 0.28 + 0.72 * pow(16.0 * gl_FragCoord.x / uResolution.x * gl_FragCoord.y / uResolution.y *
    (1.0 - gl_FragCoord.x / uResolution.x) * (1.0 - gl_FragCoord.y / uResolution.y), 0.18);

  col = col / (1.0 + col);
  col = pow(col, vec3(0.4545));

  fragColor = vec4(col, 1.0);
}
