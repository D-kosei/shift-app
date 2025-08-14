<script type="module">
import { fmtYMD, parseYMD, addDays, startOfWeekMon, hourOptionsHTML } from "./util.js";
import { db, colEmployees, colShifts, onSnapshot, query, where, orderBy, addDoc, setDoc, deleteDoc, doc } from "./firebase.js";

const label = document.getElementById("label");
const grid  = document.getElementById("grid");
const prev  = document.getElementById("prev");
const next  = document.getElementById("next");

const addEmpForm = document.getElementById("addEmpForm");
const empName = document.getElementById("empName");
const empList = document.getElementById("empList");

const dlg = document.getElementById("dlg");
const dlgTitle = document.getElementById("dlgTitle");
const fDate = document.getElementById("fDate");
const fFrom = document.getElementById("fFrom");
const fTo   = document.getElementById("fTo");
const fNote = document.getElementById("fNote");
const fEmpId= document.getElementById("fEmpId");
const fShiftId = document.getElementById("fShiftId");
const delBtn = document.getElementById("delBtn");

// 1時間単位セレクト
fFrom.innerHTML = hourOptionsHTML(9);
fTo.innerHTML   = hourOptionsHTML(18);

// 週アンカー（日付はlocalStorageに保持）
const KEY = "shift-week-anchor";
let weekAnchor = localStorage.getItem(KEY) || fmtYMD(startOfWeekMon(new Date()));

function setWeekAnchor(ymd){ weekAnchor = ymd; localStorage.setItem(KEY, ymd); render(); }

prev.addEventListener("click", ()=> setWeekAnchor(fmtYMD(addDays(parseYMD(weekAnchor), -7))));
next.addEventListener("click", ()=> setWeekAnchor(fmtYMD(addDays(parseYMD(weekAnchor),  7))));

// --- Firestore購読 ---
let employees = [];
let shifts = [];
onSnapshot(query(colEmployees, orderBy("name","asc")), snap=>{
  employees = snap.docs.map(d=>({id:d.id, ...d.data()}));
  render();
});
onSnapshot(colShifts, snap=>{
  shifts = snap.docs.map(d=>({id:d.id, ...d.data()}));
  render();
});

// 従業員追加
addEmpForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name = empName.value.trim();
  if(!name) return;
  await addDoc(colEmployees, { name, createdAt: Date.now() });
  empName.value = "";
});

// 従業員リスト
function renderEmpList(){
  empList.innerHTML = "";
  employees.forEach(emp=>{
    const li = document.createElement("li");
    li.innerHTML = `<span>${emp.name}</span>
      <button class="btn" data-del="${emp.id}" title="削除">×</button>`;
    li.querySelector("[data-del]").addEventListener("click", async ()=>{
      if(!confirm(`${emp.name} を削除しますか？`)) return;
      // その人のシフトも削除
      const my = shifts.filter(s=>s.empId===emp.id);
      await Promise.all(my.map(s=> deleteDoc(doc(db,"shifts", s.id))));
      await deleteDoc(doc(db,"employees", emp.id));
    });
    empList.appendChild(li);
  });
}

// 画面描画（週グリッド）
function render(){
  renderEmpList();
  const anchor = parseYMD(weekAnchor);
  const days = Array.from({length:7},(_,i)=> addDays(anchor,i));
  const head = ["従業員／日付", ...days.map(d=>`${d.getMonth()+1}/${d.getDate()}`)];
  label.textContent = `${anchor.getFullYear()}年 ${anchor.getMonth()+1}/${anchor.getDate()} 〜 ${days[6].getMonth()+1}/${days[6].getDate()}`;

  // ヘッダ
  grid.innerHTML = "";
  head.forEach((t,i)=>{
    const h = document.createElement("div");
    h.className = "cell" + (i===0 ? " sticky-col" : "");
    h.innerHTML = i===0 ? `<strong>${t}</strong>` : `<div style="text-align:center; color:var(--muted)">${t}</div>`;
    grid.appendChild(h);
  });

  // 行
  employees.forEach(emp=>{
    // 左固定列
    const left = document.createElement("div");
    left.className = "cell sticky-col";
    left.textContent = emp.name;
    grid.appendChild(left);

    // 7日セル
    days.forEach(d=>{
      const cell = document.createElement("div");
      cell.className = "cell";
      const ymd = fmtYMD(d);

      const items = shifts
        .filter(s=> s.empId===emp.id && s.date===ymd)
        .sort((a,b)=> a.fromHour - b.fromHour);

      // 既存表示
      items.forEach((s,idx)=>{
        const chip = document.createElement("div");
        chip.className = "shift";
        chip.dataset.color = String(idx%3);
        chip.style.top = 6 + idx*46 + "px";
        chip.innerHTML = `<span class="kbd">${String(s.fromHour).padStart(2,"0")}:00–${String(s.toHour).padStart(2,"0")}:00</span>
          ${s.note?`<span style="color:var(--muted)">｜${s.note}</span>`:""}`;
        chip.addEventListener("click",(ev)=>{
          ev.stopPropagation();
          openDialog("編集", { id:s.id, empId:s.empId, date:s.date, fromHour:s.fromHour, toHour:s.toHour, note:s.note||"" });
        });
        cell.appendChild(chip);
      });

      // クリックで追加
      cell.addEventListener("click", ()=>{
        openDialog("追加", { id:null, empId:emp.id, date:ymd, fromHour:9, toHour:18, note:"" });
      });

      grid.appendChild(cell);
    });
  });
}

// ダイアログ
function openDialog(mode, s){
  dlgTitle.textContent = `シフトを${mode}`;
  fDate.value = s.date; fEmpId.value = s.empId; fShiftId.value = s.id || "";
  fFrom.value = String(s.fromHour).padStart(2,"0");
  fTo.value   = String(s.toHour).padStart(2,"0");
  fNote.value = s.note || "";
  delBtn.style.display = s.id ? "inline-flex" : "none";
  dlg.showModal();
}

dlg.addEventListener("close", ()=>{});
dlg.addEventListener("click",(e)=>{
  if(e.target.tagName!=="BUTTON") return;
  const val = e.target.value;
  if(val==="default"){ saveShift(); }
  else if(val==="delete"){ removeShift(); }
});

async function saveShift(){
  const item = {
    empId: fEmpId.value,
    date: fDate.value,
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
