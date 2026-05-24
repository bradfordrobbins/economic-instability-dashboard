// =========================
// CONFIG
// =========================

const SHEET_ID = "1qpGEb9FEuhttf0PCVuziBQn9Qvpr33OTsitIaqEdbI0";

const URL_INDICATORS = `https://opensheet.elk.sh/${SHEET_ID}/Indicators`;
const URL_THRESHOLDS = `https://opensheet.elk.sh/${SHEET_ID}/Thresholds`;

console.log("DASHBOARD.JS VERSION: 12");

// =========================
// HELPERS
// =========================

function groupByIndicator(rows) {
  const order = [];
  const map = {};

  rows.forEach(r => {
    if (!map[r.Indicator]) {
      map[r.Indicator] = [];
      order.push(r.Indicator);   // preserve sheet order
    }
    map[r.Indicator].push(r);
  });

  order.forEach(ind => {
    map[ind].sort((a, b) => new Date(a.Date) - new Date(b.Date));
  });

  return { map, order };
}

function getCanvasId(indicator) {
  return "chart-" + indicator.replace(/\s+/g, "-");
}

// =========================
// ANNOTATIONS
// =========================

function buildAnnotations(indicator, t, axisMin, axisMax) {
  if (!t) return {};

  // ⭐ Infer orientation automatically
  const orient =
    Number(t.RedMax) > Number(t.GreenMax)
      ? "high-worse"
      : "low-worse";

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

  return {
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
}

// =========================
// LOAD DATA
// =========================

async function loadIndicators() {
  const res = await fetch(URL_INDICATORS);
  const raw = await res.json();

  return raw.map(r => ({
    Date: r.Date,
    Indicator: String(r.Indicator || "").trim(),
    Value: Number(r.Value)
  }));
}

async function loadThresholds() {
  const res = await fetch(URL_THRESHOLDS);
  const raw = await res.json();

  const sample = raw[0];
  const keys = Object.keys(sample);

  const greenKey = keys.find(k => k.toLowerCase().includes("green"));
  const yellowKey = keys.find(k => k.toLowerCase().includes("yellow"));
  const redKey = keys.find(k => k.toLowerCase().includes("red"));

  const map = {};
  raw.forEach(r => {
    map[r.Indicator] = {
      GreenMax: Number(r[greenKey]),
      YellowMax: Number(r[yellowKey]),
      RedMax: Number(r[redKey])
    };
  });

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

    const t = thresholds[indicator];
    const annotations = buildAnnotations(indicator, t, axisMin, axisMax);

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
            text: indicator,
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
