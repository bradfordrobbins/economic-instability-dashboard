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

  console.log("BUILD ANNOTATIONS FOR:", indicator, "orient:", orient, "raw t:", t, "parsed:", { g, y, r });

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

  const annotations = {
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

  console.log("  annotations:", annotations);
  return annotations;
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

  const map = {};

  raw.forEach(r => {
    const rawName = String(r.Indicator || "").trim();
    const cleanName = INDICATOR_NAME_MAP[rawName];

    if (!cleanName) {
      console.warn("No INDICATOR_NAME_MAP entry for thresholds row:", rawName, r);
      return;
    }

    const g = Number(String(r["# Green Max"]).trim());
    const y = Number(String(r["# Yellow Max"]).trim());
    const rd = Number(String(r["# Red Max"]).trim());

    map[cleanName] = {
      GreenMax: g,
      YellowMax: y,
      RedMax: rd
    };
  });

  console.log("THRESHOLDS MAP:", map);
  window.LAST_THRESHOLDS = map; // for interactive debugging
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
