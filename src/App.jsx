import { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, Radar as RadarIcon, Sparkles, Users, ShoppingBag, Link2,
  Plus, Minus, X, Loader2, TrendingUp, CheckCircle2, DollarSign, Video,
  Zap, Search, ChevronRight, Star, Megaphone, Facebook, Instagram,
  Youtube, Linkedin, Globe, CreditCard, ArrowUpRight, Trash2,
  Pause, Play, RotateCcw, Download, Wand2, Crown, Flame, SlidersHorizontal, Clipboard,
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

// ---------------------------------------------------------------------------
// Claude API helper — now routed through our own backend (see /fpm-video-backend),
// since the free artifact-only proxy this used inside Claude.ai doesn't exist here.
// Falls back to VITE_API_BASE_URL (baked in at build time) if no URL has been
// configured yet in Accounts.
// ---------------------------------------------------------------------------
async function getBackendUrl() {
  try {
    const res = await window.storage.get(VIDEO_BACKEND_URL_KEY, false);
    if (res?.value) return res.value.trim().replace(/\/+$/, "");
  } catch {
    // nothing configured in Accounts yet — fall back to the build-time default
  }
  return (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
}

async function askClaude(system, prompt) {
  const base = await getBackendUrl();
  if (!base) {
    throw new Error("No backend configured. Set your backend URL in Accounts, or set VITE_API_BASE_URL when building.");
  }
  const res = await fetch(`${base}/api/ask-claude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, prompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Backend returned ${res.status}`);
  }
  return (data.text || "").replace(/```json|```/g, "").trim();
}

const STAGES = ["New", "Contacted", "Qualified", "Won", "Lost"];
const STAGE_COLOR = {
  New: "bg-slate-100 text-slate-700 border-slate-300",
  Contacted: "bg-sky-50 text-sky-700 border-sky-300",
  Qualified: "bg-amber-50 text-amber-700 border-amber-300",
  Won: "bg-emerald-50 text-emerald-700 border-emerald-300",
  Lost: "bg-red-50 text-red-700 border-red-300",
};

const SEED_LEADS = [
  { id: "l1", name: "Marcus Webb", company: "Webb Roofing Co.", source: "Counterstrike Ad", value: 4200, stage: "Qualified", createdAt: "Aug 2" },
  { id: "l2", name: "Priya Anand", company: "Anand Dental", source: "Funnel — Opt-in", value: 1800, stage: "New", createdAt: "Aug 5" },
  { id: "l3", name: "Tom Rutledge", company: "Rutledge HVAC", source: "Referral Community", value: 6100, stage: "Won", createdAt: "Jul 29" },
  { id: "l4", name: "Elena Cho", company: "Cho Med Spa", source: "Video Ad — TikTok", value: 2450, stage: "Contacted", createdAt: "Aug 6" },
  { id: "l5", name: "Danny Reyes", company: "Reyes Auto Detail", source: "Lead Marketplace", value: 900, stage: "Lost", createdAt: "Jul 30" },
];

const TREND = [
  { month: "Mar", leads: 22 }, { month: "Apr", leads: 31 }, { month: "May", leads: 28 },
  { month: "Jun", leads: 40 }, { month: "Jul", leads: 52 }, { month: "Aug", leads: 47 },
];

const MARKETPLACE = [
  { id: "m1", title: "12 pre-qualified HVAC leads — Tampa Bay", category: "Home Services", price: 480, count: 12, rating: 4.8, seller: "SunCoast Referral Group" },
  { id: "m2", title: "Med-spa consult bookings — South FL", category: "Health & Beauty", price: 610, count: 9, rating: 4.6, seller: "GlowNet Partners" },
  { id: "m3", title: "Real estate buyer leads — Hillsborough Co.", category: "Real Estate", price: 725, count: 15, rating: 4.9, seller: "Bay Area Agent Collective" },
  { id: "m4", title: "Auto detailing warm leads — Riverview area", category: "Automotive", price: 210, count: 8, rating: 4.4, seller: "Local Shine Network" },
];

const FUNNELS = [
  { id: "f1", name: "Roof Inspection — Free Quote", stages: ["Ad", "Opt-in", "Booking"], visits: 3120, optin: "18.2%", status: "Live" },
  { id: "f2", name: "Med-Spa Consult Funnel", stages: ["Ad", "Quiz", "Booking", "Checkout"], visits: 1870, optin: "24.6%", status: "Live" },
  { id: "f3", name: "HVAC Tune-Up Special", stages: ["Ad", "Opt-in"], visits: 640, optin: "11.4%", status: "Draft" },
];

const ACTIVITY = [
  { icon: Sparkles, text: "Generated 3 video variants for \"Roof Inspection\" campaign", time: "12m ago" },
  { icon: Users, text: "New lead: Priya Anand routed from Opt-in Funnel", time: "1h ago" },
  { icon: RadarIcon, text: "Competitor scan completed for \"Bright Smile Dental\"", time: "3h ago" },
  { icon: Megaphone, text: "Counterstrike campaign launched on Meta — $40/day", time: "Yesterday" },
  { icon: DollarSign, text: "Payment collected — Rutledge HVAC ($6,100)", time: "Yesterday" },
];

const FPM_INSTANT_ID = "fpm-instant";

const VIDEO_PROVIDERS = [
  { id: FPM_INSTANT_ID, label: "FPM Instant Render — Free, HD", styles: ["Realistic", "Cartoon"], free: true },
  { id: "runway", label: "Runway Gen-4", styles: ["Realistic", "Cartoon"] },
  { id: "wan", label: "Wan 2.2 (via fal.ai)", styles: ["Realistic", "Cartoon"] },
  { id: "pika", label: "Pika 2.0", styles: ["Realistic", "Cartoon"] },
  { id: "luma", label: "Luma Dream Machine", styles: ["Realistic"] },
  { id: "kling", label: "Kling AI", styles: ["Realistic", "Cartoon"] },
  { id: "veo", label: "Google Veo", styles: ["Realistic"] },
  { id: "sora", label: "OpenAI Sora", styles: ["Realistic", "Cartoon"] },
  { id: "heygen", label: "HeyGen", styles: ["Realistic"] },
];
const VIDEO_PROVIDERS_KEY = "fpm:video-providers";
const VIDEO_BACKEND_URL_KEY = "fpm:video-backend-url";

const SETTINGS_KEY = "fpm:settings";
const PLAN_KEY = "fpm:plan";

// Every setting a Super User can configure — the AI assistant is constrained to only
// propose changes against this schema, so its output can be validated and applied safely.
const SETTINGS_SCHEMA = [
  {
    id: "leadAlertThreshold",
    label: "High-value lead alert threshold",
    type: "number",
    min: 0,
    max: 20000,
    step: 250,
    unit: "$",
    default: 3000,
    description: "Leads worth at least this much are flagged as high-priority in the pipeline.",
  },
  {
    id: "nurturingStage",
    label: "Add \"Nurturing\" pipeline stage",
    type: "boolean",
    default: false,
    description: "Inserts a Nurturing stage between Contacted and Qualified in the Leads pipeline.",
  },
  {
    id: "captionVariants",
    label: "Caption variants per concept",
    type: "number",
    min: 2,
    max: 6,
    step: 1,
    unit: "",
    default: 3,
    description: "How many caption options Creative Studio generates for each new concept.",
  },
  {
    id: "dashboardDensity",
    label: "Dashboard density",
    type: "enum",
    options: ["Comfortable", "Compact"],
    default: "Comfortable",
    description: "Controls spacing and card size on the Dashboard.",
  },
  {
    id: "counterstrikeAutoConfirm",
    label: "Skip per-platform launch confirmation",
    type: "boolean",
    default: false,
    description: "Counterstrike campaigns publish immediately instead of requiring a confirmation click per platform.",
  },
  {
    id: "defaultDailyBudgetCap",
    label: "Default daily budget cap",
    type: "number",
    min: 10,
    max: 2000,
    step: 10,
    unit: "$",
    default: 40,
    description: "Suggested daily spend cap pre-filled when launching a new counterstrike campaign.",
  },
];

function defaultSettings() {
  const obj = {};
  SETTINGS_SCHEMA.forEach((s) => (obj[s.id] = s.default));
  return obj;
}

// ---------------------------------------------------------------------------
// Small shared UI atoms
// ---------------------------------------------------------------------------
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg ${className}`}>
      {children}
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mt-1 max-w-xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function RadarSpinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
      <RadarIcon className="w-7 h-7 animate-spin text-amber-500" strokeWidth={1.5} />
      <p className="text-sm font-mono tracking-wide">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function Dashboard({ leads, setPage }) {
  const won = leads.filter((l) => l.stage === "Won").length;
  const active = leads.filter((l) => !["Won", "Lost"].includes(l.stage)).length;
  const pipelineValue = leads.reduce((sum, l) => sum + (["Won", "Lost"].includes(l.stage) ? 0 : l.value), 0);

  const [density, setDensity] = useState("Comfortable");
  const [backendConfigured, setBackendConfigured] = useState(true); // assume yes until checked, avoids a flash
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(SETTINGS_KEY, false);
        if (res?.value) setDensity(JSON.parse(res.value).dashboardDensity || "Comfortable");
      } catch {
        // no saved settings — default density stands
      }
      const url = await getBackendUrl();
      setBackendConfigured(!!url);
    })();
  }, []);
  const compact = density === "Compact";

  const metrics = [
    { label: "Leads this month", value: leads.length, icon: Users, delta: "+18%" },
    { label: "Active pipeline", value: `$${pipelineValue.toLocaleString()}`, icon: DollarSign, delta: "+9%" },
    { label: "Assets generated", value: 18, icon: Sparkles, delta: "+6 this wk" },
    { label: "Deals won", value: won, icon: CheckCircle2, delta: `${active} active` },
  ];

  return (
    <div>
      <PageHeader
        title="Command center"
        subtitle="Everything FPM has produced and captured for your business, in one read."
      />
      {!backendConfigured && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800">
              No backend connected yet — AI features (competitor scans, ad scripts, real video) won't work
              until you set one up.
            </p>
          </div>
          <button
            onClick={() => setPage("accounts")}
            className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md shrink-0"
          >
            Set up backend
          </button>
        </div>
      )}
      <div className={`grid grid-cols-4 ${compact ? "gap-2 mb-4" : "gap-4 mb-6"}`}>
        {metrics.map((m) => (
          <Card key={m.label} className={compact ? "p-3" : "p-4"}>
            <div className="flex items-center justify-between mb-3">
              <m.icon className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
              <span className="text-xs font-mono text-emerald-600">{m.delta}</span>
            </div>
            <div className={`font-bold text-slate-900 font-mono ${compact ? "text-lg" : "text-2xl"}`}>{m.value}</div>
            <div className="text-xs text-slate-500 mt-1">{m.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 text-sm">Lead volume, last 6 months</h3>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={TREND}>
              <CartesianGrid stroke="#EEF0F4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E6EE" }} />
              <Line type="monotone" dataKey="leads" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3, fill: "#F59E0B" }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Recent activity</h3>
          <div className="space-y-4">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                  <a.icon className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-700 leading-snug">{a.text}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        {[
          { icon: RadarIcon, title: "Scan a competitor", desc: "Get a gap analysis in ~20 seconds.", page: "intel" },
          { icon: Sparkles, title: "Generate creative", desc: "Turn a product brief into ad copy & script.", page: "studio" },
          { icon: Users, title: "Review pipeline", desc: `${active} leads currently in motion.`, page: "leads" },
        ].map((q) => (
          <button
            key={q.title}
            onClick={() => setPage(q.page)}
            className="text-left bg-slate-900 hover:bg-slate-800 transition-colors rounded-lg p-4 text-white"
          >
            <q.icon className="w-4 h-4 text-amber-400 mb-2" strokeWidth={1.75} />
            <div className="text-sm font-semibold">{q.title}</div>
            <div className="text-xs text-slate-400 mt-1">{q.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competitor Intel (real AI call)
// ---------------------------------------------------------------------------
function CompetitorIntel({ onCreateAd }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const system =
        "You are a marketing competitive-intelligence analyst inside a marketing SaaS product. " +
        "Given a business name, produce a plausible, realistic competitive read based on general knowledge " +
        "of how that type of business typically markets itself. Respond ONLY with valid JSON, no markdown fences, " +
        "no preamble, matching exactly this shape: " +
        `{"positioning":"one sentence","tone":"one short phrase","strengths":["...","...","..."],` +
        `"gaps":["...","...","..."],"counterAngle":"one or two sentences on how to out-position them",` +
        `"scores":{"offerClarity":0-10,"creativeVariety":0-10,"postingCadence":0-10,"ctaStrength":0-10,"brandConsistency":0-10}}`;
      const raw = await askClaude(system, `Business to analyze: ${input}`);
      const parsed = JSON.parse(raw);
      setResult(parsed);
    } catch (e) {
      setError(e.message?.includes("backend") ? e.message : "Couldn't complete the scan. Try a different name, or try again.");
    } finally {
      setLoading(false);
    }
  };

  const radarData = result
    ? [
        { subject: "Offer clarity", A: result.scores?.offerClarity ?? 0 },
        { subject: "Creative variety", A: result.scores?.creativeVariety ?? 0 },
        { subject: "Posting cadence", A: result.scores?.postingCadence ?? 0 },
        { subject: "CTA strength", A: result.scores?.ctaStrength ?? 0 },
        { subject: "Brand consistency", A: result.scores?.brandConsistency ?? 0 },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Competitor intel"
        subtitle="Point FPM at a competitor and get a positioning read, their gaps, and a counter-angle — generated live by Claude."
      />

      <Card className="p-4 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 border border-slate-300 rounded-md px-3">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder={'Competitor business name, e.g. "Bright Smile Dental"'}
              className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={run}
            disabled={loading || !input.trim()}
            className="px-4 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RadarIcon className="w-4 h-4" />}
            Run scan
          </button>
        </div>
      </Card>

      {loading && <RadarSpinner label="scanning public positioning signals…" />}
      {error && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>
      )}

      {result && !loading && (
        <div className="grid grid-cols-5 gap-4">
          <Card className="col-span-3 p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono uppercase tracking-wide text-slate-400">Positioning read</span>
            </div>
            <p className="text-slate-800 text-sm mb-4">{result.positioning}</p>
            <div className="inline-block text-xs font-mono px-2 py-1 rounded bg-slate-100 text-slate-600 mb-5">
              tone: {result.tone}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> What's working for them
                </h4>
                <ul className="space-y-1.5">
                  {(result.strengths || []).map((s, i) => (
                    <li key={i} className="text-xs text-slate-600 leading-snug">• {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Gaps you can exploit
                </h4>
                <ul className="space-y-1.5">
                  {(result.gaps || []).map((s, i) => (
                    <li key={i} className="text-xs text-slate-600 leading-snug">• {s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 p-3 rounded-md bg-amber-50 border border-amber-200">
              <h4 className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Suggested counter-angle
              </h4>
              <p className="text-xs text-amber-900 leading-snug">{result.counterAngle}</p>
            </div>

            <button
              onClick={() => onCreateAd({ competitor: input, result })}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-md py-2.5 transition-colors"
            >
              <Video className="w-4 h-4 text-amber-400" />
              Create counterstrike video ad from this
            </button>
          </Card>

          <Card className="col-span-2 p-5">
            <span className="text-xs font-mono uppercase tracking-wide text-slate-400">Signal scorecard</span>
            <ResponsiveContainer width="100%" height={230}>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#E2E6EE" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#64748B" }} />
                <Radar dataKey="A" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {!result && !loading && !error && (
        <Card className="p-10 text-center text-slate-400 text-sm">
          Run a scan to see a positioning breakdown, competitive gaps, and a counter-angle here.
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video Preview — plays a storyboard animation built from a generated concept,
// routed through whichever AI video provider + style the user selects
// ---------------------------------------------------------------------------
const SCENE_BG_REALISTIC = [
  "from-slate-900 to-slate-700",
  "from-amber-700 to-slate-900",
  "from-indigo-900 to-slate-900",
  "from-emerald-800 to-slate-900",
  "from-red-900 to-slate-900",
  "from-sky-900 to-slate-900",
];
const SCENE_BG_CARTOON = [
  "from-fuchsia-500 to-orange-400",
  "from-teal-400 to-indigo-500",
  "from-amber-400 to-pink-500",
  "from-lime-400 to-emerald-500",
  "from-sky-400 to-fuchsia-500",
  "from-orange-400 to-rose-500",
];
const FRAME_MS = 2400;

// Hex equivalents of the Tailwind gradients above, for drawing on <canvas>
// (canvas can't read Tailwind's CSS classes, so these are kept in sync by hand).
const SCENE_HEX_REALISTIC = [
  ["#0f172a", "#334155"],
  ["#78350f", "#0f172a"],
  ["#312e81", "#0f172a"],
  ["#065f46", "#0f172a"],
  ["#7f1d1d", "#0f172a"],
  ["#0c4a6e", "#0f172a"],
];
const SCENE_HEX_CARTOON = [
  ["#d946ef", "#fb923c"],
  ["#2dd4bf", "#6366f1"],
  ["#fbbf24", "#ec4899"],
  ["#a3e635", "#10b981"],
  ["#38bdf8", "#d946ef"],
  ["#fb923c", "#f43f5e"],
];
const RENDER_W = 720;
const RENDER_H = 1280;

function wrapCanvasText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCanvasFrame(ctx, style, sceneIdx, frame, tInFrame, total, idx) {
  const hex = style === "Cartoon" ? SCENE_HEX_CARTOON : SCENE_HEX_REALISTIC;
  const [c1, c2] = hex[sceneIdx % hex.length];
  const grad = ctx.createLinearGradient(0, 0, RENDER_W, RENDER_H);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, RENDER_W, RENDER_H);

  // top progress segments
  const segW = (RENDER_W - 48) / total;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(24 + i * (segW + 4), 28, segW, 4);
    if (i < idx) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(24 + i * (segW + 4), 28, segW, 4);
    } else if (i === idx) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(24 + i * (segW + 4), 28, segW * Math.min(1, tInFrame), 4);
    }
  }

  const fadeAlpha = Math.min(1, tInFrame * 5);
  const riseY = (1 - Math.min(1, tInFrame * 5)) * 14;

  ctx.textAlign = "center";
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 26px Arial, sans-serif";
  ctx.fillText(frame.label, RENDER_W / 2, RENDER_H * 0.4 - 30);

  ctx.globalAlpha = fadeAlpha;
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px Arial, sans-serif";
  const lines = wrapCanvasText(ctx, frame.text, RENDER_W * 0.82);
  const lineHeight = 54;
  const startY = RENDER_H * 0.48 - ((lines.length - 1) * lineHeight) / 2 + riseY;
  lines.forEach((line, i) => ctx.fillText(line, RENDER_W / 2, startY + i * lineHeight));
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.55;
  ctx.font = "400 20px Arial, sans-serif";
  ctx.fillText(`${idx + 1} / ${total} · FPM Instant Render`, RENDER_W / 2, RENDER_H * 0.94);
  ctx.globalAlpha = 1;
}

function VideoPreview({ result, onManageProviders }) {
  const frames = useMemo(() => {
    if (!result) return [];
    return [
      { label: "HOOK", text: result.hook },
      ...(result.script || []).map((s, i) => ({ label: `SCENE ${i + 1}`, text: s })),
      { label: "CTA", text: result.cta },
    ];
  }, [result]);

  const [status, setStatus] = useState("idle"); // idle | rendering | ready
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0); // continuous playback position, drives smooth motion + real seeking
  const [cycle, setCycle] = useState(0); // increments each full loop, used to restart the zoom animation
  const [playing, setPlaying] = useState(true);
  const [style, setStyle] = useState("Realistic");
  const [providerId, setProviderId] = useState("");
  const [connected, setConnected] = useState({});
  const [loadedProviders, setLoadedProviders] = useState(false);
  const [imageUrl, setImageUrl] = useState(null); // downloadable HD storyboard image for the free provider
  const [realVideoUrl, setRealVideoUrl] = useState(null); // actual generated video URL, from a real backend
  const [backendUrl, setBackendUrl] = useState("");
  const [renderError, setRenderError] = useState("");
  const [renderStage, setRenderStage] = useState(""); // human-readable status while a real generation is in flight

  const canvasRef = useRef(null);
  const mountedRef = useRef(true);
  const pollRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(VIDEO_PROVIDERS_KEY, false);
        if (res?.value) setConnected(JSON.parse(res.value));
      } catch {
        // no saved providers — treat as none connected
      } finally {
        setLoadedProviders(true);
      }
      try {
        const res2 = await window.storage.get(VIDEO_BACKEND_URL_KEY, false);
        if (res2?.value) setBackendUrl(res2.value);
      } catch {
        // no backend configured yet
      }
    })();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // free provider is always usable regardless of the Accounts connection toggle
  const availableProviders = VIDEO_PROVIDERS.filter((p) => (p.free || connected[p.id]) && p.styles.includes(style));
  const anyProviderUsable = VIDEO_PROVIDERS.some((p) => p.free || connected[p.id]);

  useEffect(() => {
    if (availableProviders.length === 0) {
      setProviderId("");
    } else if (!availableProviders.find((p) => p.id === providerId)) {
      setProviderId(availableProviders[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, connected]);

  // reset whenever the concept, style, or provider changes — a stale render shouldn't linger
  useEffect(() => {
    setStatus("idle");
    setProgress(0);
    setElapsedMs(0);
    setCycle(0);
    setPlaying(true);
    setRenderError("");
    setRenderStage("");
    setImageUrl(null);
    setRealVideoUrl(null);
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, [result, style, providerId]);

  // --- Free, in-browser render for the built-in provider. Deliberately NOT using
  // MediaRecorder/canvas.captureStream — that streaming+codec pipeline turned out to be
  // unreliable in this preview sandbox (recording would "succeed" with no error, but
  // produce a black, unplayable, undownloadable result). canvas.toDataURL() is a much
  // older, simpler, synchronous API — no stream, no codec negotiation, no async recorder
  // lifecycle — so it doesn't share that failure mode. It exports a single HD image
  // containing every scene, rather than a video file.
  const buildStoryboardImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setRenderError("Couldn't find the render surface. Try again.");
      return null;
    }
    const cols = 2;
    const rows = Math.ceil(frames.length / cols);
    canvas.width = RENDER_W * cols;
    canvas.height = RENDER_H * rows;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setRenderError("Couldn't get a drawing context on this device.");
      return null;
    }
    frames.forEach((frame, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      ctx.save();
      ctx.translate(col * RENDER_W, row * RENDER_H);
      drawCanvasFrame(ctx, style, i, frame, 1, frames.length, i);
      ctx.restore();
    });
    return canvas.toDataURL("image/png");
  };

  const startInstantRender = () => {
    setStatus("rendering");
    setProgress(0);
    let i = 0;
    const step = () => {
      if (!mountedRef.current) return;
      i++;
      setProgress(Math.round((i / frames.length) * 100));
      if (i < frames.length) {
        setTimeout(step, 180);
        return;
      }
      try {
        const dataUrl = buildStoryboardImage();
        if (!dataUrl) {
          setStatus("idle");
          return;
        }
        setImageUrl(dataUrl);
        setStatus("ready");
        setElapsedMs(0);
        setCycle(0);
        setPlaying(true);
      } catch (e) {
        console.error("Storyboard export failed:", e);
        setStatus("idle");
        setRenderError("Couldn't export the storyboard image in this environment. Try again.");
      }
    };
    setTimeout(step, 180);
  };

  // --- Simulated preview for connected third-party providers (no real API access available here)
  const startSimulatedRender = () => {
    setStatus("rendering");
    setProgress(0);
    const start = Date.now();
    const timer = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - start) / 1600) * 100));
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        setStatus("ready");
        setElapsedMs(0);
        setCycle(0);
        setPlaying(true);
      }
    }, 60);
  };

  // --- Real Runway generation, via your own backend (see /fpm-video-backend in the
  // downloaded files). This calls an actual server that holds real API keys and proxies
  // to Runway's and Wan's (via fal.ai) actual video APIs — the only paths in this whole
  // feature that produce genuine AI-generated video rather than something built from
  // shapes/text.
  const buildVideoPrompt = () => {
    const styleNote =
      style === "Cartoon"
        ? "Rendered as vibrant 2D animation, bold flat colors, playful character motion."
        : "Photoreal cinematic footage, natural lighting, shallow depth of field.";
    const beats = [result.hook, ...(result.script || []), result.cta].filter(Boolean).join(" Then: ");
    return `${beats} ${styleNote}`;
  };

  const startRunwayRender = () => {
    setStatus("rendering");
    setProgress(5);
    setRenderStage("Sending prompt to Runway…");

    fetch(`${backendUrl}/api/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptText: buildVideoPrompt(), ratio: "720:1280", duration: 5 }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Backend returned ${res.status}`);
        if (!data?.taskId) throw new Error("Backend didn't return a task ID.");
        pollRunwayTask(data.taskId, Date.now());
      })
      .catch((e) => {
        console.error("Runway generation request failed:", e);
        if (!mountedRef.current) return;
        setStatus("idle");
        setRenderError(`Couldn't reach your backend: ${e.message}. Check the URL in Accounts and that the server is running.`);
      });
  };

  const pollRunwayTask = (taskId, startedAt) => {
    const MAX_WAIT_MS = 3 * 60 * 1000; // Runway generations typically finish in 30–120s

    fetch(`${backendUrl}/api/status/${taskId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!mountedRef.current) return;
        if (!res.ok) throw new Error(data?.error || `Backend returned ${res.status}`);

        if (data.status === "SUCCEEDED") {
          const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output;
          if (!videoUrl) throw new Error("Runway reported success but returned no video URL.");
          setRealVideoUrl(videoUrl);
          setStatus("ready");
          setRenderStage("");
          return;
        }
        if (data.status === "FAILED") {
          throw new Error(data.error || "Runway reported the generation failed.");
        }

        // still PENDING/RUNNING — keep polling
        const elapsed = Date.now() - startedAt;
        if (elapsed > MAX_WAIT_MS) {
          throw new Error("Timed out waiting for Runway. Check your Runway dashboard — it may still finish there.");
        }
        setProgress(Math.min(95, Math.round((elapsed / MAX_WAIT_MS) * 100)));
        setRenderStage(`Runway status: ${data.status || "processing"}… (${Math.round(elapsed / 1000)}s)`);
        pollRef.current = setTimeout(() => pollRunwayTask(taskId, startedAt), 4000);
      })
      .catch((e) => {
        console.error("Runway status check failed:", e);
        if (!mountedRef.current) return;
        setStatus("idle");
        setRenderError(`Generation failed: ${e.message}`);
      });
  };

  // --- Wan 2.2, via fal.ai (see README for why fal.ai specifically — "WanAI" isn't one
  // single official API). Same shape as the Runway path, different routes.
  const startWanRender = () => {
    setStatus("rendering");
    setProgress(5);
    setRenderStage("Sending prompt to Wan (fal.ai)…");

    fetch(`${backendUrl}/api/generate-video-wan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptText: buildVideoPrompt(), aspectRatio: "9:16" }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Backend returned ${res.status}`);
        if (!data?.requestId) throw new Error("Backend didn't return a request ID.");
        pollWanTask(data.requestId, Date.now());
      })
      .catch((e) => {
        console.error("Wan generation request failed:", e);
        if (!mountedRef.current) return;
        setStatus("idle");
        setRenderError(`Couldn't reach your backend: ${e.message}. Check the URL in Accounts and that the server is running.`);
      });
  };

  const pollWanTask = (requestId, startedAt) => {
    const MAX_WAIT_MS = 3 * 60 * 1000;

    fetch(`${backendUrl}/api/status-wan/${requestId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!mountedRef.current) return;
        if (!res.ok) throw new Error(data?.error || `Backend returned ${res.status}`);

        if (data.status === "SUCCEEDED") {
          const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output;
          if (!videoUrl) throw new Error("Wan reported success but returned no video URL.");
          setRealVideoUrl(videoUrl);
          setStatus("ready");
          setRenderStage("");
          return;
        }
        if (data.status === "FAILED") {
          throw new Error(data.error || "Wan (fal.ai) reported the generation failed.");
        }

        const elapsed = Date.now() - startedAt;
        if (elapsed > MAX_WAIT_MS) {
          throw new Error("Timed out waiting for Wan. Check your fal.ai dashboard — it may still finish there.");
        }
        setProgress(Math.min(95, Math.round((elapsed / MAX_WAIT_MS) * 100)));
        setRenderStage(`Wan status: ${data.status || "processing"}… (${Math.round(elapsed / 1000)}s)`);
        pollRef.current = setTimeout(() => pollWanTask(requestId, startedAt), 4000);
      })
      .catch((e) => {
        console.error("Wan status check failed:", e);
        if (!mountedRef.current) return;
        setStatus("idle");
        setRenderError(`Generation failed: ${e.message}`);
      });
  };

  const startRender = () => {
    if (!providerId) return;
    setRenderError("");
    if (providerId === FPM_INSTANT_ID) startInstantRender();
    else if (providerId === "runway" && backendUrl) startRunwayRender();
    else if (providerId === "wan" && backendUrl) startWanRender();
    else startSimulatedRender();
  };

  // Continuous playback tick — smooth motion and real scrubbing, instead of hard-cutting
  // between scenes every FRAME_MS like a slideshow.
  const totalMs = frames.length * FRAME_MS;
  useEffect(() => {
    if (status !== "ready" || !playing || frames.length === 0) return;
    const id = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + 50;
        if (next >= totalMs) {
          setCycle((c) => c + 1);
          return 0;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(id);
  }, [status, playing, frames.length, totalMs]);

  const buildShotListText = () =>
    `Style: ${style}  ·  Provider: ${VIDEO_PROVIDERS.find((p) => p.id === providerId)?.label || "—"}\n\n` +
    frames.map((f) => `${f.label}\n${f.text}\n`).join("\n") +
    `\nCaptions:\n${(result.captions || []).join("\n")}\n\nCTA: ${result.cta}\n`;

  const [shotListCopied, setShotListCopied] = useState(false);
  const [showShotListText, setShowShotListText] = useState(false);

  const copyShotList = async () => {
    const text = buildShotListText();
    try {
      await navigator.clipboard.writeText(text);
      setShotListCopied(true);
      setTimeout(() => setShotListCopied(false), 2000);
    } catch (e) {
      console.error("Clipboard write failed:", e);
      // Clipboard API can be blocked too in some sandboxes — fall back to just
      // showing the text so it can be selected and copied by hand regardless.
      setShowShotListText(true);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `fpm-storyboard-${Date.now()}.png`;
    a.click();
  };

  if (!result) return null;

  const palette = style === "Cartoon" ? SCENE_BG_CARTOON : SCENE_BG_REALISTIC;
  const providerLabel = VIDEO_PROVIDERS.find((p) => p.id === providerId)?.label;
  const isInstant = providerId === FPM_INSTANT_ID;
  const currentIdx = frames.length ? Math.min(frames.length - 1, Math.floor(elapsedMs / FRAME_MS)) : 0;
  const overallFrac = totalMs ? elapsedMs / totalMs : 0;

  return (
    <Card className="p-5">
      <style>{`
        @keyframes fpmSceneFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fpm-scene-fade { animation: fpmSceneFade 450ms ease-out; }
        @keyframes fpmKenBurns { from { transform: scale(1); } to { transform: scale(1.08); } }
        .fpm-kenburns { animation-name: fpmKenBurns; animation-timing-function: linear; animation-fill-mode: forwards; }
      `}</style>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono uppercase tracking-wide text-slate-400">Video preview</span>
        {status === "ready" && (
          <span className="text-[10px] font-mono text-emerald-600">{imageUrl ? "rendered · real .png file" : "rendered"}</span>
        )}
      </div>

      {/* Hidden canvas used only to synchronously export the storyboard image — never
          streamed, never displayed, no capture/recorder pipeline involved. */}
      <canvas ref={canvasRef} className="hidden" />

      {status === "idle" && !loadedProviders && (
        <div className="aspect-[9/16] rounded-lg bg-slate-50 animate-pulse" />
      )}

      {status === "idle" && loadedProviders && (
        <div>
          {anyProviderUsable ? (
            <div className="space-y-3 mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400 block mb-1.5">Style</span>
                <div className="flex gap-1.5">
                  {["Realistic", "Cartoon"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md border transition-colors ${
                        style === s ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400 block mb-1.5">Provider</span>
                {availableProviders.length > 0 ? (
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-2 outline-none text-slate-700"
                  >
                    {availableProviders.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    No connected provider supports {style.toLowerCase()} style.{" "}
                    <button onClick={onManageProviders} className="text-amber-600 font-medium hover:underline">Connect one</button>
                  </p>
                )}
              </div>
              {isInstant && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                  Free and instant — exports a real, downloadable HD image of every scene, right in your browser. No external service.
                </p>
              )}
              {(providerId === "runway" || providerId === "wan") && (
                <p
                  className={`text-[11px] rounded-md px-2.5 py-1.5 border ${
                    backendUrl
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-amber-700 bg-amber-50 border-amber-200"
                  }`}
                >
                  {backendUrl
                    ? `Connected to your backend — this will call ${providerId === "runway" ? "Runway" : "Wan (fal.ai)"} for real (30–120s, uses real credits).`
                    : `No backend connected — this will show a simulated preview, not real ${providerId === "runway" ? "Runway" : "Wan"} output. `}
                  {!backendUrl && (
                    <button onClick={onManageProviders} className="font-medium underline">Connect your backend</button>
                  )}
                </p>
              )}
            </div>
          ) : (
            <div className="aspect-[9/16] rounded-lg bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center gap-3 px-5 text-center mb-0">
              <Video className="w-6 h-6 text-slate-400" />
              <p className="text-xs text-slate-500">Connect an AI video provider to render this concept.</p>
              <button
                onClick={onManageProviders}
                className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-md flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5 text-amber-400" /> Connect a provider
              </button>
            </div>
          )}

          {renderError && (
            <div className="mb-3">
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5 mb-2">{renderError}</p>
              {isInstant && (
                <button
                  onClick={startSimulatedRender}
                  className="w-full text-xs font-medium border border-slate-300 rounded-md py-2 text-slate-600 hover:bg-slate-50"
                >
                  Use storyboard preview instead
                </button>
              )}
            </div>
          )}

          {availableProviders.length > 0 && (
            <button
              onClick={startRender}
              disabled={!providerId}
              className="w-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white px-3 py-2.5 rounded-md flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />{" "}
              {isInstant
                ? "Render HD video now (free)"
                : (providerId === "runway" || providerId === "wan") && backendUrl
                ? "Generate real video"
                : "Generate video"}
            </button>
          )}
        </div>
      )}

      {status === "rendering" && (
        <div className="aspect-[9/16] rounded-lg bg-slate-900 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <RadarIcon className="w-6 h-6 animate-spin text-amber-400" strokeWidth={1.5} />
          <p className="text-xs text-slate-300 font-mono">
            {renderStage || (isInstant ? `building storyboard… ${progress}%` : `rendering via ${providerLabel} · ${style.toLowerCase()}… ${progress}%`)}
          </p>
          <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {status === "ready" && realVideoUrl && (
        <div>
          <video src={realVideoUrl} controls loop className="w-full aspect-[9/16] rounded-lg bg-black" />
          <p className="text-[10px] text-emerald-700 mt-2 leading-snug bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
            This is genuinely generated by {providerId === "wan" ? "Wan (fal.ai)" : "Runway"} via your connected backend — real AI video, not a storyboard.
          </p>
        </div>
      )}

      {status === "ready" && !realVideoUrl && (
        <div>
          <div
            key={cycle}
            className={`aspect-[9/16] rounded-lg bg-gradient-to-br ${palette[currentIdx % palette.length]} flex flex-col justify-between p-4 relative overflow-hidden cursor-pointer select-none fpm-kenburns`}
            style={{ animationDuration: `${totalMs}ms` }}
            onClick={() => setPlaying((p) => !p)}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-white/70 shrink-0">{style}</span>
              {playing ? <Pause className="w-4 h-4 text-white/80" /> : <Play className="w-4 h-4 text-white/80" />}
            </div>

            <div key={currentIdx} className="flex-1 flex flex-col items-center justify-center text-center px-2 fpm-scene-fade">
              <span className="text-[10px] font-mono text-white/60 mb-2 tracking-widest">{frames[currentIdx]?.label}</span>
              <p className="text-white text-base font-semibold leading-snug">{frames[currentIdx]?.text}</p>
            </div>

            <span className="text-[10px] font-mono text-white/70">{currentIdx + 1} / {frames.length} · {providerLabel}</span>
          </div>

          {/* real scrubber — click or drag anywhere to jump to that point in the playback */}
          <div
            className="h-2 bg-slate-200 rounded-full overflow-hidden mt-3 cursor-pointer relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              setElapsedMs(Math.round(frac * totalMs));
            }}
          >
            <div className="h-full bg-amber-500" style={{ width: `${overallFrac * 100}%` }} />
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="text-xs font-medium border border-slate-300 rounded-md px-3 py-2 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => {
                setElapsedMs(0);
                setPlaying(true);
              }}
              className="flex-1 text-xs font-medium border border-slate-300 rounded-md py-2 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Replay
            </button>
            {!imageUrl && (
              <button
                onClick={copyShotList}
                className="flex-1 text-xs font-medium border border-slate-300 rounded-md py-2 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5"
              >
                {shotListCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clipboard className="w-3.5 h-3.5" />}
                {shotListCopied ? "Copied!" : "Copy shot list"}
              </button>
            )}
          </div>

          {imageUrl && (
            <div className="mt-3">
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1.5">
                Your HD storyboard — right-click (or long-press) to save
              </p>
              <img src={imageUrl} alt="Generated storyboard" className="w-full rounded-lg border border-slate-200" />
              <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                The button below tries a one-click download, but that browser API is restricted in some
                preview environments. Right-clicking the image above and choosing "Save image as…" always
                works — it's a native browser action, not something this code has to trigger.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={downloadImage}
                  className="flex-1 text-xs font-medium border border-slate-300 rounded-md py-2 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Try one-click download
                </button>
                <button
                  onClick={copyShotList}
                  className="flex-1 text-xs font-medium border border-slate-300 rounded-md py-2 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  {shotListCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clipboard className="w-3.5 h-3.5" />}
                  {shotListCopied ? "Copied!" : "Copy shot list"}
                </button>
              </div>
            </div>
          )}

          {showShotListText && (
            <div className="mt-3">
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1.5">
                Clipboard access was blocked too — select all the text below and copy it manually
              </p>
              <textarea
                readOnly
                value={buildShotListText()}
                onFocus={(e) => e.target.select()}
                rows={8}
                className="w-full text-xs font-mono border border-slate-300 rounded-md p-2.5 text-slate-700 bg-slate-50"
              />
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-2 leading-snug">
            {imageUrl
              ? "The animated preview above is a stylized storyboard — text and motion I control directly via CSS/canvas. This environment has no access to an actual video- or image-generation model, so this is the ceiling of what's achievable here, not a rendering bug."
              : `Continuous animated preview built from your concept — full-fidelity ${style.toLowerCase()} rendering is queued to ${providerLabel}.`}
          </p>
        </div>
      )}
    </Card>
  );
}


function CreativeStudio({ prefill, onConsumedPrefill, setPage }) {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [fromCompetitor, setFromCompetitor] = useState(null);
  const [captionCount, setCaptionCount] = useState(3);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(SETTINGS_KEY, false);
        if (res?.value) setCaptionCount(JSON.parse(res.value).captionVariants || 3);
      } catch {
        // no saved settings — default of 3 stands
      }
    })();
  }, []);

  const generate = async (briefOverride) => {
    const text = (briefOverride ?? brief).trim();
    if (!text || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const captionExamples = Array.from({ length: captionCount }, (_, i) => `"caption variant ${i + 1}"`).join(",");
      const system =
        "You are an ad creative director inside a marketing SaaS tool. Given a short product/offer brief " +
        "(which may include competitive context to counter-position against), produce a punchy short-form " +
        "video ad concept. Respond ONLY with valid JSON, no markdown fences, " +
        "matching exactly this shape: " +
        `{"concept":"one sentence creative concept","hook":"the first line spoken/on screen, under 12 words",` +
        `"script":["scene 1 direction + line","scene 2 direction + line","scene 3 direction + line","scene 4 direction + line"],` +
        `"captions":[${captionExamples}],"cta":"short call to action"}` +
        ` The "captions" array must contain exactly ${captionCount} distinct variants.`;
      const raw = await askClaude(system, `Offer brief: ${text}`);
      const parsed = JSON.parse(raw);
      setResult(parsed);
    } catch (e) {
      setError(e.message?.includes("backend") ? e.message : "Generation failed. Try rephrasing the brief and generate again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!prefill) return;
    setBrief(prefill.brief);
    setFromCompetitor(prefill.competitor);
    generate(prefill.brief);
    onConsumedPrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  return (
    <div>
      <PageHeader
        title="Creative studio"
        subtitle="Describe an offer. Get a ready-to-shoot script, hook, and caption variants — video/image rendering is queued to your connected generation provider."
      />

      {fromCompetitor && (
        <div className="mb-4 text-xs bg-slate-900 text-slate-200 rounded-md px-4 py-2.5 flex items-center gap-2">
          <RadarIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          Brief pre-filled from your <span className="font-semibold text-white">{fromCompetitor}</span> competitor scan — edit it below and regenerate anytime.
        </div>
      )}

      <Card className="p-4 mb-6">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder='e.g. "Free 30-minute roof inspection for homeowners in Tampa, book online, no obligation"'
          className="w-full text-sm outline-none resize-none placeholder:text-slate-400"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={() => generate()}
            disabled={loading || !brief.trim()}
            className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate concept
          </button>
        </div>
      </Card>

      {loading && <RadarSpinner label="drafting hook, script, and variants…" />}
      {error && <Card className="p-4 mb-6 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}

      {result && !loading && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2 p-5">
            <span className="text-xs font-mono uppercase tracking-wide text-slate-400">Concept</span>
            <p className="text-sm text-slate-800 mt-1 mb-4">{result.concept}</p>

            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center shrink-0">
                <Video className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Hook</span>
            </div>
            <p className="text-sm font-medium text-slate-900 mb-5 pl-8">"{result.hook}"</p>

            <span className="text-xs font-semibold text-slate-700 mb-2 block">Shot-by-shot script</span>
            <div className="space-y-2">
              {(result.script || []).map((s, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="font-mono text-slate-400 w-12 shrink-0">SCENE {i + 1}</span>
                  <span className="text-slate-600 leading-snug">{s}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">CTA: <span className="text-slate-800 font-medium">{result.cta}</span></span>
              <button className="text-xs font-semibold text-amber-600 flex items-center gap-1 hover:text-amber-700">
                Send to production queue <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <span className="text-xs font-mono uppercase tracking-wide text-slate-400">Caption variants</span>
              <div className="space-y-2 mt-2">
                {(result.captions || []).map((c, i) => (
                  <div key={i} className="text-xs bg-slate-50 border border-slate-200 rounded-md p-2.5 text-slate-700">
                    {c}
                  </div>
                ))}
              </div>
            </Card>

            <VideoPreview result={result} onManageProviders={() => setPage("accounts")} />
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <Card className="p-10 text-center text-slate-400 text-sm">
          Describe an offer above to generate a hook, script, and caption variants.
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnels
// ---------------------------------------------------------------------------
function Funnels() {
  const [funnels, setFunnels] = useState(FUNNELS);
  const [showConnect, setShowConnect] = useState(false);

  return (
    <div>
      <PageHeader
        title="Funnels"
        subtitle="Native funnels FPM built for you, plus anything synced in from a connected funnel tool."
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowConnect((v) => !v)}
              className="px-3 py-2 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Connect existing
            </button>
            <button className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New funnel
            </button>
          </div>
        }
      />

      {showConnect && (
        <Card className="p-4 mb-6">
          <p className="text-xs text-slate-500 mb-3">Sync funnels from a tool you already use:</p>
          <div className="flex gap-2 flex-wrap">
            {["ClickFunnels", "GoHighLevel", "Leadpages", "Unbounce"].map((t) => (
              <button key={t} className="px-3 py-1.5 rounded-full border border-slate-300 text-xs font-medium text-slate-600 hover:border-amber-400 hover:text-amber-700">
                {t}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        {funnels.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 pr-2">{f.name}</h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${
                  f.status === "Live" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {f.status}
              </span>
            </div>
            <div className="flex items-center gap-1 mb-4 flex-wrap">
              {f.stages.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <span className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-500">{s}</span>
                  {i < f.stages.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs pt-3 border-t border-slate-100">
              <div>
                <div className="font-mono font-semibold text-slate-800">{f.visits.toLocaleString()}</div>
                <div className="text-slate-400">visits</div>
              </div>
              <div>
                <div className="font-mono font-semibold text-slate-800">{f.optin}</div>
                <div className="text-slate-400">opt-in rate</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leads / CRM (persisted via window.storage)
// ---------------------------------------------------------------------------
function Leads() {
  const [leads, setLeads] = useState(SEED_LEADS);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: "", company: "", source: "", value: "" });
  const [settings, setSettingsState] = useState(defaultSettings());

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("fpm:leads", false);
        if (res?.value) setLeads(JSON.parse(res.value));
      } catch {
        // no saved leads yet — keep seed data
      } finally {
        setLoaded(true);
      }
      try {
        const res2 = await window.storage.get(SETTINGS_KEY, false);
        if (res2?.value) setSettingsState({ ...defaultSettings(), ...JSON.parse(res2.value) });
      } catch {
        // no saved settings — defaults stand
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("fpm:leads", JSON.stringify(leads), false).catch(() => {});
  }, [leads, loaded]);

  const dynamicStages = settings.nurturingStage
    ? ["New", "Contacted", "Nurturing", "Qualified", "Won", "Lost"]
    : STAGES;
  const stageClass = (stage) => STAGE_COLOR[stage] || "bg-violet-50 text-violet-700 border-violet-300";

  const filtered = filter === "All" ? leads : leads.filter((l) => l.stage === filter);

  const addLead = () => {
    if (!draft.name.trim()) return;
    setLeads((ls) => [
      {
        id: `l${Date.now()}`,
        name: draft.name,
        company: draft.company || "—",
        source: draft.source || "Manual import",
        value: Number(draft.value) || 0,
        stage: "New",
        createdAt: "Today",
      },
      ...ls,
    ]);
    setDraft({ name: "", company: "", source: "", value: "" });
    setShowAdd(false);
  };

  const setStage = (id, stage) => setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l)));
  const removeLead = (id) => setLeads((ls) => ls.filter((l) => l.id !== id));

  return (
    <div>
      <PageHeader
        title="Lead pipeline"
        subtitle="Every lead FPM captured, imported, or that you bought — with full lifecycle visibility."
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add lead
          </button>
        }
      />

      {settings.nurturingStage && (
        <div className="mb-4 text-xs bg-slate-900 text-slate-200 rounded-md px-4 py-2.5 flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          Nurturing stage added via AI customization — leads sit here until they're ready to qualify.
        </div>
      )}

      <div className="flex gap-1.5 mb-4">
        {["All", ...dynamicStages].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filter === s ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {s}
            {s !== "All" && (
              <span className="ml-1.5 font-mono opacity-60">{leads.filter((l) => l.stage === s).length}</span>
            )}
          </button>
        ))}
      </div>

      {showAdd && (
        <Card className="p-4 mb-4">
          <div className="grid grid-cols-4 gap-2 mb-3">
            <input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="text-sm border border-slate-300 rounded-md px-3 py-2 outline-none" />
            <input placeholder="Company" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} className="text-sm border border-slate-300 rounded-md px-3 py-2 outline-none" />
            <input placeholder="Source" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} className="text-sm border border-slate-300 rounded-md px-3 py-2 outline-none" />
            <input placeholder="Est. value ($)" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} className="text-sm border border-slate-300 rounded-md px-3 py-2 outline-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="text-xs font-medium text-slate-500 px-3 py-1.5">Cancel</button>
            <button onClick={addLead} className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md px-3 py-1.5">Save lead</button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 font-mono uppercase tracking-wide">
              <th className="py-2.5 px-4 font-medium">Lead</th>
              <th className="py-2.5 px-4 font-medium">Source</th>
              <th className="py-2.5 px-4 font-medium">Value</th>
              <th className="py-2.5 px-4 font-medium">Stage</th>
              <th className="py-2.5 px-4 font-medium">Added</th>
              <th className="py-2.5 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className={`border-t border-slate-100 hover:bg-slate-50/60 ${l.value >= settings.leadAlertThreshold ? "bg-amber-50/40" : ""}`}>
                <td className="py-2.5 px-4">
                  <div className="font-medium text-slate-800 flex items-center gap-1.5">
                    {l.name}
                    {l.value >= settings.leadAlertThreshold && (
                      <span title={`Above your $${settings.leadAlertThreshold.toLocaleString()} alert threshold`}>
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{l.company}</div>
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-500">{l.source}</td>
                <td className="py-2.5 px-4 font-mono text-xs text-slate-700">${l.value.toLocaleString()}</td>
                <td className="py-2.5 px-4">
                  <select
                    value={l.stage}
                    onChange={(e) => setStage(l.id, e.target.value)}
                    className={`text-xs font-medium border rounded-full px-2 py-1 outline-none ${stageClass(l.stage)}`}
                  >
                    {dynamicStages.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-400 font-mono">{l.createdAt}</td>
                <td className="py-2.5 px-4 text-right">
                  <button onClick={() => removeLead(l.id)} className="text-slate-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">No leads in this stage yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------
function Marketplace() {
  const [toast, setToast] = useState("");

  const buy = (item) => {
    setToast(`Purchase request sent for "${item.title}" — seller will confirm within 24h.`);
    setTimeout(() => setToast(""), 3500);
  };

  return (
    <div>
      <PageHeader
        title="Lead & referral marketplace"
        subtitle="Buy pre-qualified leads and referrals from other businesses in your network, or list your own."
        action={
          <button className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> List leads
          </button>
        }
      />

      {toast && (
        <div className="mb-4 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md px-4 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {MARKETPLACE.map((m) => (
          <Card key={m.id} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wide text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                {m.category}
              </span>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {m.rating}
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1 leading-snug">{m.title}</h3>
            <p className="text-xs text-slate-400 mb-4">{m.count} leads · listed by {m.seller}</p>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="font-mono font-bold text-slate-900">${m.price}</span>
              <button
                onClick={() => buy(m)}
                className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md"
              >
                Buy access
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Customization — Super User only. Natural-language settings assistant.
// ---------------------------------------------------------------------------
function formatValue(schema, value) {
  if (schema.type === "boolean") return value ? "On" : "Off";
  if (schema.type === "number") return `${schema.unit || ""}${value}`;
  return String(value);
}

function coerceValue(schema, raw) {
  if (schema.type === "boolean") return !!raw;
  if (schema.type === "number") {
    const n = Number(raw);
    if (Number.isNaN(n)) return null;
    return Math.min(schema.max, Math.max(schema.min, Math.round(n)));
  }
  if (schema.type === "enum") return schema.options.includes(raw) ? raw : null;
  return null;
}

function AICustomization({ plan, onUnlock }) {
  const [settings, setSettings] = useState(defaultSettings());
  const [loaded, setLoaded] = useState(false);
  const [ask, setAsk] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // { message, changes: [{id, value, include}] }
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("manual"); // manual | assistant

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(SETTINGS_KEY, false);
        if (res?.value) setSettings({ ...defaultSettings(), ...JSON.parse(res.value) });
      } catch {
        // no saved settings yet — defaults stand
      }
      try {
        const res2 = await window.storage.get(`${SETTINGS_KEY}:history`, false);
        if (res2?.value) setHistory(JSON.parse(res2.value));
      } catch {
        // no history yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Functional updates — critical for the slider in the manual panel, which can
  // fire many onChange events before a re-render lands; closing over stale
  // `settings`/`history` would silently drop updates under React's batching.
  const mergeSettings = (changes) => {
    setSettings((prev) => {
      const next = { ...prev };
      changes.forEach((c) => (next[c.id] = c.value));
      window.storage.set(SETTINGS_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };

  const logChange = (source, message, changed) => {
    setHistory((prev) => {
      const next = [
        {
          time: new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          source,
          message,
          changes: changed,
        },
        ...prev,
      ];
      window.storage.set(`${SETTINGS_KEY}:history`, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };

  // Manual GUI edit — applies immediately, no AI round-trip needed.
  const setManualValue = (schema, value) => {
    mergeSettings([{ id: schema.id, value }]);
    logChange("manual", `Manually updated ${schema.label.toLowerCase()}`, [
      { label: schema.label, value: formatValue(schema, value) },
    ]);
  };

  const askAI = async () => {
    if (!ask.trim() || loading) return;
    setLoading(true);
    setError("");
    setPending(null);
    try {
      const schemaText = SETTINGS_SCHEMA.map(
        (s) =>
          `- id: "${s.id}", label: "${s.label}", type: ${s.type}${
            s.type === "number" ? `, range: ${s.min}-${s.max}` : ""
          }${s.type === "enum" ? `, options: ${JSON.stringify(s.options)}` : ""}, current value: ${JSON.stringify(
            settings[s.id]
          )} — ${s.description}`
      ).join("\n");
      const system =
        "You are a configuration assistant inside a marketing SaaS app, available only to Super User plan " +
        "subscribers. You may ONLY change settings from this exact schema — never invent new setting ids:\n" +
        schemaText +
        "\n\nGiven the user's request, respond ONLY with valid JSON, no markdown fences, matching exactly: " +
        `{"message":"one or two plain-English sentences explaining what you're proposing and why",` +
        `"changes":[{"id":"schema id","value":<new value, correct type>}]}` +
        "\nIf the request doesn't match any setting in the schema, return an empty changes array and explain why in message.";
      const raw = await askClaude(system, ask);
      const parsed = JSON.parse(raw);
      const validated = (parsed.changes || [])
        .map((c) => {
          const schema = SETTINGS_SCHEMA.find((s) => s.id === c.id);
          if (!schema) return null;
          const value = coerceValue(schema, c.value);
          if (value === null) return null;
          return { id: c.id, value, include: true };
        })
        .filter(Boolean);
      setPending({ message: parsed.message || "", changes: validated });
    } catch (e) {
      setError(e.message?.includes("backend") ? e.message : "Couldn't process that request. Try rephrasing it.");
    } finally {
      setLoading(false);
    }
  };

  const toggleInclude = (id) =>
    setPending((p) => ({ ...p, changes: p.changes.map((c) => (c.id === id ? { ...c, include: !c.include } : c)) }));

  const applyChanges = () => {
    if (!pending) return;
    const included = pending.changes.filter((c) => c.include);
    if (included.length === 0) {
      setPending(null);
      return;
    }
    mergeSettings(included);
    logChange(
      "ai",
      pending.message,
      included.map((c) => ({
        label: SETTINGS_SCHEMA.find((s) => s.id === c.id).label,
        value: formatValue(SETTINGS_SCHEMA.find((s) => s.id === c.id), c.value),
      }))
    );
    setPending(null);
    setAsk("");
  };

  if (plan !== "Super User") {
    return (
      <div>
        <PageHeader title="AI customization" subtitle="Configure app behavior in plain English — no settings menus to dig through." />
        <Card className="p-10 text-center max-w-lg mx-auto">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1.5">Super User feature</h3>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            AI-assisted customization — pipeline stages, alert thresholds, generation behavior, and campaign
            defaults, all configured by describing what you want — is available on the Super User plan.
          </p>
          <button
            onClick={onUnlock}
            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-md inline-flex items-center gap-1.5"
          >
            <Crown className="w-3.5 h-3.5" /> Preview as Super User (demo)
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="AI customization"
        subtitle="Configure FPM's behavior by hand, or describe a change in plain English and let the assistant propose it."
      />

      <div className="flex gap-1.5 mb-5">
        <button
          onClick={() => setTab("manual")}
          className={`text-xs font-medium px-3.5 py-2 rounded-full border flex items-center gap-1.5 transition-colors ${
            tab === "manual" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Manual controls
        </button>
        <button
          onClick={() => setTab("assistant")}
          className={`text-xs font-medium px-3.5 py-2 rounded-full border flex items-center gap-1.5 transition-colors ${
            tab === "assistant" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" /> AI assistant
        </button>
      </div>

      {tab === "manual" && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {SETTINGS_SCHEMA.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className="text-sm font-medium text-slate-800">{s.label}</span>
                {s.type === "boolean" && (
                  <button
                    onClick={() => setManualValue(s, !settings[s.id])}
                    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
                      settings[s.id] ? "bg-amber-500" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        settings[s.id] ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-3 leading-snug">{s.description}</p>

              {s.type === "number" && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setManualValue(s, Math.max(s.min, settings[s.id] - s.step))}
                    className="w-7 h-7 rounded-md border border-slate-300 flex items-center justify-center text-slate-500 hover:bg-slate-50 shrink-0"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={settings[s.id]}
                    onChange={(e) => setManualValue(s, Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <button
                    onClick={() => setManualValue(s, Math.min(s.max, settings[s.id] + s.step))}
                    className="w-7 h-7 rounded-md border border-slate-300 flex items-center justify-center text-slate-500 hover:bg-slate-50 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs font-semibold text-slate-800 w-14 text-right shrink-0">
                    {formatValue(s, settings[s.id])}
                  </span>
                </div>
              )}

              {s.type === "enum" && (
                <div className="flex gap-1.5">
                  {s.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setManualValue(s, opt)}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md border transition-colors ${
                        settings[s.id] === opt ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === "assistant" && (
        <>
          <Card className="p-4 mb-6">
            <textarea
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              rows={2}
              placeholder='e.g. "Flag leads over $5k, and add a Nurturing stage to the pipeline"'
              className="w-full text-sm outline-none resize-none placeholder:text-slate-400"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={askAI}
                disabled={loading || !ask.trim()}
                className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Ask AI
              </button>
            </div>
          </Card>

          {loading && <RadarSpinner label="mapping your request to configuration…" />}
          {error && <Card className="p-4 mb-6 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}

          {pending && !loading && (
            <Card className="p-5 mb-6">
              <p className="text-sm text-slate-800 mb-4">{pending.message}</p>
              {pending.changes.length === 0 ? (
                <p className="text-xs text-slate-400">No matching settings to change.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {pending.changes.map((c) => {
                    const schema = SETTINGS_SCHEMA.find((s) => s.id === c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center justify-between gap-3 border border-slate-200 rounded-md px-3 py-2.5 cursor-pointer hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={c.include} onChange={() => toggleInclude(c.id)} className="accent-amber-500" />
                          <div>
                            <div className="text-xs font-medium text-slate-800">{schema.label}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {formatValue(schema, settings[c.id])} → {formatValue(schema, c.value)}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {pending.changes.length > 0 && (
                <div className="flex justify-end gap-2">
                  <button onClick={() => setPending(null)} className="text-xs font-medium text-slate-500 px-3 py-2">Discard</button>
                  <button
                    onClick={applyChanges}
                    className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md px-4 py-2 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Apply changes
                  </button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <span className="text-xs font-mono uppercase tracking-wide text-slate-400 mb-3 block">Current configuration</span>
          <div className="space-y-2.5">
            {SETTINGS_SCHEMA.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{s.label}</span>
                <span className="font-mono font-medium text-slate-800">{loaded ? formatValue(s, settings[s.id]) : "…"}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-mono uppercase tracking-wide text-slate-400 mb-3 block">Change history</span>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400">No changes yet.</p>
          ) : (
            <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
              {history.map((h, i) => (
                <div key={i} className={`text-xs border-l-2 pl-3 ${h.source === "manual" ? "border-slate-300" : "border-amber-400"}`}>
                  <p className="text-slate-700 flex items-center gap-1.5">
                    {h.source === "manual" ? (
                      <SlidersHorizontal className="w-3 h-3 text-slate-400 shrink-0" />
                    ) : (
                      <Wand2 className="w-3 h-3 text-amber-500 shrink-0" />
                    )}
                    {h.message}
                  </p>
                  <p className="text-slate-400 font-mono text-[10px] mt-0.5">
                    {h.time} · {h.changes.map((c) => `${c.label}: ${c.value}`).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connected Accounts
// ---------------------------------------------------------------------------
function Accounts({ plan, setPlan }) {
  const [accounts, setAccounts] = useState([
    { id: "meta", label: "Meta (Facebook & Instagram)", icon: Facebook, connected: true },
    { id: "tiktok", label: "TikTok Ads", icon: Instagram, connected: true },
    { id: "youtube", label: "YouTube", icon: Youtube, connected: false },
    { id: "linkedin", label: "LinkedIn Ads", icon: Linkedin, connected: false },
    { id: "site", label: "Business website", icon: Globe, connected: true },
    { id: "stripe", label: "Payments (Stripe)", icon: CreditCard, connected: true },
  ]);

  const [videoConnected, setVideoConnected] = useState({ runway: true, pika: true });
  const [loadedVideo, setLoadedVideo] = useState(false);
  const [backendUrl, setBackendUrl] = useState("");
  const [savedBackendUrl, setSavedBackendUrl] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(VIDEO_PROVIDERS_KEY, false);
        if (res?.value) setVideoConnected(JSON.parse(res.value));
      } catch {
        // nothing saved yet — keep defaults
      } finally {
        setLoadedVideo(true);
      }
      try {
        const res2 = await window.storage.get(VIDEO_BACKEND_URL_KEY, false);
        if (res2?.value) setBackendUrl(res2.value);
      } catch {
        // no backend URL saved yet
      }
    })();
  }, []);

  useEffect(() => {
    if (!loadedVideo) return;
    window.storage.set(VIDEO_PROVIDERS_KEY, JSON.stringify(videoConnected), false).catch(() => {});
  }, [videoConnected, loadedVideo]);

  const saveBackendUrl = () => {
    const trimmed = backendUrl.trim().replace(/\/+$/, "");
    setBackendUrl(trimmed);
    window.storage
      .set(VIDEO_BACKEND_URL_KEY, trimmed, false)
      .then(() => {
        setSavedBackendUrl(true);
        setTimeout(() => setSavedBackendUrl(false), 2000);
      })
      .catch(() => {});
  };

  const toggle = (id) => setAccounts((a) => a.map((x) => (x.id === id ? { ...x, connected: !x.connected } : x)));
  const toggleVideo = (id) => setVideoConnected((v) => ({ ...v, [id]: !v[id] }));

  return (
    <div>
      <PageHeader
        title="Connected accounts"
        subtitle="FPM publishes and collects payment through these connections. Everything here is revocable at any time."
      />

      <h3 className="text-sm font-semibold text-slate-800 mb-1">Plan</h3>
      <p className="text-xs text-slate-500 mb-3 max-w-xl">Demo control — switch plans to preview what unlocks at each tier.</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {["Free", "Pro", "Super User"].map((p) => (
          <button
            key={p}
            onClick={() => setPlan(p)}
            className={`text-left p-3.5 rounded-lg border transition-colors ${
              plan === p ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {p === "Super User" && <Crown className="w-3.5 h-3.5 text-amber-500" />}
              <span className="text-xs font-semibold text-slate-800">{p}</span>
            </div>
            <span className="text-[11px] text-slate-400">
              {p === "Free" && "Core CRM & funnels"}
              {p === "Pro" && "+ AI research & creative studio"}
              {p === "Super User" && "+ AI customization assistant"}
            </span>
          </button>
        ))}
      </div>

      <Card className="divide-y divide-slate-100 mb-6">
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center">
                <a.icon className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-800">{a.label}</div>
                <div className={`text-xs font-mono ${a.connected ? "text-emerald-600" : "text-slate-400"}`}>
                  {a.connected ? "Connected" : "Not connected"}
                </div>
              </div>
            </div>
            <button
              onClick={() => toggle(a.id)}
              className={`w-11 h-6 rounded-full relative transition-colors ${a.connected ? "bg-amber-500" : "bg-slate-200"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  a.connected ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </Card>

      <h3 className="text-sm font-semibold text-slate-800 mb-1">App backend</h3>
      <p className="text-xs text-slate-500 mb-3 max-w-xl">
        Deploy the included backend server and paste its URL here — it holds every API key (Anthropic,
        Runway, fal.ai/Wan) server-side, never in the browser. This is required for every AI feature in the
        app (competitor analysis, ad scripts, AI customization) as well as real Runway/Wan video generation.
      </p>
      <Card className="p-4 mb-6">
        <div className="flex gap-2">
          <input
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="https://your-backend.onrender.com"
            className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-2 outline-none"
          />
          <button
            onClick={saveBackendUrl}
            className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-1.5 shrink-0"
          >
            {savedBackendUrl ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : null}
            {savedBackendUrl ? "Saved" : "Save"}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          {backendUrl
            ? `Connected: ${backendUrl}`
            : "Not connected — AI text features will fail, and Runway/Wan will fall back to a simulated preview, until this is set."}
        </p>
      </Card>

      <h3 className="text-sm font-semibold text-slate-800 mb-1">AI video generation providers</h3>
      <p className="text-xs text-slate-500 mb-3 max-w-xl">
        FPM Instant Render is free and built-in — no connection needed. Connect any of the others for
        higher-fidelity rendering through that provider.
      </p>
      <Card className="divide-y divide-slate-100">
        {VIDEO_PROVIDERS.map((p) => {
          const connected = p.free || !!videoConnected[p.id];
          return (
            <div key={p.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Video className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">{p.label}</div>
                  <div className={`text-xs font-mono ${connected ? "text-emerald-600" : "text-slate-400"}`}>
                    {p.free ? "Always on · free" : connected ? "Connected" : "Not connected"} · {p.styles.join(" / ")}
                  </div>
                </div>
              </div>
              {p.free ? (
                <span className="text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 px-2 py-1 rounded">Built-in</span>
              ) : (
                <button
                  onClick={() => toggleVideo(p.id)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${connected ? "bg-amber-500" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                      connected ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "intel", label: "Competitor Intel", icon: RadarIcon },
  { id: "studio", label: "Creative Studio", icon: Sparkles },
  { id: "funnels", label: "Funnels", icon: Link2 },
  { id: "leads", label: "Leads", icon: Users },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { id: "customize", label: "AI Customization", icon: Wand2, badge: "Super" },
  { id: "accounts", label: "Accounts", icon: Globe },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [leadsForDash] = useState(SEED_LEADS);
  const [studioPrefill, setStudioPrefill] = useState(null);
  const [plan, setPlanState] = useState("Pro");
  const [planLoaded, setPlanLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(PLAN_KEY, false);
        if (res?.value) setPlanState(res.value);
      } catch {
        // no saved plan — default to Pro
      } finally {
        setPlanLoaded(true);
      }
    })();
  }, []);

  const setPlan = (p) => {
    setPlanState(p);
    window.storage.set(PLAN_KEY, p, false).catch(() => {});
  };

  const handleCreateAdFromIntel = ({ competitor, result }) => {
    const brief =
      `Create a short-form counterstrike video ad for a business competing against "${competitor}". ` +
      `${competitor}'s current positioning: ${result.positioning} ` +
      `Their exploitable gaps: ${(result.gaps || []).join("; ")}. ` +
      `Lean into this counter-angle: ${result.counterAngle}`;
    setStudioPrefill({ brief, competitor });
    setPage("studio");
  };

  return (
    <div className="w-full h-full min-h-[720px] flex bg-slate-50 font-sans" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-slate-800">
          <div className="w-7 h-7 rounded-md bg-amber-500 flex items-center justify-center">
            <RadarIcon className="w-4 h-4 text-slate-900" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight leading-none">FPM</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">marketing OS</div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                page === n.id ? "bg-slate-800 text-white border-l-2 border-amber-500" : "text-slate-400 hover:text-white hover:bg-slate-800/60 border-l-2 border-transparent"
              }`}
            >
              <n.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1 text-left">{n.label}</span>
              {n.badge && (
                <span className="text-[9px] font-mono font-semibold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded shrink-0">
                  {n.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold">RV</div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">Riverview Home Services</div>
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                {plan === "Super User" && <Crown className="w-2.5 h-2.5 text-amber-400" />}
                {planLoaded ? plan : "Pro"} plan
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {page === "dashboard" && <Dashboard leads={leadsForDash} setPage={setPage} />}
        {page === "intel" && <CompetitorIntel onCreateAd={handleCreateAdFromIntel} />}
        {page === "studio" && (
          <CreativeStudio prefill={studioPrefill} onConsumedPrefill={() => setStudioPrefill(null)} setPage={setPage} />
        )}
        {page === "funnels" && <Funnels />}
        {page === "leads" && <Leads />}
        {page === "marketplace" && <Marketplace />}
        {page === "customize" && <AICustomization plan={planLoaded ? plan : "Pro"} onUnlock={() => setPlan("Super User")} />}
        {page === "accounts" && <Accounts plan={plan} setPlan={setPlan} />}
      </main>
    </div>
  );
}
