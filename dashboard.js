// ==== CONFIG ====

const SHEET_ID = "1qpGEb9FEuhttf0PCVuziBQn9Qvpr33OTsitIaqEdbI0";
const SHEET_TAB = "Indicators";
const SHEET_URL = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_TAB}`;

// Corrected thresholds (always red < yellow < green)
const THRESHOLDS = {
  "Trust": { redMax: 40, yellowMax: 55, greenMax: 100 },
  "Polarization Index": { redMax: 1.0, yellowMax: 0.60, greenMax: 0.40 },
  "AI-Exposed Unemployment": { redMax: 100, yellowMax: 5.0, greenMax: 3.5 },
  "Labor Force Participation": { redMax: 80, yellowMax: 83, greenMax: 100 },
  "Wage Inequality": { redMax: 100, yellowMax: 5.5, greenMax: 4.5 },
  "AI Labor Churn Index": { redMax: 10, yellowMax: 1.5, greenMax: 1.2 },
  "Consumer Sentiment": { redMax: 60, yellowMax: 80, greenMax: 100 },
  "Protest Events": { redMax: 100, yellowMax: 15, greenMax: 5 },
  "Governance Stability": { redMax: 0.55, yellowMax: 0.70, greenMax: 1.0 },
  "Narrative Temperature": { redMax: 100, yellowMax: 60, greenMax: 40 }
};

// ==== HELPERS ====

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

function buildAnnotations(indicator) {
  const t = THRESHOLDS[indicator];
  if (!t) return {};

  return {
    red: {
      type: "box",
      yMin: 0,
      yMax: t.redMax,
      backgroundColor: "rgba(255, 80, 80, 0.20)",
      borderWidth: 0
    },
    yellow: {
      type: "box",
      yMin: t.redMax,
      yMax: t.yellowMax,
      backgroundColor: "rgba(255, 230, 120, 0.20)",
      borderWidth: 0
    },
    green: {
      type: "box",
      yMin: t.yellowMax,
      yMax: t.greenMax,
      backgroundColor: "rgba(120, 255, 120, 0.20)",
      borderWidth: 0
    }
  };
}

// ==== MAIN ====

async function loadData() {
  const res = await fetch(SHEET_URL);
  const raw = await res.json();

  return raw.map(r => ({
    Date: r.Date,
    Indicator: r.Indicator,
    Value: Number(r.Value)
  }));
}

function renderCharts(grouped) {
  Object.keys(grouped).forEach(indicator => {
    const rows = grouped[indicator];
    const labels = rows.map(r => r.Date);
    const values = rows.map(r => r.Value);

    const canvas = document.getElementById(getCanvasId(indicator));
    if (!canvas) return;

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
          annotation: {
            annotations: buildAnnotations(indicator)
          },
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

async function init() {
  const data = await loadData();
  const grouped = groupByIndicator(data);
  renderCharts(grouped);
}

document.addEventListener("DOMContentLoaded", init);
