// =========================
// CONFIG
// =========================

const SHEET_ID = "1qpGEb9FEuhttf0PCVuziBQn9Qvpr33OTsitIaqEdbI0";

const URL_INDICATORS = `https://opensheet.elk.sh/${SHEET_ID}/Indicators`;
const URL_THRESHOLDS = `https://opensheet.elk.sh/${SHEET_ID}/Thresholds`;


// =========================
// NORMALIZE INDICATOR NAMES
// =========================

// Map long names in Thresholds tab → short names in Indicators tab
const INDICATOR_NAME_MAP = {
  "Trust": "Trust",
  "Polarization Index": "Polarization Index",
  "AI-Exposed Unemployment (%)": "AI-Exposed Unemployment",
  "Labor Force Participation (Prime Age)": "Labor Force Participation",
  "Wage Inequality (90/10 Ratio)": "Wage Inequality",
  "AI Labor Churn Index": "AI Labor Churn Index",
  "Consumer Sentiment": "Consumer Sentiment",
  "Protest Events (Monthly)": "Protest Events",
  "Governance Stability Score": "Governance Stability",
  "Narrative Temperature Index": "Narrative Temperature"
};


// =========================
// ORIENTATION (UP = WORSE)
// =========================

const ORIENTATION = {
  "Trust": "low-worse",
  "Labor Force Participation": "low-worse",
  "Consumer Sentiment": "low-worse",
  "Governance Stability": "low-worse",

  "Polarization Index": "high-worse",
  "AI-Exposed Unemployment": "high-worse",
  "Wage Inequality": "high-worse",
  "AI Labor Churn Index": "high-worse",
  "Protest Events": "high-worse",
  "Narrative Temperature": "high-worse"
};


// =========================
// HELPERS
// =========================

function groupByIndicator(rows) {
  const map = {};
  rows.forEach(r => {
    if (!map[r.Indicator]) map[r.Indicator] = [];
    map[r.Indicator].push(r);
  });
  Object.keys(map).forEach(k => {
    map[k].sort((a, b) => new Date(a.Date) - new Date(b.Date));
  });
  return map;
}

function getCanvasId(indicator) {
  return "chart-" + indicator.replace(/\s+/g, "-");
}


// =========================
// BUILD ANNOTATIONS
// =========================
function buildAnnotations(indicator, t) {
  if (!t) {
    console.warn("No thresholds for", indicator);
    return {};
  }

  const orient = ORIENTATION[indicator] || "low-worse";

  const g = Number(t.GreenMax);
  const y = Number(t.YellowMax);
  const r = Number(t.RedMax);

  let greenMin, greenMax, yellowMin, yellowMax, redMin, redMax;

  if (orient === "high-worse") {
    // Higher is worse: 0–g green, g–y yellow, y–r red
    greenMin = 0;
    greenMax = g;
    yellowMin = g;
    yellowMax = y;
    redMin = y;
    redMax = r;
  } else {
    // Lower is worse: red at bottom, green at top
    // red: 0–r, yellow: r–y, green: y–g
    redMin = 0;
    redMax = r;
    yellowMin = r;
    yellowMax = y;
    greenMin = y;
    greenMax = g;
  }

  console.log("BANDS FOR:", indicator, {
    orient,
    green: [greenMin, greenMax],
    yellow: [yellowMin, yellowMax],
    red: [redMin, redMax]
  });

  return {
    green: {
      type: "box",
      yMin: greenMin,
      yMax: greenMax,
      backgroundColor: "rgba(120,255,120,0.20)"
    },
    yellow: {
      type: "box",
      yMin: yellowMin,
      yMax: yellowMax,
      backgroundColor: "rgba(255,230,120,0.20)"
    },
    red: {
      type: "box",
      yMin: redMin,
      yMax: redMax,
      backgroundColor: "rgba(255,80,80,0.20)"
    }
  };
}


// =========================
// LOAD DATA
// =========================

async function loadIndicators() {
  const res = await fetch(URL_INDICATORS);
  const raw = await res.json();

  console.log("INDICATORS RAW:", raw);

  const parsed = raw.map(r => ({
    Date: r.Date,
    Indicator: String(r.Indicator || "").trim(),
    Value: Number(r.Value)
  }));

  console.log("INDICATORS PARSED:", parsed);
  return parsed;
}

async function loadThresholds() {
  const res = await fetch(URL_THRESHOLDS);
  const raw = await res.json();

  console.log("THRESHOLDS RAW:", raw);
  if (raw.length === 0) {
    console.warn("No threshold rows returned");
    return {};
  }

  const sample = raw[0];
  const keys = Object.keys(sample);
  console.log("THRESHOLDS KEYS SAMPLE:", keys);

  const greenKey  = keys.find(k => k.toLowerCase().includes("green"));
  const yellowKey = keys.find(k => k.toLowerCase().includes("yellow"));
  const redKey    = keys.find(k => k.toLowerCase().includes("red"));

  console.log("DETECTED THRESHOLD COLUMNS:", { greenKey, yellowKey, redKey });

  const map = {};

  raw.forEach(r => {
    const rawName = String(r.Indicator || "");
    const norm = normalizeName(rawName);
    const canonical = CANONICAL_NAMES[norm];

    if (!canonical) {
      console.warn("No canonical name for thresholds row:", rawName, "normalized as:", norm, r);
      return;
    }

    const g  = Number(String(r[greenKey]).trim());
    const y  = Number(String(r[yellowKey]).trim());
    const rd = Number(String(r[redKey]).trim());

    map[canonical] = {
      GreenMax: g,
      YellowMax: y,
      RedMax: rd
    };
  });

  console.log("THRESHOLDS MAP:", map);
  window.LAST_THRESHOLDS = map;
  return map;
}


// Turn "AI‑Exposed Unemployment (%)" and "AI-Exposed Unemployment" into the same key
function normalizeName(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")   // normalize all hyphen-like chars to "-"
    .replace(/[^a-z0-9]+/g, " ")       // remove punctuation, keep letters/numbers as words
    .trim()
    .replace(/\s+/g, " ");             // collapse spaces
}

// Canonical indicator names (what you use in the Indicators tab)
const CANONICAL_NAMES = {
  "trust": "Trust",
  "polarization index": "Polarization Index",
  "ai exposed unemployment": "AI-Exposed Unemployment",
  "labor force participation prime age": "Labor Force Participation",
  "wage inequality 90 10 ratio": "Wage Inequality",
  "ai labor churn index": "AI Labor Churn Index",
  "consumer sentiment": "Consumer Sentiment",
  "protest events monthly": "Protest Events",
  "governance stability score": "Governance Stability",
  "narrative temperature index": "Narrative Temperature"
};

// =========================
// RENDER CHARTS
// =========================

function renderCharts(grouped, thresholds) {
  Object.keys(grouped).forEach(indicator => {
    const rows = grouped[indicator];
    const labels = rows.map(r => r.Date);
    const values = rows.map(r => r.Value);

    const canvas = document.getElementById(getCanvasId(indicator));
    if (!canvas) {
      console.warn("No canvas for indicator:", indicator, "expected id:", getCanvasId(indicator));
      return;
    }

    const threshold = thresholds[indicator];
    const annotations = buildAnnotations(indicator, threshold);

    console.log("RENDERING:", indicator);
    console.log("  values:", values);
    console.log("  thresholds:", threshold);
    console.log("  orientation:", ORIENTATION[indicator]);
    console.log("  annotations:", annotations);

    new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: indicator,
          data: values,
          borderColor: "#4da6ff",
          backgroundColor: "rgba(77,166,255,0.2)",
          tension: 0.2,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          annotation: { annotations },
          legend: { display: false },
          title: {
            display: true,
            text: indicator,
            font: { size: 14 }
          }
        }
      }
    });
  });
}


// =========================
// INIT
// =========================

async function init() {
  const [indicatorData, thresholdData] = await Promise.all([
    loadIndicators(),
    loadThresholds()
  ]);

  const grouped = groupByIndicator(indicatorData);
  console.log("GROUPED INDICATORS:", grouped);

  renderCharts(grouped, thresholdData);
}

document.addEventListener("DOMContentLoaded", init);
