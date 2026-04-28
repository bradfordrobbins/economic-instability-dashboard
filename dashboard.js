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
  if (!t) return {};

  const orient = ORIENTATION[indicator] || "low-worse";

  const g = Number(t.GreenMax);
  const y = Number(t.YellowMax);
  const r = Number(t.RedMax);

  let low, mid, high;

  if (orient === "low-worse") {
    low = r;
    mid = y;
    high = g;
  } else {
    low = g;
    mid = y;
    high = r;
  }

  return {
    green: {
      type: "box",
      yMin: 0,
      yMax: low,
      backgroundColor: "rgba(120,255,120,0.20)"
    },
    yellow: {
      type: "box",
      yMin: low,
      yMax: mid,
      backgroundColor: "rgba(255,230,120,0.20)"
    },
    red: {
      type: "box",
      yMin: mid,
      yMax: high,
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

  return raw.map(r => ({
    Date: r.Date,
    Indicator: r.Indicator.trim(),
    Value: Number(r.Value)
  }));
}

async function loadThresholds() {
  const res = await fetch(URL_THRESHOLDS);
  const raw = await res.json();

  const map = {};

  raw.forEach(r => {
    const cleanName = INDICATOR_NAME_MAP[r.Indicator.trim()];
    if (!cleanName) return;

    map[cleanName] = {
      GreenMax: Number(String(r["# Green Max"]).trim()),
      YellowMax: Number(String(r["# Yellow Max"]).trim()),
      RedMax: Number(String(r["# Red Max"]).trim())
    };
  });

  return map;
}


// =========================
// RENDER CHARTS
// =========================

function renderCharts(grouped, thresholds) {
  Object.keys(grouped).forEach(indicator => {
    const rows = grouped[indicator];
    const labels = rows.map(r => r.Date);
    const values = rows.map(r => r.Value);

    const canvas = document.getElementById(getCanvasId(indicator));
    if (!canvas) return;

    const threshold = thresholds[indicator];
    const annotations = buildAnnotations(indicator, threshold);

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
  renderCharts(grouped, thresholdData);
}

document.addEventListener("DOMContentLoaded", init);
