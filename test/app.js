// ---- 追加：UUIDポリフィル（未対応ブラウザ対策） ----
if (!('randomUUID' in crypto)) {
  crypto.randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}


// ===== 設定 =====
// 'local' にすると localStorage 保存，'server' にすると PHP API 保存
const STORAGE_MODE = 'server'; // 'server'
const API_BASE_URL = 'https://monmontraining.com/shift-test/api'; // server のときだけ使用

// ===== ユーティリティ =====
const fmtYMD = (d) => d.toISOString().slice(0,10);
const parseYMD = (s) => new Date(s + 'T00:00:00');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const startOfWeekMon = (d) => { const x = new Date(d); const wd=(x.getDay()+6)%7; x.setDate(x.getDate()-wd); x.setHours(0,0,0,0); return x; };
const hours = Array.from({length:24},(_,h)=>h);
const optHTML = (sel=9)=> hours.map(h=>`<option value="${h}">${String(h).padStart(2,'0')}:00</option>`).join('');

// ===== ストレージ実装 =====
const LocalStore = (()=>{
  const KEY = 'shift-simple-v1';
  const load = ()=>{
    try{ return JSON.parse(localStorage.getItem(KEY)) || {employees:[], shifts:[]}; }
    catch(_){ return {employees:[], shifts:[]}; }
  };
  const save = (data)=> localStorage.setItem(KEY, JSON.stringify(data));
  return {
    async list(){ return load(); },
    async upsertEmployee(emp){ const db=load(); if(!emp.id) emp.id = crypto.randomUUID();
      const i=db.employees.findIndex(e=>e.id===emp.id); if(i>=0) db.employees[i]=emp; else db.employees.push(emp); save(db); return emp; },
    async deleteEmployee(id){ const db=load(); db.employees=db.employees.filter(e=>e.id!==id); db.shifts=db.shifts.filter(s=>s.empId!==id); save(db); },
    async upsertShift(s){ const db=load(); if(!s.id) s.id=crypto.randomUUID(); const i=db.shifts.findIndex(x=>x.id===s.id); if(i>=0) db.shifts[i]=s; else db.shifts.push(s); save(db); return s; },
    async deleteShift(id){ const db=load(); db.shifts=db.shifts.filter(s=>s.id!==id); save(db); }
  };
})();

const ServerStore = (()=>{
  const headers = { 'Content-Type': 'application/json' };
  const get = async (p) => (await fetch(`${API_BASE_URL}/shifts.php?action=${p}`)).json();
  const post = async (body) => (await fetch(`${API_BASE_URL}/shifts.php`, {method:'POST', headers, body: JSON.stringify(body)})).json();
  return {
    async list(){ const res = await get('list'); return res.data; },
    async upsertEmployee(emp){ const res = await post({ action:'upsert_employee', item:emp }); return res.data; },
    async deleteEmployee(id){ await post({ action:'delete_employee', id }); },
    async upsertShift(s){ const res = await post({ action:'upsert_shift', item:s }); return res.data; },
    async deleteShift(id){ await post({ action:'delete_shift', id }); }
  };
})();

const Store = STORAGE_MODE==='server' ? ServerStore : LocalStore;

// ===== 状態 =====
let employees = []; let shifts = []; let weekAnchor = fmtYMD(startOfWeekMon(new Date()));

// ===== DOM =====
const weekLabel = document.getElementById('weekLabel');
const storageModeBadge = document.getElementById('storageModeBadge');
const grid = document.getElementById('grid');
const prevWeekBtn = document.getElementById('prevWeek');
const nextWeekBtn = document.getElementById('nextWeek');
const empForm = document.getElementById('addEmployeeForm');
const empName = document.getElementById('empName');
const empList = document.getElementById('employeeList');
const rowTpl = document.getElementById('rowTemplate');
const dlg = document.getElementById('shiftDialog');
const dlgTitle = document.getElementById('dialogTitle');
const fDate = document.getElementById('shiftDate');
const fFrom = document.getElementById('shiftFrom');
const fTo   = document.getElementById('shiftTo');
const fNote = document.getElementById('shiftNote');
const fEmpId= document.getElementById('shiftEmpId');
const fShiftId=document.getElementById('shiftId');
const delBtn = document.getElementById('deleteShiftBtn');

fFrom.innerHTML = optHTML(9); fTo.innerHTML = optHTML(18);
storageModeBadge.textContent = STORAGE_MODE==='server' ? '保存先：サーバ（JSON）' : '保存先：この端末（localStorage）';

prevWeekBtn.addEventListener('click', ()=>{ weekAnchor = fmtYMD(addDays(parseYMD(weekAnchor), -7)); render(); });
nextWeekBtn.addEventListener('click', ()=>{ weekAnchor = fmtYMD(addDays(parseYMD(weekAnchor),  7)); render(); });

empForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = empName.value.trim(); if(!name) return;
  await Store.upsertEmployee({ name });
  empName.value=''; empName.focus();
  await load(); render();
});

async function load(){ const data = await Store.list(); employees = data.employees||[]; shifts = data.shifts||[]; }

// ---- 追加：従業員リスト再描画 ----
function renderEmployeeList(){
  empList.innerHTML = '';
  employees.forEach(emp => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${emp.name}</span>
      <button class="emp-del" data-id="${emp.id}">×</button>
    `;
    li.querySelector('.emp-del').addEventListener('click', async () => {
      if(!confirm(`${emp.name} を削除しますか？`)) return;
      await Store.deleteEmployee(emp.id);
      await load(); render();
    });
    empList.appendChild(li);
  });
}


function render(){
  // ヘッダ
  const anchor = parseYMD(weekAnchor); const days = Array.from({length:7},(_,i)=> addDays(anchor,i));
  weekLabel.textContent = `${anchor.getFullYear()}年 ${anchor.getMonth()+1}/${anchor.getDate()} 〜 ${days[6].getMonth()+1}/${days[6].getDate()}`;
  grid.innerHTML = '';
  // ヘッダ行
  const headerRow = document.createElement('div'); headerRow.className='header'; headerRow.style.display='contents';
  const head0 = document.createElement('div'); head0.className='cell sticky'; head0.innerHTML = '<strong>従業員／日付</strong>';
  grid.appendChild(head0);
  days.forEach(d=>{ const c=document.createElement('div'); c.className='cell'; c.innerHTML = `<div style="text-align:center;color:var(--muted)">${d.getMonth()+1}/${d.getDate()}</div>`; grid.appendChild(c); });

  // 行
  employees.forEach(emp=>{
    const left = document.createElement('div'); left.className='cell sticky'; left.innerHTML = `<span class="emp-name">${emp.name}</span> <button class="emp-del">×</button>`;
    left.querySelector('.emp-del').addEventListener('click', async ()=>{
      if(!confirm(`${emp.name} を削除しますか？`)) return; await Store.deleteEmployee(emp.id); await load(); render();
    });
    grid.appendChild(left);

    days.forEach(d=>{
      const cell=document.createElement('div'); cell.className='cell'; const ymd=fmtYMD(d);
      const items = shifts.filter(s=> s.empId===emp.id && s.date===ymd).sort((a,b)=>a.fromHour-b.fromHour);
      items.forEach((s,idx)=>{
        const chip=document.createElement('div'); chip.className='shift'; chip.dataset.color=String(idx%3);
        chip.style.top = 6 + idx*44 + 'px';
        chip.innerHTML = `<span>${String(s.fromHour).padStart(2,'0')}:00–${String(s.toHour).padStart(2,'0')}:00</span> ${s.note?`<span style="color:var(--muted)">｜${s.note}</span>`:''}`;
        chip.addEventListener('click', (ev)=>{ ev.stopPropagation(); openDialog('編集', s); });
        cell.appendChild(chip);
      });
      cell.addEventListener('click', ()=> openDialog('追加', { id:null, empId:emp.id, date:ymd, fromHour:9, toHour:18, note:'' }));
      grid.appendChild(cell);
    });
  });

  renderEmployeeList();   // ← これを最後に呼ぶ
}

function openDialog(mode, s){
  dlgTitle.textContent = `シフトを${mode}`;
  fDate.value = s.date; fEmpId.value = s.empId; fShiftId.value = s.id || '';
  fFrom.value = s.fromHour; fTo.value = s.toHour; fNote.value = s.note || '';
  delBtn.style.display = s.id ? 'inline-flex' : 'none'; dlg.showModal();
}

document.getElementById('shiftForm').addEventListener('click', async (e)=>{
  if(e.target.tagName!== 'BUTTON') return; const v=e.target.value;
  if(v==='default'){
    const item = { id:fShiftId.value||null, empId:fEmpId.value, date:fDate.value, fromHour:Number(fFrom.value), toHour:Number(fTo.value), note:fNote.value.trim() };
    if(item.toHour<=item.fromHour){ alert('終了は開始より後にしてください．'); return; }
    await Store.upsertShift(item); await load(); render(); dlg.close();
  }else if(v==='delete'){
    if(fShiftId.value){ await Store.deleteShift(fShiftId.value); await load(); render(); }
    dlg.close();
  }else if(v==='cancel'){ dlg.close(); }
});

// 初期化
(async()=>{ await load(); render(); })();