"use strict";

const number = d3.format(",");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const duration = () => reducedMotion.matches ? 0 : 560;
const weatherCode = "MUWEA";
const select = id => d3.select("#" + id);
const bands = ["1 to 5 min", "6 to 10 min", "11 to 29 min", "30+ min"];

function aggregate(groups) {
  return d3.rollups(
    groups,
    rows => ({ count: d3.sum(rows, r => r[3]), minutes: d3.sum(rows, r => r[4]) }),
    row => row[2]
  ).map(([code, totals]) => ({ code, ...totals }));
}

const fullYear = aggregate(transit.groups);
const weather = fullYear.find(row => row.code === weatherCode);
const omittedMinutes = d3.sum(transit.events, event => event[0]);

function bars(id, data, maximum, format, ticks) {
  const chart = select(id);
  const rows = chart.selectAll(".bar-row").data(data).join("div").attr("class", "bar-row");
  const label = rows.append("span").attr("class", "label").text(d => d.label);
  label.filter(d => d.detail).append("small").text(d => d.detail);
  const marks = rows.append("svg")
    .attr("viewBox", "0 0 1000 24")
    .attr("preserveAspectRatio", "none")
    .attr("aria-hidden", "true")
    .append("rect")
    .attr("height", 24)
    .attr("width", d => 1000 * d.value / maximum)
    .attr("fill", d => d.accent ? "var(--accent)" : "var(--blue)");
  rows.append("span").attr("class", "value")
    .classed("accent", d => d.accent)
    .text(d => format(d.value));

  chart.append("div").attr("class", "bar-row")
    .append("div").attr("class", "axis-labels")
    .selectAll("span").data(ticks).join("span").text(format);

  return () => {
    if (reducedMotion.matches) return;
    marks.attr("width", 0).transition().duration(duration())
      .ease(d3.easeCubicOut).attr("width", d => 1000 * d.value / maximum);
  };
}

function durationData(index) {
  const total = d3.sum(bands, band => transit.bands[band][index]);
  return bands.map(band => ({
    label: band,
    value: 100 * transit.bands[band][index] / total,
    accent: band === "30+ min"
  }));
}

const shortLabels = {
  SUDP: "Disorderly patron",
  MUPAA: "PAA, no trouble found",
  MUIR: "Medical aid refused",
  PUOPO: "Train door monitoring",
  MUSAN: "Unsanitary vehicle",
  SUO: "Security, other",
  TUO: "Transportation, other",
  MUI: "Medical aid, transported",
  SUUT: "Unauthorized at track level",
  MUWEA: "Weather-related"
};
function topEight(metric) {
  return d3.sort(fullYear, row => -row[metric], row => row.code).slice(0, 8).map(row => ({
    label: shortLabels[row.code] ?? transit.names[row.code],
    detail: row.code,
    value: row[metric],
    accent: row.code === weatherCode
  }));
}

const percent = value => value.toFixed(1) + "%";
const weatherBars = d3.sort(transit.events, event => -event[0])
  .map(([value, , time, station]) => ({ label: station, detail: time, value, accent: true }));
const reveals = new Map([
  ["record-share", bars("record-share", durationData(0), 65, percent, [0, 32.5, 65])],
  ["minute-share", bars("minute-share", durationData(1), 65, percent, [0, 32.5, 65])],
  ["count-rank", bars("count-rank", topEight("count"), 1200, number, [0, 600, 1200])],
  ["minute-rank", bars("minute-rank", topEight("minutes"), 8000, number, [0, 4000, 8000])],
  ["weather-records", bars("weather-records", weatherBars, 1000, number, [0, 500, 1000])]
]);

const month = select("month");
const line = select("line");
const code = select("code");
const exclude = select("exclude");
const scatter = select("scatter-chart");
const monthLabel = d3.timeFormat("%B");
const parseMonth = d3.timeParse("%Y-%m");
let omit = false;
let plottedRows = [];
let previousWidth = 0;

function appendOptions(selection, values, label) {
  selection.selectAll(".choice").data(values).join("option").attr("class", "choice")
    .attr("value", d => d).text(label);
}
appendOptions(month, d3.sort(new Set(transit.groups.map(row => row[0]))), value => monthLabel(parseMonth(value)));
appendOptions(line, d3.sort(new Set(transit.groups.map(row => row[1]))), value => value);

const svg = scatter.append("svg").attr("role", "img")
  .attr("aria-label", "Scatterplot of positive-delay record counts and recorded minutes by incident code.");
const xAxis = svg.append("g");
const yAxis = svg.append("g").attr("class", "grid");
const xLabel = svg.append("text").attr("text-anchor", "middle").text("Positive-delay records");
const yLabel = svg.append("text").text("Recorded minutes");
const points = svg.append("g");
const callout = svg.append("text").text("Weather").attr("font-weight", 700).attr("pointer-events", "none");

function highlight(current) {
  points.selectAll("circle")
    .attr("stroke-width", row => row.code === current ? 3 : 1)
    .attr("stroke", row => row.code === current ? "var(--ink)" : "#fff");
}

function inspect(row) {
  select("inspector").text(row
    ? `${row.code} · ${transit.names[row.code]} · ${number(row.count)} records · ${number(row.minutes)} minutes`
    : "Choose an incident code to see its recorded totals.");
  highlight(row?.code);
}

function renderScatter(animate) {
  const width = Math.max(250, Math.floor(scatter.node().clientWidth));
  previousWidth = width;
  const height = Math.min(440, Math.max(300, width * 0.53));
  const left = 53;
  const top = 34;
  const bottom = height - 48;
  const right = width - 20;
  // Keep the deck's full-year scale so filtered views remain comparable.
  const x = d3.scaleLinear().domain([0, 1200]).range([left, right]);
  const y = d3.scaleLinear().domain([0, 8000]).range([bottom, top]);
  svg.attr("viewBox", `0 0 ${width} ${height}`);
  xAxis.attr("transform", `translate(0,${bottom})`).call(d3.axisBottom(x).ticks(width < 460 ? 4 : 8));
  yAxis.attr("transform", `translate(${left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(left - right));
  xLabel.attr("x", (left + right) / 2).attr("y", height - 8);
  yLabel.attr("x", left).attr("y", 16);

  const dots = points.selectAll("circle").data(plottedRows, row => row.code).join(
    enter => enter.append("circle").attr("cy", row => y(row.minutes)).attr("cx", row => x(row.count)),
    update => update,
    exit => exit.interrupt().remove()
  ).attr("class", "dot")
    .attr("r", row => row.code === weatherCode ? 6 : 4)
    .attr("fill", row => row.code === weatherCode ? "var(--accent)" : "var(--blue)")
    .attr("fill-opacity", row => row.code === weatherCode ? 1 : 0.7)
    .on("pointerenter click", (_, row) => {
      code.property("value", row.code);
      inspect(row);
    });
  dots.interrupt();
  const animated = animate && duration() ? dots.transition().duration(duration()) : dots;
  animated.attr("cx", row => x(row.count)).attr("cy", row => y(row.minutes));
  const visibleWeather = plottedRows.find(row => row.code === weatherCode);
  callout.interrupt().attr("display", visibleWeather ? null : "none");
  if (visibleWeather) {
    const label = animate && duration() ? callout.transition().duration(duration()) : callout;
    label.attr("x", x(visibleWeather.count) + 10).attr("y", y(visibleWeather.minutes) - 8);
  }
  highlight(code.property("value"));
}

function updateExplorer(animate = true) {
  const selectedMonth = month.property("value");
  const selectedLine = line.property("value");
  const subset = Boolean(selectedMonth || selectedLine);
  if (subset) omit = false;
  exclude.property("disabled", subset).attr("aria-pressed", omit)
    .text(omit ? "Restore the three weather rows" : "Exclude the three weather rows");

  const groups = transit.groups.filter(row =>
    (!selectedMonth || row[0] === selectedMonth) && (!selectedLine || row[1] === selectedLine));
  plottedRows = aggregate(groups);
  if (omit) {
    const current = plottedRows.find(row => row.code === weatherCode);
    current.count -= transit.events.length;
    current.minutes -= omittedMinutes;
  }
  const weatherMinutes = weather.minutes - (omit ? omittedMinutes : 0);
  const rank = 1 + fullYear.filter(row => row.code !== weatherCode && row.minutes > weatherMinutes).length;
  let status = `Full year · Weather ranks #${rank} with ${number(weatherMinutes)} recorded minutes.`;
  if (subset) status = plottedRows.length
    ? `${plottedRows.length} matching codes. Choose the full year and all lines to compare weather ranks.`
    : "No positive-delay records match these filters.";
  select("scenario").text(status);

  const wanted = code.property("value");
  appendOptions(code, d3.sort(plottedRows.map(row => row.code)), value => `${value} · ${transit.names[value]}`);
  const selectedRow = plottedRows.find(row => row.code === wanted);
  code.property("value", selectedRow?.code ?? "");
  inspect(selectedRow);

  select("code-table").selectAll("tr")
    .data(d3.sort(plottedRows, row => -row.minutes, row => row.code), row => row.code)
    .join("tr").order().selectAll("td")
    .data(row => [`${row.code} · ${transit.names[row.code]}`, number(row.count), number(row.minutes)])
    .join("td").text(value => value);

  renderScatter(animate);
}

month.on("change", () => updateExplorer());
line.on("change", () => updateExplorer());
code.on("change", () => inspect(plottedRows.find(row => row.code === code.property("value"))));
exclude.on("click", () => {
  omit = !omit;
  updateExplorer();
});
updateExplorer(false);
new ResizeObserver(() => {
  if (Math.floor(scatter.node().clientWidth) !== previousWidth) renderScatter(false);
}).observe(scatter.node());

const chartObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    reveals.get(entry.target.id)();
    chartObserver.unobserve(entry.target);
  }
}, { threshold: 0.22 });
for (const id of reveals.keys()) chartObserver.observe(select(id).node());

const chapters = [...document.querySelectorAll(".chapter")];
const links = [...document.querySelectorAll("nav a")];
const progress = document.querySelector(".reading-progress");
function updateReadingPosition() {
  const available = document.documentElement.scrollHeight - innerHeight;
  const fraction = available > 0 ? Math.max(0, Math.min(1, scrollY / available)) : 0;
  progress.style.transform = `scaleX(${fraction})`;
  const current = chapters.findLast(chapter => chapter.getBoundingClientRect().top < innerHeight * 0.43);
  const active = current?.id === "minutes" ? "records" : current?.id;
  for (const link of links) {
    if (link.hash === "#" + active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
let pendingFrame = false;
function requestReadingUpdate() {
  if (pendingFrame) return;
  pendingFrame = true;
  requestAnimationFrame(() => {
    pendingFrame = false;
    updateReadingPosition();
  });
}
addEventListener("scroll", requestReadingUpdate, { passive: true });
addEventListener("resize", requestReadingUpdate);
new ResizeObserver(requestReadingUpdate).observe(document.body);
updateReadingPosition();
