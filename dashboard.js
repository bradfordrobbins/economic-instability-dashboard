// =========================
// CONFIG
// =========================

const SHEET_ID = "1qpGEb9FEuhttf0PCVuziBQn9Qvpr33OTsitIaqEdbI0";

const URL_INDICATORS = `https://opensheet.elk.sh/${SHEET_ID}/Indicators`;
const URL_THRESHOLDS = `https://opensheet.elk.sh/${SHEET_ID}/Thresholds`;


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
// BUILD ANNOTATIONS FROM SHEET
// =========================

function buildAnnotations(threshold) {
  const redMax = Number(threshold.RedMax);
  const yellowMax = Number(threshold.YellowMax);
  const greenMax = Number(threshold.GreenMax);

  return {
    red: {
      type: "box",
      yMin: 0,
      yMax: redMax,
      backgroundColor: "rgba(255, 80, 80, 0.20)",
      borderWidth: 0
    },
    yellow: {
      type: "box",
      yMin: redMax,
      yMax: yellowMax,
      backgroundColor: "rgba(255, 230, 120, 0.20)",
      borderWidth: 0
    },
    green: {
      type: "box",
      yMin: yellowMax,
      yMax: greenMax,
      backgroundColor: "rgba(120, 255, 120, 0.20)",
      borderWidth: 0
    }
  };
}


// =========================
// LOAD DATA FROM GOOGLE SHEETS
// =========================

async function loadIndicators() {
  const res = await fetch(URL_INDICATORS);
  const raw = await res.json();

  return raw.map(r => ({
    Date: r.Date,
    Indicator: r.Indicator,
    Value: Number(r.Value)
  }));
}

async function loadThresholds() {
  const res = await fetch(URL_THRESHOLDS);
  const raw = await res.json();

  // Convert sheet rows into a lookup table:
  // thresholds["Trust"] = { GreenMax: 100, YellowMax: 54, RedMax: 39 }
  const map = {};
  raw.forEach(r => {
    map[r.Indicator] = {
      GreenMax: Number(r["# Green Max"]),
      YellowMax: Number(r["# Yellow Max"]),
      RedMax: Number(r["# Red Max"])
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
    const annotations = threshold ? buildAnnotations(threshold) : {};

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
        },
        scales: {
          y: {
            grid: { color: "rgba(255,255,255,0.1)" },
            ticks: { color: "#eee" }
          },
          x: {
            ticks: { color: "#eee" }
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
