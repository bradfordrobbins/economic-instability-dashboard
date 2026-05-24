// =========================
// CONFIG
// =========================

const SHEET_ID = "1qpGEb9FEuhttf0PCVuziBQn9Qvpr33OTsitIaqEdbI0";

const URL_INDICATORS = `https://opensheet.elk.sh/${SHEET_ID}/Indicators`;
const URL_THRESHOLDS = `https://opensheet.elk.sh/${SHEET_ID}/Thresholds`;

console.log("DASHBOARD.JS VERSION: 9");

// =========================
// NORMALIZE INDICATOR NAMES
// =========================

function normalizeName(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

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

const UPDATE_CADENCE = {
  "Trust": "Annual",
  "Polarization Index": "Annual",
  "AI-Exposed Unemployment": "Monthly",
  "Labor Force Participation": "Monthly",
  "Wage Inequality": "Annual",
  "AI Labor Churn Index": "Synthetic Monthly",
  "Consumer Sentiment": "Monthly",
  "Protest Events": "Weekly → Monthly Aggregated",
  "Governance Stability": "Annual",
  "Narrative Temperature": "Weekly → Monthly Aggregated"
};

// =========================
// ORIENTATION
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
  const order = [];
  const map = {};

  rows.forEach(r => {
    if (!map[r.Indicator]) {
      map[r.Indicator] = [];
      order.push(r.Indicator);   // preserve first-seen order
    }
    map[r.Indicator].push(r);
  });

  order.forEach(ind => {
    map[ind].sort((a, b) => new Date(a.Date) - new Date(b.Date));
  });

  return { map, order };
}


// =========================
// BUILD ANNOTATIONS
// =========================

function buildAnnotations(indicator, t, axisMin, axisMax) {
  if (!t) {
    console.warn("No thresholds for", indicator);
    return {};
  }

  const orient = ORIENTATION[indicator] || "high-worse";

  const g = Number(t.GreenMax);
  const y = Number(t.YellowMax);
  const r = Number(t.RedMax);

  let greenMin, greenMax, yellowMin, yellowMax, redMin, redMax;

  if (orient === "high-worse") {
    greenMin = axisMin;
    greenMax = g;
    yellowMin = g;
    yellowMax = y;
    redMin = y;
    redMax = axisMax;
  } else {
    redMin = axisMin;
    redMax = r;
    yellowMin = r;
    yellowMax = y;
    greenMin = y;
    greenMax = axisMax;
  }

  const clamp = v => Math.min(Math.max(v, axisMin), axisMax);

  const bands = {
    green: {
      type: "box",
      yMin: clamp(greenMin),
      yMax: clamp(greenMax),
      backgroundColor: "rgba(0,255,0,0.45)"
    },
    yellow: {
      type: "box",
      yMin: clamp(yellowMin),
      yMax: clamp(yellowMax),
      backgroundColor: "rgba(255,215,0,0.45)"
    },
    red: {
      type: "box",
      yMin: clamp(redMin),
      yMax: clamp(redMax),
      backgroundColor: "rgba(255,0,0,0.45)"
    }
  };

  console.log("BANDS FOR:", indicator, bands);
  return bands;
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

  const sample = raw[0];
  const keys = Object.keys(sample);
  console.log("THRESHOLDS KEYS SAMPLE:", keys);

  const greenKey = keys.find(k => k.toLowerCase().includes("green"));
  const yellowKey = keys.find(k => k.toLowerCase().includes("yellow"));
  const redKey = keys.find(k => k.toLowerCase().includes("red"));

  console.log("DETECTED THRESHOLD COLUMNS:", { greenKey, yellowKey, redKey });

  const map = {};

  raw.forEach(r => {
    const norm = normalizeName(r.Indicator);
    const canonical = CANONICAL_NAMES[norm];

    if (!canonical) {
      console.warn("No canonical name for:", r.Indicator, "normalized:", norm);
      return;
    }

    map[canonical] = {
      GreenMax: Number(r[greenKey]),
      YellowMax: Number(r[yellowKey]),
      RedMax: Number(r[redKey])
    };
  });

  console.log("THRESHOLDS MAP:", map);
  return map;
}

// =========================
// RENDER CHARTS
// =========================

function renderCharts(grouped, order, thresholds) {
  order.forEach(indicator => {
    const rows = grouped[indicator];
    const labels = rows.map(r => r.Date);
    const values = rows.map(r => r.Value);

    const canvas = document.getElementById(getCanvasId(indicator));
    if (!canvas) return;

    const axisMin = Math.min(...values) * 0.95;
    const axisMax = Math.max(...values) * 1.05;

    const threshold = thresholds[indicator];
    const annotations = buildAnnotations(indicator, threshold, axisMin, axisMax);

    console.log("RENDERING:", indicator, { axisMin, axisMax });

    new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: indicator,
          data: values,
          borderColor: "#4da6ff",
          backgroundColor: "rgba(77,166,255,0.3)",
          borderWidth: 3,
          tension: 0.25,
          pointRadius: 4,
          pointBackgroundColor: "#fff"
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
            text: `${indicator} (${UPDATE_CADENCE[indicator]})`,
            color: "#fff",
            font: { size: 16, weight: "bold" }
          }
        },
        scales: {
          y: {
            min: axisMin,
            max: axisMax,
            grid: { color: "rgba(255,255,255,0.15)" },
            ticks: { color: "#fff" }
          },
          x: {
            ticks: { color: "#fff" }
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

  const { map, order } = groupByIndicator(indicatorData);
  renderCharts(map, order, thresholdData);
}

document.addEventListener("DOMContentLoaded", init);
