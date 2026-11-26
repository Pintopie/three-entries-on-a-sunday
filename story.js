"use strict";
const fmt = d3.format(",");
const motion = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
const bands = ["1 to 5 min", "6 to 10 min", "11 to 29 min", "30+ min"];
const bandRows = d3.select("#bars").selectAll(".barrow").data(bands).join("div").attr("class","barrow");
bandRows.append("span").text(d => d);
bandRows.append("svg").attr("viewBox","0 0 100 8").attr("aria-hidden","true").append("rect")
  .attr("height",8).attr("fill",d => d==="30+ min" ? "var(--rust)" : "var(--green)");
bandRows.append("b");
function measure(index) {
  const denominator = d3.sum(bands,b => transit.bands[b][index]);
  const share = b => 100 * transit.bands[b][index] / denominator;
  bandRows.select("b").text(b => share(b).toFixed(1)+"%");
  bandRows.select("rect").interrupt().transition().duration(motion()).attr("width",share);
  d3.selectAll("#metric button").attr("aria-pressed",(_,i)=>i===index);
}
d3.selectAll("#metric button").on("click",function(){measure([...this.parentElement.children].indexOf(this));});
measure(0);

function aggregate(groups) {
  return d3.rollups(groups,g => ({count:d3.sum(g,r=>r[3]),minutes:d3.sum(g,r=>r[4])}),r=>r[2])
    .map(([code,v])=>({code,...v}));
}
const year = aggregate(transit.groups);
const weather = year.find(row=>row.code==="MUWEA");
const baseline = weather.minutes - d3.sum(transit.events,r=>r[0]);
const stages = ["Other 161 entries",...transit.events.map(e=>e[2]+" "+e[3])];
const buttons = d3.select("#steps").selectAll("button").data(stages).join("button").text(s=>s);
const meter = d3.select("#meter");
const length = d3.scaleLinear().domain([0,3000]).range([0,600]);
meter.append("rect").attr("width",600).attr("height",34).attr("fill","#d7d9ca");
meter.append("rect").attr("width",length(baseline)).attr("height",34).attr("fill","var(--green)");
const addition = meter.append("rect").attr("x",length(baseline)).attr("height",34).attr("fill","var(--rust)");
function restore(i) {
  const extra = d3.sum(transit.events.slice(0,i),e=>e[0]);
  const minutes = baseline + extra;
  const rank = 1 + year.filter(r=>r.code!=="MUWEA" && r.minutes>minutes).length;
  buttons.attr("aria-pressed",(_,j)=>i===j);
  d3.select("#event").text(i ? stages[i] : "Before the three entries");
  d3.select("#total").text(fmt(minutes));
  d3.select("#rank").text("#"+rank);
  const messages=["The other 161 weather entries add up to 781 minutes.","Eglinton adds 807 minutes. Weather moves up ten places.","Sheppard West adds 900 minutes. Weather reaches eighth before the last entry returns.","Rosedale adds 257 minutes. The annual total grows again. The rank stays eighth."];
  d3.select("#caption").text(messages[i]);
  addition.interrupt().transition().duration(motion()).attr("width",length(extra));
}
buttons.on("click",(_,stage)=>restore(stages.indexOf(stage)));
restore(0);

function options(id,values,label) {
  d3.select(id).selectAll("option.choice").data([...new Set(values)].sort()).join("option")
    .attr("class","choice").attr("value",v=>v).text(label);
}
options("#line",transit.groups.map(r=>r[1]),v=>v);
options("#month",transit.groups.map(r=>r[0]),v=>d3.timeFormat("%B")(d3.timeParse("%Y-%m")(v)));
function explore(){
  const value=id=>document.getElementById(id).value;
  const line=value("line"), month=value("month"), metric=value("sort");
  const filtered=aggregate(transit.groups.filter(r=>(!line || line===r[1]) && (!month || month===r[0])))
    .sort((a,b)=>d3.descending(a[metric],b[metric]) || d3.ascending(a.code,b.code));
  const tr=d3.select("tbody").selectAll("tr").data(filtered,r=>r.code).join("tr").order();
  tr.selectAll("td").data(r=>[r.code+" · "+transit.names[r.code],fmt(r.count),fmt(r.minutes)]).join("td").text(v=>v);
  d3.select("#result").text(filtered.length ? filtered.length+" codes. Highest "+(metric==="count"?"record count":"minute total")+": "+transit.names[filtered[0].code]+" ("+fmt(filtered[0][metric])+")." : "No positive-delay records for this selection.");
}
d3.selectAll("#explore select").on("change",explore);
explore();
