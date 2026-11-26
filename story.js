"use strict";
const titles=["Title","The usual delay","Count the minutes","Change the ranking","Look inside weather","Explore the tradeoff"];
const summaries=["","Most entries last five minutes or less. Five minutes or less accounts for 61.4% of positive-delay records.","Long delays take a bigger share of the minutes. Entries of at least 30 minutes account for 20.7% of minutes.","Weather moves up six places, from 14th by frequency to eighth by recorded minutes.","Three weather entries on one Sunday account for 1,964 minutes.","Three rows move weather from 23rd to 8th. Compare incident codes by record count and summed delay minutes."];
const byId=id=>document.getElementById(id);
const svg=d3.select("#layer"), fmt=d3.format(","), bands=["1 to 5 min","6 to 10 min","11 to 29 min","30+ min"];
const reduced=matchMedia("(prefers-reduced-motion: reduce)");
let page=0;
function totals(rows){
 return d3.rollups(rows,g=>({count:d3.sum(g,r=>r[3]),minutes:d3.sum(g,r=>r[4])}),r=>r[2]).map(([code,v])=>({code,...v}));
}
const year=totals(transit.groups);
function rect(x,y,w,h,fill){
 return svg.append("rect").attr("x",x).attr("y",y).attr("width",w).attr("height",h).attr("fill",fill);
}
function tooltip(node,message){
 const tip=byId("tip"),box=node.getBoundingClientRect();
 tip.textContent=message;tip.hidden=false;
 tip.style.left=Math.max(5,Math.min(innerWidth-tip.offsetWidth-5,box.left))+"px";
 tip.style.top=Math.max(5,Math.min(innerHeight-tip.offsetHeight-5,box.bottom+5))+"px";
}
function interactive(shape,label){
 shape.attr("class","mark").attr("tabindex",0).attr("role","button").attr("aria-label",label)
 .on("mouseenter focus click",function(){tooltip(this,label);})
 .on("mouseleave blur",()=>byId("tip").hidden=true)
 .on("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();tooltip(this,label);}});
}
function bar(x,y,w,h,label){
 if(!reduced.matches)rect(x,y,w,h,"white").attr("pointer-events","none").transition().duration(440)
 .attr("x",x+w).attr("width",0).remove();
 interactive(rect(x,y,w,h,"transparent"),label);
}
function scatter(){
 const line=byId("line").value,month=byId("month").value;
 const filtered=Boolean(line||month);
 const rows=filtered?totals(transit.groups.filter(r=>(!month||r[0]===month)&&(!line||r[1]===line))):year;
 const x=d3.scaleLinear().domain([0,1200]).range([45.5,369]),y=d3.scaleLinear().domain([0,8000]).range([282.1,163.8]);
 if(filtered){
  rect(44,157,340,129,"white");
  for(const t of x.ticks(12))rect(x(t),158,.25,126,"#ddd");
  for(const t of y.ticks(4))rect(44,y(t),338,.25,"#ddd");
 }
 for(const row of rows){
  const cx=x(row.count),cy=y(row.minutes);
  if(filtered)svg.append("circle").attr("cx",cx).attr("cy",cy).attr("r",1.9).attr("fill",row.code==="MUWEA"?"#f28e2b":"#7596ba");
  interactive(svg.append("circle").attr("cx",cx).attr("cy",cy).attr("r",2.6),transit.names[row.code]+" ("+row.code+") · "+fmt(row.count)+" records · "+fmt(row.minutes)+" minutes");
 }
 if(!rows.length)svg.append("text").attr("x",90).attr("y",219).attr("font-size",7).text("No records for this selection");
}
function draw(){
 svg.selectAll("*").interrupt().remove();byId("tip").hidden=true;
 if(page===1||page===2){
  const k=page-1,den=d3.sum(bands,b=>transit.bands[b][k]);
  bands.forEach((b,i)=>{const [n,m]=transit.bands[b],pct=100*transit.bands[b][k]/den;
   bar(39.5,160+i*34.5,pct*5.14,24,b+" · "+fmt(n)+" records · "+fmt(m)+" minutes · "+pct.toFixed(1)+"%");
  });
 }else if(page===3){
  ["count","minutes"].forEach((key,j)=>[...year].sort((a,b)=>b[key]-a[key]).slice(0,8).forEach((r,i)=>{
   bar(j?338:76,176+i*13.45,r[key]*(j?.02165:.142),9.7,transit.names[r.code]+" ("+r.code+") · "+fmt(r.count)+" records · "+fmt(r.minutes)+" minutes");
  }));
 }else if(page===4){
  [...transit.events].sort((a,b)=>b[0]-a[0]).forEach(([v,date,time,name],i)=>bar(76,167+i*37.2,v*.302,25.5,name+" · "+date+" at "+time+" · "+fmt(v)+" minutes"));
 }else if(page===5)scatter();
}
const tabs=d3.select("#tabs").selectAll("button").data(titles.slice(1)).join("button")
 .attr("aria-label",(d,i)=>(i+1)+". "+d).attr("title",d=>d).on("click",(_,d)=>go(titles.indexOf(d)));
function go(i){
 page=Math.max(0,Math.min(5,i));history.replaceState(null,"",location.href.split("#")[0]+"#slide-"+(page+1));
 document.querySelector(".cover").hidden=page!==0;byId("view").hidden=!page;
 if(page){byId("art").src="slides/"+page+".png";byId("art").alt=summaries[page];}
 tabs.attr("aria-current",(_,j)=>j+1===page?"step":null);
 byId("filters").hidden=page!==5;byId("page").textContent=(page+1)+" / 6";
 byId("prev").disabled=page===0;byId("next").disabled=page===5;draw();
}
for(const [id,k] of [["month",0],["line",1]]){
 const sel=byId(id);for(const val of [...new Set(transit.groups.map(r=>r[k]))].sort())sel.add(new Option(val,val));sel.onchange=draw;
}
byId("start").onclick=()=>go(1);byId("prev").onclick=()=>go(page-1);byId("next").onclick=()=>go(page+1);
byId("full").onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
document.addEventListener("keydown",e=>{
 if(e.target.matches?.("select")||e.altKey||e.metaKey||e.ctrlKey)return;
 if(e.key==="Escape"){byId("tip").hidden=true;return;}
 const moves={ArrowRight:page+1,PageDown:page+1,ArrowLeft:page-1,PageUp:page-1,Home:0,End:5};
 if(e.key in moves){e.preventDefault();go(moves[e.key]);}
});
go(Number(location.hash.match(/^#slide-([1-6])$/)?.[1]||1)-1);
