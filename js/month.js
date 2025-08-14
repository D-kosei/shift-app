<script type="module">
import { fmtYMD, startOfMonth, endOfMonth, addDays } from "./util.js";
import { onSnapshot, colShifts } from "./firebase.js";

const grid = document.getElementById("grid");
const label = document.getElementById("label");
const prev = document.getElementById("prev");
const next = document.getElementById("next");

let anchor = startOfMonth(new Date());
function setMonth(d){ anchor = startOfMonth(d); render(); }

prev.addEventListener("click", ()=> setMonth(new Date(anchor.getFullYear(), anchor.getMonth()-1, 1)));
next.addEventListener("click", ()=> setMonth(new Date(anchor.getFullYear(), anchor.getMonth()+1, 1)));

let shifts = [];
onSnapshot(colShifts, snap=>{
  shifts = snap.docs.map(d=>({id:d.id, ...d.data()}));
  render();
});

function render(){
  grid.innerHTML = "";
  const first = startOfMonth(anchor);
  const last  = endOfMonth(anchor);
  label.textContent = `${first.getFullYear()}年 ${first.getMonth()+1}月`;

  // 週の開始（日〜土でなく，月〜日の6列に合わせたい場合は調整可）
  const start = new Date(first);
  start.setDate(1 - ((first.getDay()+6)%7)); // 月曜始まりで前月ぶんを前詰め
  const total = 42; // 6週間表示

  // 曜日ヘッダ
  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(w=>{
    const h = document.createElement("div");
    h.className="cell";
    h.innerHTML = `<div style="text-align:center; color:var(--muted)">${w}</div>`;
    grid.appendChild(h);
  });

  for(let i=0;i<total;i++){
    const d = addDays(start, i);
    const inMonth = d.getMonth()===anchor.getMonth();
    const ymd = fmtYMD(d);

    const cell = document.createElement("div");
    cell.className="cell";
    cell.style.background = inMonth ? "transparent" : "#0c1018";

    const dayShifts = shifts.filter(s=> s.date===ymd);
    const cnt = dayShifts.length;
    cell.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center">
      <strong>${d.getDate()}</strong>
      <span class="badge">${cnt}件</span>
    </div>
    <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px; max-height:100px; overflow:auto;">
      ${dayShifts.slice(0,3).map(s=>`<div class="kbd">${String(s.fromHour).padStart(2,"0")}-${String(s.toHour).padStart(2,"0")}｜${s.note? s.note:""}</div>`).join("")}
      ${cnt>3? `<div style="color:var(--muted)">…他${cnt-3}件</div>`:""}
    </div>`;

    cell.addEventListener("click", ()=>{
      // 日表示へ遷移（クエリに日付を付与）
      location.href = `day.html?date=${ymd}`;
    });

    grid.appendChild(cell);
  }
}
render();
</script>
