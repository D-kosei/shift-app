<script type="module">
export const fmtYMD = (d) => d.toISOString().slice(0,10);
export const parseYMD = (s) => new Date(s + "T00:00:00");
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
export const startOfWeekMon = (d) => { const x = new Date(d); const wd=(x.getDay()+6)%7; x.setDate(x.getDate()-wd); x.setHours(0,0,0,0); return x; };
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth   = (d) => new Date(d.getFullYear(), d.getMonth()+1, 0);
export const ymd = (y,m,d) => `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
export const hours = Array.from({length:24},(_,h)=>h);

export function hourOptionsHTML(selected=9){
  return hours.map(h=>{
    const v = String(h).padStart(2,"0");
    return `<option value="${v}" ${Number(v)===Number(selected)?"selected":""}>${v}:00</option>`;
  }).join("");
}
</script>
