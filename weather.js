/* Liquid Glass Weather — OpenWeather */
const API_KEY = "5eeee11cdb5e6f638c5145acafd9ac51";
const BASE = "https://api.openweathermap.org";

/* Temperature unit (C metric / F imperial) */
let UNIT = localStorage.getItem("weatherUnit") || "C";
let lastData = null; // { name, cur, fc }
const cToUnit = (c) => UNIT === "F" ? (c * 9/5 + 32) : c;
const tempStr = (c) => Math.round(cToUnit(c)) + "°";

/* Crossfade background system */
const bgEls = [document.getElementById("bgA"), document.getElementById("bgB")];
let bgActive = 0;
let currentBgUrl = "";
function swapBg(url){
  if (url === currentBgUrl) return;
  currentBgUrl = url;
  const next = (bgActive + 1) % 2;
  const img = new Image();
  img.onload = () => {
    bgEls[next].style.backgroundImage = `url('${url}')`;
    bgEls[next].classList.add("active");
    bgEls[bgActive].classList.remove("active");
    bgActive = next;
  };
  img.onerror = () => console.warn("bg failed:", url);
  img.src = url;
}

function setBackground(cur){
  const code = cur.weather[0].icon;
  const isNight = code.endsWith("n");
  const main = code.slice(0,2);
  let pick = "weather_2.jpg";
  if (isNight) pick = (main === "01") ? "weather_5.jpg" : "weather_6.jpg";
  else if (main === "01") pick = "weather_2.jpg";
  else if (main === "02") pick = "weather_3.jpg";
  else if (main === "03" || main === "04") pick = "weather_1.jpg";
  else if (main === "09" || main === "10" || main === "11") pick = "weather_4.jpg";
  else if (main === "13" || main === "50") pick = "weather_3.jpg";
  swapBg(`bg/${pick}`);
}

// Show a default bg immediately so user sees something while API loads
swapBg("bg/weather_2.jpg");

const $ = (id) => document.getElementById(id);
const round = (n) => Math.round(n);
const fmtTime = (ts, tz=0) => {
  const d = new Date((ts + tz) * 1000);
  let h = d.getUTCHours(); const m = d.getUTCMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2,"0")} ${ap}`;
};
const fmtHour = (ts, tz=0) => {
  const d = new Date((ts + tz) * 1000);
  let h = d.getUTCHours();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h} ${ap}`;
};
const dayName = (ts, tz=0, i=0) => {
  if (i===0) return "Today";
  const d = new Date((ts + tz) * 1000);
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getUTCDay()];
};

function iconFor(code) {
  const map = {
    "01d":"fa-solid fa-sun","01n":"fa-solid fa-moon",
    "02d":"fa-solid fa-cloud-sun","02n":"fa-solid fa-cloud-moon",
    "03d":"fa-solid fa-cloud","03n":"fa-solid fa-cloud",
    "04d":"fa-solid fa-clouds","04n":"fa-solid fa-clouds",
    "09d":"fa-solid fa-cloud-showers-heavy","09n":"fa-solid fa-cloud-showers-heavy",
    "10d":"fa-solid fa-cloud-sun-rain","10n":"fa-solid fa-cloud-moon-rain",
    "11d":"fa-solid fa-cloud-bolt","11n":"fa-solid fa-cloud-bolt",
    "13d":"fa-solid fa-snowflake","13n":"fa-solid fa-snowflake",
    "50d":"fa-solid fa-smog","50n":"fa-solid fa-smog",
  };
  return map[code] || "fa-solid fa-cloud";
}

function uvLabel(uv){
  if (uv<3) return "Low"; if (uv<6) return "Moderate";
  if (uv<8) return "High"; if (uv<11) return "Very High"; return "Extreme";
}

async function geocodeMany(q, limit=5){
  const r = await fetch(`${BASE}/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=${limit}&appid=${API_KEY}`);
  if (!r.ok) return [];
  return r.json();
}

async function reverse(lat,lon){
  const r = await fetch(`${BASE}/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
  const j = await r.json();
  return j[0] ? `${j[0].name}${j[0].state?", "+j[0].state:""}` : "My Location";
}

/* ---------- Smooth content transition wrapper ---------- */
const swapTargets = ["city","temp","cond","hi","lo","hourly","daily","wind","hum","dew","vis","press","feels","precip","sunrise","sunset","uv","uvLabel"];
function withTransition(fn){
  const main = document.querySelector(".app");
  main.classList.add("swap","fading");
  setTimeout(()=>{
    fn();
    requestAnimationFrame(()=> main.classList.remove("fading"));
  }, 260);
}

async function loadWeather(lat, lon, name){
  document.body.classList.add("loading");
  try {
    const [curR, fcR] = await Promise.all([
      fetch(`${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
      fetch(`${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`)
    ]);
    if (!curR.ok || !fcR.ok) throw new Error("API error — check your API key");
    const cur = await curR.json();
    const fc  = await fcR.json();
    setBackground(cur);
    lastData = { name: name || cur.name, cur, fc };
    withTransition(()=> render(lastData.name, cur, fc));
  } catch (e) {
    alert(e.message);
    console.error(e);
  } finally {
    document.body.classList.remove("loading");
  }
}

function render(name, cur, fc){
  const tz = cur.timezone || 0;
  $("city").textContent = name;
  $("temp").textContent = Math.round(cToUnit(cur.main.temp));
  $("cond").textContent = cur.weather[0].description.replace(/\b\w/g,c=>c.toUpperCase());
  const next24 = fc.list.slice(0,8);
  const hi = Math.max(...next24.map(x=>x.main.temp_max));
  const lo = Math.min(...next24.map(x=>x.main.temp_min));
  $("hi").textContent = tempStr(hi); $("lo").textContent = tempStr(lo);

  const hourly = $("hourly"); hourly.innerHTML = "";
  const nowEl = document.createElement("div"); nowEl.className = "h-item";
  nowEl.innerHTML = `<span class="h-t">Now</span><i class="${iconFor(cur.weather[0].icon)}"></i><span class="h-tm">${tempStr(cur.main.temp)}</span>`;
  hourly.appendChild(nowEl);
  fc.list.slice(0,10).forEach(item=>{
    const pop = Math.round((item.pop||0)*100);
    const el = document.createElement("div"); el.className = "h-item";
    el.innerHTML = `<span class="h-t">${fmtHour(item.dt,tz)}</span>
      <i class="${iconFor(item.weather[0].icon)}"></i>
      <span class="h-tm">${tempStr(item.main.temp)}</span>
      ${pop>=20?`<span class="h-pop">${pop}%</span>`:""}`;
    hourly.appendChild(el);
  });

  const days = {};
  fc.list.forEach(item=>{
    const d = new Date((item.dt+tz)*1000).toISOString().slice(0,10);
    (days[d] ||= []).push(item);
  });
  const dailyEl = $("daily"); dailyEl.innerHTML = "";
  const allTemps = fc.list.map(x=>x.main.temp);
  const wkMin = Math.min(...allTemps), wkMax = Math.max(...allTemps);
  Object.values(days).slice(0,7).forEach((arr,i)=>{
    const lo = Math.min(...arr.map(x=>x.main.temp_min));
    const hi = Math.max(...arr.map(x=>x.main.temp_max));
    const mid = arr[Math.floor(arr.length/2)];
    const left = ((lo - wkMin) / (wkMax - wkMin)) * 100;
    const right = ((hi - wkMin) / (wkMax - wkMin)) * 100;
    const row = document.createElement("div"); row.className = "d-row";
    row.innerHTML = `
      <span class="d-day">${dayName(arr[0].dt,tz,i)}</span>
      <i class="${iconFor(mid.weather[0].icon)}"></i>
      <span class="d-lo">${tempStr(lo)}</span>
      <div class="d-bar"><span style="left:${left}%;right:${100-right}%"></span></div>
      <span class="d-hi">${tempStr(hi)}</span>`;
    dailyEl.appendChild(row);
  });

  const wind = round(cur.wind.speed * 3.6);
  $("wind").textContent = wind;
  $("hum").textContent = cur.main.humidity + "%";
  const dew = cur.main.temp - ((100 - cur.main.humidity)/5);
  $("dew").textContent = Math.round(cToUnit(dew));
  $("vis").textContent = (cur.visibility/1000).toFixed(1);
  $("press").textContent = cur.main.pressure;
  $("feels").textContent = tempStr(cur.main.feels_like);
  const rain = (cur.rain && (cur.rain["1h"]||cur.rain["3h"])) || 0;
  $("precip").textContent = rain.toFixed(1);
  $("sunrise").textContent = fmtTime(cur.sys.sunrise, tz);
  $("sunset").textContent = fmtTime(cur.sys.sunset, tz);

  const uv = approximateUV(cur);
  $("uv").textContent = uv;
  $("uvLabel").textContent = uvLabel(uv);
  $("uvFill").style.width = Math.min(100, (uv/11)*100) + "%";
}

/* Unit toggle */
document.querySelectorAll("#unitToggle .unit-btn").forEach(btn=>{
  if (btn.dataset.unit === UNIT) btn.classList.add("active");
  else btn.classList.remove("active");
  btn.addEventListener("click", ()=>{
    const u = btn.dataset.unit;
    if (u === UNIT) return;
    UNIT = u;
    localStorage.setItem("weatherUnit", u);
    document.querySelectorAll("#unitToggle .unit-btn").forEach(b=>b.classList.toggle("active", b.dataset.unit===UNIT));
    if (lastData) withTransition(()=> render(lastData.name, lastData.cur, lastData.fc));
  });
});

function approximateUV(cur){
  const now = Date.now()/1000;
  if (now < cur.sys.sunrise || now > cur.sys.sunset) return 0;
  const noon = (cur.sys.sunrise + cur.sys.sunset)/2;
  const span = (cur.sys.sunset - cur.sys.sunrise)/2;
  const factor = Math.max(0, 1 - Math.abs(now-noon)/span);
  const cloudFactor = 1 - (cur.clouds?.all||0)/150;
  return Math.round(11 * factor * cloudFactor);
}

/* ---------- Autocomplete search ---------- */
const input = $("searchInput");
const suggest = $("suggest");
let suggestItems = [];
let activeIdx = -1;
let debounceT;

function flagEmojiToText(cc){
  if (!cc) return "";
  return cc.toUpperCase();
}

function renderSuggest(items){
  suggestItems = items;
  activeIdx = -1;
  if (!items.length){
    suggest.innerHTML = `<div class="muted">No results</div>`;
    suggest.classList.add("open");
    return;
  }
  suggest.innerHTML = items.map((it,i)=>{
    const sub = [it.state, it.country].filter(Boolean).join(", ");
    return `<div class="item" role="option" data-i="${i}">
      <i class="fa-solid fa-location-dot"></i>
      <div><div>${it.name}</div><div style="font-size:12px;color:rgba(255,255,255,.65)">${sub}</div></div>
    </div>`;
  }).join("");
  suggest.classList.add("open");
  suggest.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("mousedown",(ev)=>{ // mousedown so it fires before blur
      ev.preventDefault();
      const i = +el.dataset.i;
      pickSuggest(i);
    });
  });
}

function pickSuggest(i){
  const it = suggestItems[i]; if (!it) return;
  const label = `${it.name}${it.state?", "+it.state:""}`;
  input.value = label;
  closeSuggest();
  loadWeather(it.lat, it.lon, label);
}

function closeSuggest(){ suggest.classList.remove("open"); }

input.addEventListener("input", ()=>{
  const q = input.value.trim();
  clearTimeout(debounceT);
  if (q.length < 2){ closeSuggest(); return; }
  debounceT = setTimeout(async ()=>{
    try {
      const items = await geocodeMany(q, 5);
      renderSuggest(items);
    } catch{}
  }, 220);
});

input.addEventListener("keydown",(e)=>{
  if (suggest.classList.contains("open") && suggestItems.length){
    if (e.key === "ArrowDown"){ e.preventDefault(); activeIdx = (activeIdx+1) % suggestItems.length; updateActive(); return; }
    if (e.key === "ArrowUp"){ e.preventDefault(); activeIdx = (activeIdx-1+suggestItems.length) % suggestItems.length; updateActive(); return; }
    if (e.key === "Enter"){ e.preventDefault(); if (activeIdx>=0){ pickSuggest(activeIdx); return; } }
  }
  if (e.key === "Enter"){
    e.preventDefault();
    const q = input.value.trim(); if (!q) return;
    geocodeMany(q,1).then(items=>{
      if (!items.length){ alert("City not found"); return; }
      const it = items[0];
      const label = `${it.name}${it.state?", "+it.state:""}`;
      input.value = label;
      closeSuggest();
      loadWeather(it.lat,it.lon,label);
    });
  }
  if (e.key === "Escape") closeSuggest();
});

function updateActive(){
  suggest.querySelectorAll(".item").forEach((el,i)=>{
    el.classList.toggle("active", i===activeIdx);
  });
}

input.addEventListener("blur", ()=> setTimeout(closeSuggest, 120));
input.addEventListener("focus", ()=>{ if (suggestItems.length) suggest.classList.add("open"); });
document.addEventListener("click",(e)=>{ if (!e.target.closest(".search-wrap")) closeSuggest(); });

$("locBtn").addEventListener("click", useGeo);

function useGeo(){
  if (!navigator.geolocation) return loadWeather(40.7128,-74.0060,"New York");
  navigator.geolocation.getCurrentPosition(
    async (p)=>{
      const name = await reverse(p.coords.latitude, p.coords.longitude).catch(()=>"My Location");
      loadWeather(p.coords.latitude, p.coords.longitude, name);
    },
    ()=> loadWeather(40.7128,-74.0060,"New York"),
    { timeout: 6000 }
  );
}

useGeo();
