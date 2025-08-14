<script type="module">
import { fmtYMD, parseYMD, addDays, hours, hourOptionsHTML } from "./util.js";
import { db, colEmployees, colShifts, onSnapshot, query, where, orderBy, addDoc, setDoc, deleteDoc, doc } from "./firebase.js";

const grid = document.getElementById("grid");
const label= document.getElementById("label");
const prev = document.getElementById("prev");
const next = document.getElementById("next");

const params = new URLSearchParams(location.search);
let curDate = params.get("date") || fmtYMD(new Date());

prev.addEventListener("click", ()=> { curDate = fmtYMD(addDays(parseYMD(curDate), -1)); render(); });
next.addEventListener("click", ()=> { curDate = fmtYMD(addDays(parseYMD(curDate),  1)); render(); });

let employees = [];
let shifts = [];
onSnapshot(query(colEmployees, orderBy("name","asc")), snap=>{
  employees = snap.docs.map(d=>({id:d.id, ...d.data()})); render();
});
onSnapshot(colShifts, snap=>{
  shifts = snap.docs.map(d=>({id:d.id, ...d.data()})); render();
});

const dlg = document.getElementById("dlg");
const fFrom = document.getElementById("fFrom");
const fTo   = document.getElementById("fTo");
const fNote = document.getElementById("fNote");
const fDate = document.getElementById("fDate");
const fEmpId= document.getElementById("fEmpId");
const fShiftId=document.getElementById("fShiftId");
const delBtn = document.getElementById("delBtn");
document.getElementById("dlgTitle"); // not used

fFrom.innerHTML = hourOptionsHTML(9);
fTo.innerHTML   = hourOptionsHTML(18);

function render(){
  grid.innerHTML = "";
  const d = parseYMD(curDate);
  label.textContent = `${d.getFullYear()}年 ${d.getMonth()+1}/${d.getDate()}`;

  // ヘッダ
  const head = ["従業員／時間", ...hours.map(h=> `${String(h).padStart(2,"0")}`)];
  head.forEach((t,i)=>{
    const cell = document.createElement("div");
    cell.className = "cell" + (i===0?" sticky-col":"");
    cell.innerHTML = i===0? `<strong>${t}</strong>` : `<div style="text-align:center; color:var(--muted)">${t}</div>`;
    grid.appendChild(cell);
  });

  employees.forEach(emp=>{
    // 左列
    const left = document.createElement("div");
    left.className = "cell sticky-col";
    left.textContent = emp.name;
    grid.appendChild(left);

    // 24時間セル
    hours.forEach(h=>{
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.addEventListener("click", ()=>{
        openDialog("追加", { id:null, empId:emp.id, date:curDate, fromHour:h, toHour:Math.min(h+1,24), note:"" });
      });
      grid.appendChild(cell);
    });

    // 既存シフトを帯で描画
    const my = shifts.filter(s=> s.empId===emp.id && s.date===curDate).sort((a,b)=>a.fromHour-b.fromHour);
    if(my.length){
      // 1行分をまたいで重ねるため，直近の右側セル（24個）の最初の要素にappend
      const rowStartIndex = grid.children.length - 24;
      my.forEach((s,idx)=>{
        const target = grid.children[rowStartIndex]; // 最左セルを基準に帯の幅を%指定
        const band = document.createElement("div");
        band.className = "shift";
        band.dataset.color = String(idx%3);
        const leftPct = (s.fromHour/24)*100;
        const widthPct= ((s.toHour-s.fromHour)/24)*100;
        band.style.position="absolute";
        band.style.left = `calc(${leftPct}% + 6px)`;
        band.style.width= `calc(${widthPct}% - 12px)`;
        band.style.top="8px"; band.style.minHeight="38px";
        band.innerHTML = `<span class="kbd">${String(s.fromHour).padStart(2,"0")}:00–${String(s.toHour).padStart(2,"0")}:00</span>
          ${s.note?`<span style="color:var(--muted)">｜${s.note}</span>`:""}`;
        band.addEventListener("click",(ev)=>{
          ev.stopPropagation();
          openDialog("編集", s);
        });
        target.appendChild(band);
      });
    }
  });
}

function openDialog(mode, s){
  document.getElementById("dlgTitle").textContent = `シフトを${mode}`;
  fDate.value = s.date; fEmpId.value = s.empId; fShiftId.value = s.id || "";
  fFrom.value = String(s.fromHour).padStart(2,"0");
  fTo.value   = String(s.toHour).padStart(2,"0");
  fNote.value = s.note || "";
  delBtn.style.display = s.id ? "inline-flex" : "none";
  dlg.showModal();
}

dlg.addEventListener("click",(e)=>{
  if(e.target.tagName!=="BUTTON") return;
  const v = e.target.value;
  if(v==="default") saveShift();
  else if(v==="delete") removeShift();
});

async function saveShift(){
  const item = {
    empId: fEmpId.value,
    date:  fDate.value,
    fromHour: Number(fFrom.value),
    toHour:   Number(fTo.value),
    note: fNote.value.trim()
  };
  if(item.toHour<=item.fromHour){ alert("終了は開始より後にしてください．"); return; }
  const id = fShiftId.value;
  if(id) await setDoc(doc(db,"shifts", id), item, { merge:true });
  else   await addDoc(colShifts, item);
  dlg.close();
}

async function removeShift(){
  const id = fShiftId.value;
  if(id) await deleteDoc(doc(db,"shifts", id));
  dlg.close();
}

render();
</script>
