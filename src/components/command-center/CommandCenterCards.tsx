'use client';

import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import NewsCard from '@/components/command-center/NewsCard';
import Modal from '@/components/Modal';
import { formatEasternMonthDay } from '@/lib/dates';

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n)); }
function billAmountLabel(bill: { amount?: number | null; amount_type?: string | null; auto_amount?: boolean }): string {
  const type = String(bill.amount_type || '').toLowerCase();
  const amount = typeof bill.amount === 'number' ? bill.amount : Number(bill.amount);
  if (bill.auto_amount && amount > 0) return fmt(amount);
  if (type.startsWith('var') || !amount) return type === 'payroll' ? 'Payroll' : 'Varies';
  return fmt(amount);
}
function readCcFinance(): {cf:{income:number;expenses:number;net:number}|null;bills:any[]}|null {
  try {
    const raw=localStorage.getItem('cc_finance_v3');
    if(!raw) return null;
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||!Array.isArray(parsed.bills)) return null;
    if(parsed.cf!=null && (!Number.isFinite(parsed.cf.income)||!Number.isFinite(parsed.cf.expenses)||!Number.isFinite(parsed.cf.net))) return null;
    if(!parsed.bills.every((b:any)=>b&&typeof b.name==='string'&&Number.isFinite(Number(b.amount)))) return null;
    return parsed;
  } catch { return null; }
}
function getGreeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function formatDay() { return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function today() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }); }
function daysUntil(d: string | null | undefined): number | null { if (!d) return null; const now = new Date(); now.setHours(0,0,0,0); return Math.round((new Date(d+'T00:00:00').getTime()-now.getTime())/86400000); }
function dueDateColor(days: number | null): string { if (days===null) return '#555'; if (days<0) return '#ef4444'; if (days<=14) return '#f0a050'; if (days<=30) return '#f59e0b'; return '#22c55e'; }
function fmtShort(d: string) { return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); }

function weatherIcon(code: number, hour: number): string {
  const c = Number(code); const isDay = hour>=6&&hour<20;
  if (c===113) return isDay?'☀️':'🌙';
  if (c===116) return isDay?'⛅':'☁️';
  if ([119,122].includes(c)) return '☁️';
  if ([143,248,260].includes(c)) return '🌫️';
  if ([176,263,266,293,296,353].includes(c)) return '🌦️';
  if ([185,281,284,299,302,305,308,311,314,356,359].includes(c)) return '🌧️';
  if ([200,386,389,392,395].includes(c)) return '⛈️';
  if ([227,230,323,326,329,332,335,338,350,362,365,368,371,374,377].includes(c)) return '🌨️';
  return isDay?'⛅':'🌙';
}

// ─── Activity Rings ───────────────────────────────────────────────────────────

function ActivityRings({ calories, minutes, standHours }: { calories:number; minutes:number; standHours:number }) {
  const rings=[{r:48,value:calories,goal:500,color:'#ef4444'},{r:34,value:minutes,goal:30,color:'#22c55e'},{r:20,value:standHours,goal:12,color:'#60a5fa'}];
  return (
    <svg width={110} height={110} viewBox="0 0 110 110" className="flex-shrink-0">
      {rings.map(({r,value,goal,color})=>{
        const circ=2*Math.PI*r; const pct=Math.min(Math.max(value/goal,0),1);
        return (<g key={r}><circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={9} opacity={0.15}/>{value>0&&<circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={9} strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ*(1-pct)} strokeLinecap="round" transform="rotate(-90 55 55)"/>}</g>);
      })}
    </svg>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({children}: {children: React.ReactNode}) {
  return <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest px-1 pt-1">{children}</p>;
}

// ─── Mini Modal Shell ─────────────────────────────────────────────────────────

function MiniModal({ title, onClose, onSave, saving, children, error }: { title:string; onClose:()=>void; onSave:()=>void; saving:boolean; children:React.ReactNode; error?:string }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      headerRight={
        <button type="button" onClick={onSave} disabled={saving} className="text-base font-semibold text-[#f0a050] disabled:opacity-40">{saving?'Saving…':'Save'}</button>
      }
    >
      <div className="space-y-3">{children}{error&&<p className="text-[#ef4444] text-xs px-1 font-mono">{error}</p>}</div>
    </Modal>
  );
}

function ModalRow({label, children}: {label:string; children:React.ReactNode}) {
  return (
    <div className="flex items-center px-4 py-3 border-b border-white/10 last:border-0">
      <span className="text-sm text-[#888] w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function ModalInput({value, onChange, type='text', placeholder=''}: {value:string; onChange:(v:string)=>void; type?:string; placeholder?:string}) {
  return <input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} className="bg-transparent text-sm text-white text-right outline-none placeholder-[#444] w-full"/>;
}

function ModalSelect({value, onChange, options}: {value:string; onChange:(v:string)=>void; options:string[]}) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} className="bg-transparent text-sm text-white text-right outline-none appearance-none bg-[#2c2c2e] w-full">
      <option value="" className="bg-[#2c2c2e]">Select…</option>
      {options.map(o=><option key={o} value={o} className="bg-[#2c2c2e]">{o}</option>)}
    </select>
  );
}

// ─── Quick Fuel Modal ─────────────────────────────────────────────────────────

function FuelModal({onClose, onSaved}: {onClose:()=>void; onSaved:()=>void}) {
  const [form,setForm]=useState({date:today(),gallons:'',price_per_gallon:'',total_cost:'',odometer:'',station:''});
  const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  function set(k:string,v:string){setForm(f=>({...f,[k]:v}));}

  useEffect(()=>{
    if(!form.gallons||!form.price_per_gallon) return;
    const total=parseFloat(form.gallons)*parseFloat(form.price_per_gallon);
    if(!isNaN(total)) setForm(f=>({...f,total_cost:total.toFixed(2)}));
  },[form.gallons,form.price_per_gallon]);

  async function handleSave(){
    setError('');
    if(!form.gallons||!form.total_cost){setError('Gallons and total are required');return;}
    setSaving(true);
    try {
      const res=await fetch('/api/vehicle/fuel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        date:form.date,
        gallons:parseFloat(form.gallons),
        price_per_gallon:form.price_per_gallon?parseFloat(form.price_per_gallon):null,
        total_cost:parseFloat(form.total_cost),
        odometer:form.odometer?parseInt(form.odometer):null,
        station:form.station||null,
      })});
      if(!res.ok){const d=await res.json();throw new Error(d.error||'Failed');}
      onSaved(); onClose();
    } catch(e:any){setError(e.message);}
    finally{setSaving(false);}
  }
  return (
    <MiniModal title="Log Fuel" onClose={onClose} onSave={handleSave} saving={saving} error={error}>
      <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
        <ModalRow label="Date"><ModalInput type="date" value={form.date} onChange={v=>set('date',v)}/></ModalRow>
        <ModalRow label="Gallons"><ModalInput type="number" value={form.gallons} onChange={v=>set('gallons',v)} placeholder="0.000"/></ModalRow>
        <ModalRow label="Price/gal ($)"><ModalInput type="number" value={form.price_per_gallon} onChange={v=>set('price_per_gallon',v)} placeholder="3.499"/></ModalRow>
        <ModalRow label="Total ($)"><ModalInput type="number" value={form.total_cost} onChange={v=>set('total_cost',v)} placeholder="Auto-calc"/></ModalRow>
        <ModalRow label="Odometer"><ModalInput type="number" value={form.odometer} onChange={v=>set('odometer',v)} placeholder="Optional"/></ModalRow>
        <ModalRow label="Station"><ModalInput value={form.station} onChange={v=>set('station',v)} placeholder="Optional"/></ModalRow>
      </div>
    </MiniModal>
  );
}

// ─── Health Card ──────────────────────────────────────────────────────────────

function HealthCard({ refreshCount }: { refreshCount: number }) {
  const [data,setData]=useState<any>(null);
  useEffect(()=>{
    try{const c=localStorage.getItem('cc_health_v1');if(c)setData(JSON.parse(c));}catch{}
    fetch('/api/health/latest').then(r=>r.json()).then(d=>{setData(d.log||null);try{localStorage.setItem('cc_health_v1',JSON.stringify(d.log||null));}catch{}}).catch(()=>{});
  },[refreshCount]);
  const steps=data?.steps??0;
  const cal=data?.active_calories??0;
  const active=data?.exercise_minutes??data?.activity_minutes??0;
  const stand=data?.stand_hours??0;
  const hr=Math.round(parseFloat(String(data?.heart_rate_avg??data?.resting_heart_rate??0)));
  const stepPct=Math.min((steps/10000)*100,100);
  const dateStr=data?.log_date?new Date(data.log_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
  return (
    <div onClick={()=>{window.location.href='/health';}} className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><span className="text-sm">❤️</span><span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Today's Activity</span></div>
        {dateStr&&<span className="text-[9px] text-[#333] bg-[#1a1a1a] px-2 py-0.5 rounded-full">{dateStr}</span>}
      </div>
      <div className="flex items-center gap-4">
        <ActivityRings calories={cal} minutes={active} standHours={stand}/>
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-3 gap-1 mb-3">
            {[{val:cal>0?cal.toLocaleString():'—',unit:'cal',label:'Move',color:'#ef4444'},{val:active>0?`${active}`:'—',unit:'min',label:'Exercise',color:'#22c55e'},{val:stand>0?`${stand}`:'—',unit:'hrs',label:'Stand',color:'#60a5fa'}].map(({val,unit,label,color})=>(
              <div key={label} className="text-center">
                <p className="text-base font-extrabold leading-none" style={{color}}>{val}</p>
                <p className="text-[8px] text-[#444] mt-0.5">{unit}</p>
                <p className="text-[8px] text-[#333] uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between mb-1"><span className="text-[9px] text-[#555]">{steps>0?steps.toLocaleString():'—'} steps</span><span className="text-[9px] text-[#333]">10k</span></div>
            <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden"><div className="h-full bg-[#60a5fa] rounded-full" style={{width:`${stepPct}%`}}/></div>
          </div>
          {hr>0&&<div className="flex items-center gap-1 mt-2"><span className="text-[#f87171] text-xs">♥</span><span className="text-sm font-bold text-[#888] font-mono">{hr}</span><span className="text-[9px] text-[#444]">BPM</span></div>}
        </div>
      </div>
    </div>
  );
}

// ─── Finance Row ──────────────────────────────────────────────────────────────

function FinanceRow({ refreshCount }: { refreshCount: number }) {
  const [cf,setCf]=useState<any>(null); const [bills,setBills]=useState<any[]>([]);
  useEffect(()=>{
    const cached=readCcFinance();
    if(cached){setCf(cached.cf);setBills(cached.bills);}
    else{try{localStorage.removeItem('cc_finance_v2');localStorage.removeItem('cc_finance_v3');}catch{}}
    Promise.all([fetch('/api/finance/cash-flow').then(r=>r.json()),fetch('/api/finance/bills').then(r=>r.json())]).then(([cfData,blData])=>{
      const ym=new Date().toLocaleDateString('sv-SE',{timeZone:'America/New_York'}).slice(0,7);
      const cur=cfData.months?.find((m:any)=>m.rawHeader===ym);
      const newCf=cur&&Number.isFinite(cur.income)&&Number.isFinite(cur.net)?{income:cur.income,expenses:(cur.essentials||0)+(cur.discretionary||0),net:cur.net}:null;
      const newBills=(Array.isArray(blData.bills)?blData.bills:[]).filter((b:any)=>b&&typeof b.name==='string'&&Number.isFinite(Number(b.amount)));
      setCf(newCf);setBills(newBills);
      try{localStorage.setItem('cc_finance_v3',JSON.stringify({cf:newCf,bills:newBills}));}catch{}
    }).catch(()=>{});
  },[refreshCount]);
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/New_York'});
  const [y,m,d]=today.split('-').map(Number);
  const endUtc=new Date(Date.UTC(y,m-1,d+7));
  const in7=`${endUtc.getUTCFullYear()}-${String(endUtc.getUTCMonth()+1).padStart(2,'0')}-${String(endUtc.getUTCDate()).padStart(2,'0')}`;
  const dueSoon=bills.filter(b=>b.due_date&&b.due_date>=today&&b.due_date<=in7);
  const dueTotal=dueSoon.reduce((s,b)=>s+Math.abs(b.amount||0),0);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div onClick={()=>{window.location.href='/finance?tab=budget';}} className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 active:opacity-70 transition-opacity cursor-pointer">
        <div className="text-[9px] font-semibold text-[#444] uppercase tracking-widest mb-2">Cash Flow</div>
        {cf?(<div className="space-y-1.5">{[{label:'Income',val:cf.income,color:'text-[#22c55e]'},{label:'Expenses',val:cf.expenses,color:'text-[#ef4444]'},{label:'Net',val:cf.net,color:cf.net>=0?'text-[#22c55e]':'text-[#ef4444]'}].map(({label,val,color})=>(<div key={label}><div className="flex justify-between items-center"><span className="text-[10px] text-[#555]">{label}</span><span className={`text-[11px] font-bold font-mono ${color}`}>{fmt(val)}</span></div>{label!=='Net'&&<div className="h-px bg-[#1a1a1a] mt-1.5"/>}</div>))}</div>):(<div className="text-[10px] text-[#333] pt-1">Syncing…</div>)}
      </div>
      <div onClick={()=>{window.location.href='/finance?tab=bills';}} className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 active:opacity-70 transition-opacity cursor-pointer">
        <div className="text-[9px] font-semibold text-[#444] uppercase tracking-widest mb-2">Bills Due</div>
        <div className="text-[18px] font-extrabold text-[#f0a050] leading-none mb-1 font-display">{fmt(dueTotal)}</div>
        <div className="text-[9px] text-[#444] mb-2">{dueSoon.length} bills · 7 days</div>
        <div className="space-y-1">{dueSoon.slice(0,3).map((b,i)=>(<div key={i} className="flex justify-between items-start gap-1"><span className="text-[9px] text-[#555] truncate">{b.name}</span><span className="text-right ml-1 flex-shrink-0"><span className="block text-[9px] text-[#444] font-mono">{billAmountLabel(b)}</span>{b.auto_amount&&b.auto_updated?<span className="block text-[8px] text-[#333] leading-tight whitespace-nowrap">auto · updated {formatEasternMonthDay(b.auto_updated)}</span>:null}</span></div>))}{dueSoon.length>3&&<div className="text-[9px] text-[#f0a050]">+{dueSoon.length-3} more</div>}</div>
      </div>
    </div>
  );
}

// ─── Investments Card ─────────────────────────────────────────────────────────

function InvestmentsCard({ refreshCount }: { refreshCount: number }) {
  const [data,setData]=useState<any>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    try{localStorage.removeItem('cc_investments_v1');const c=localStorage.getItem('cc_investments_v2');if(c){setData(JSON.parse(c));setLoading(false);}}catch{}
    fetch('/api/cc/investments').then(r=>r.json()).then(d=>{setData(d);setLoading(false);try{localStorage.setItem('cc_investments_v2',JSON.stringify(d));}catch{}}).catch(()=>setLoading(false));
  },[refreshCount]);
  const totalValue=data?.totalValue??0; const dailyChange=data?.dailyChange??null; const dailyChangePct=data?.dailyChangePct??null; const totalGain=data?.totalGain??null; const totalGainPct=data?.totalGainPct??null; const accounts:any[]=data?.accounts??[]; const hasPrices=data?.hasPrices??false;
  return (
    <div onClick={()=>{window.location.href='/investments';}} className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><span className="text-sm">📈</span><span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Investments</span></div>
        {hasPrices&&dailyChange!==null&&<span className={`text-[10px] font-semibold font-mono ${dailyChange>=0?'text-[#22c55e]':'text-[#ef4444]'}`}>{dailyChange>=0?'+':''}{fmt(dailyChange)} today</span>}
      </div>
      <p className="text-[28px] font-extrabold text-white font-mono leading-none mb-1" style={{fontFamily:"'Syne',sans-serif"}}>{loading?'—':totalValue>0?fmt(totalValue):'—'}</p>
      <div className="flex items-center gap-3 mb-3">
        {hasPrices&&dailyChangePct!==null&&<span className={`text-[10px] font-semibold ${dailyChangePct>=0?'text-[#22c55e]':'text-[#ef4444]'}`}>{dailyChangePct>=0?'+':''}{Number(dailyChangePct).toFixed(2)}% today</span>}
        {totalGain!==null&&<span className="text-[10px] text-[#555]">{totalGain>=0?'+':''}{fmt(totalGain)} total{totalGainPct!==null?` (${Number(totalGainPct).toFixed(1)}%)`:'}'}</span>}
      </div>
      {accounts.length>0&&<div className="border-t border-[#1a1a1a] pt-3 space-y-1.5">{accounts.map(a=>(<div key={a.name} className="flex justify-between items-center"><span className="text-[10px] text-[#555]">{a.name}</span><span className="text-[10px] font-semibold font-mono text-[#888]">{fmt(a.value)}</span></div>))}</div>}
    </div>
  );
}

// ─── Calendar Card ────────────────────────────────────────────────────────────

function CalendarCard({ refreshCount }: { refreshCount: number }) {
  const [events,setEvents]=useState<any[]>([]);
  useEffect(()=>{
    try{const c=localStorage.getItem('cc_calendar_v1');if(c)setEvents(JSON.parse(c));}catch{}
    fetch('/api/calendar/events?days=7').then(r=>r.json()).then(d=>{const e=(d.events||[]).slice(0,5);setEvents(e);try{localStorage.setItem('cc_calendar_v1',JSON.stringify(e));}catch{}}).catch(()=>{});
  },[refreshCount]);
  function fmtEvt(e:any){const d=new Date(e.start),now=new Date();now.setHours(0,0,0,0);const diff=Math.floor((d.getTime()-now.getTime())/86400000);const pre=diff===0?'Today':diff===1?'Tomorrow':d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});return e.allDay?pre:`${pre} · ${d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`;}
  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] overflow-hidden">
      <div onClick={()=>{window.location.href='/calendar';}} className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] active:bg-[#161616] cursor-pointer"><div className="flex items-center gap-2"><span className="text-sm">📅</span><span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Calendar</span></div><span className="text-[9px] text-[#f0a050]">7 days →</span></div>
      {events.length===0?<div className="px-4 py-4 text-[11px] text-[#333]">No upcoming events</div>:<div className="divide-y divide-[#141414]">{events.map((e,i)=>(<div key={i} className="flex items-center px-4 py-2.5 gap-3"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:e.color||'#818cf8'}}/><div className="flex-1 min-w-0"><div className="text-[12px] font-medium text-[#ccc] truncate">{e.title}</div><div className="text-[9px] text-[#444] mt-0.5">{fmtEvt(e)}</div></div></div>))}</div>}
    </div>
  );
}

// ─── Tasks Card ───────────────────────────────────────────────────────────────

function TasksCard({ refreshCount }: { refreshCount: number }) {
  const [tasks,setTasks]=useState<any[]>([]);
  useEffect(()=>{
    try{const c=localStorage.getItem('cc_tasks_v1');if(c)setTasks(JSON.parse(c));}catch{}
    fetch('/api/tasks/lists').then(r=>r.json()).then(async d=>{const lists=d.lists||[];if(!lists.length)return;const preferred=lists.find((l:any)=>l.title==='Personal OS');const listId=(preferred||lists[0]).id;const res=await fetch(`/api/tasks/items?listId=${listId}&showCompleted=false`);const data=await res.json();const t=(data.tasks||[]).slice(0,4);setTasks(t);try{localStorage.setItem('cc_tasks_v1',JSON.stringify(t));}catch{}}).catch(()=>{});
  },[refreshCount]);
  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] overflow-hidden">
      <div onClick={()=>{window.location.href='/tasks';}} className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] active:bg-[#161616] cursor-pointer"><div className="flex items-center gap-2"><span className="text-sm">☑</span><span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Tasks</span></div><span className="text-[9px] text-[#f0a050]">{tasks.length} pending →</span></div>
      {tasks.length===0?<div className="px-4 py-4 text-[11px] text-[#333]">No pending tasks</div>:<div className="divide-y divide-[#141414]">{tasks.map((t,i)=>(<div key={i} className="flex items-center px-4 py-2.5 gap-3"><div className="w-4 h-4 rounded-full border border-[#2a2a2a] flex-shrink-0"/><span className="text-[11px] text-[#888] truncate">{t.title}</span></div>))}</div>}
    </div>
  );
}

// ─── Vehicle Card ─────────────────────────────────────────────────────────────

function VehicleCard({ refreshCount }: { refreshCount: number }) {
  const [vehicle,setVehicle]=useState<any>(null); const [lastService,setLastService]=useState<any>(null);
  useEffect(()=>{
    try{const c=localStorage.getItem('cc_vehicle_v1');if(c){const p=JSON.parse(c);setVehicle(p.v);setLastService(p.s);}}catch{}
    Promise.all([fetch('/api/vehicle/info').then(r=>r.json()).catch(()=>({})),fetch('/api/vehicle/maintenance').then(r=>r.json()).catch(()=>({}))]).then(([info,maint])=>{const v=info.vehicle||info||null;const records:any[]=maint.records||maint.maintenance||maint||[];const s=[...records].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())[0]||null;setVehicle(v);setLastService(s);try{localStorage.setItem('cc_vehicle_v1',JSON.stringify({v,s}));}catch{}});
  },[refreshCount]);
  function dLabel(d:string|null|undefined):string{const days=daysUntil(d??null);if(!d||days===null)return'—';if(days<0)return`Overdue ${Math.abs(days)}d`;if(days===0)return'Today';if(days<=90)return`${days} days`;return fmtShort(d);}
  return (
    <div onClick={()=>{window.location.href='/vehicle';}} className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center gap-2 mb-3"><span className="text-sm">🚗</span><span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Vehicle</span>{vehicle?.year&&<span className="text-[10px] text-[#333] ml-auto">{vehicle.year} {vehicle.make} {vehicle.model}</span>}</div>
      <div className="space-y-2">
        <div className="flex justify-between items-center"><span className="text-[11px] text-[#555]">Inspection</span><span className="text-[11px] font-bold font-mono" style={{color:dueDateColor(daysUntil(vehicle?.inspection_expires))}}>{dLabel(vehicle?.inspection_expires)}</span></div>
        <div className="h-px bg-[#141414]"/>
        <div className="flex justify-between items-center"><span className="text-[11px] text-[#555]">Registration</span><span className="text-[11px] font-bold font-mono" style={{color:dueDateColor(daysUntil(vehicle?.registration_expires))}}>{dLabel(vehicle?.registration_expires)}</span></div>
        {lastService&&<><div className="h-px bg-[#141414]"/><div className="flex justify-between items-center"><span className="text-[11px] text-[#555]">Last Service</span><div className="text-right"><span className="text-[11px] font-bold font-mono text-[#888]">{fmtShort(lastService.date)}</span>{lastService.service_type&&<span className="text-[9px] text-[#444] block">{lastService.service_type}</span>}</div></div></>}
      </div>
    </div>
  );
}

// ─── Weather Widget ───────────────────────────────────────────────────────────

function WeatherWidget({ refreshCount }: { refreshCount: number }) {
  const [weather,setWeather]=useState<{temp:number;icon:string}|null>(null);
  useEffect(()=>{
    try{const c=localStorage.getItem('cc_weather_v1');if(c)setWeather(JSON.parse(c));}catch{}
    if(!('geolocation'in navigator))return;
    navigator.geolocation.getCurrentPosition(pos=>{fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`).then(r=>r.json()).then(d=>{if(!d.current)return;const w={temp:d.current.tempF,icon:d.current.icon};setWeather(w);try{localStorage.setItem('cc_weather_v1',JSON.stringify(w));}catch{}}).catch(()=>{});});
  },[refreshCount]);
  if(!weather)return<div className="rounded-full bg-[#111] border border-[#1a1a1a] px-3 py-1.5 text-[11px] text-[#333]">—°</div>;
  return<div onClick={()=>{window.location.href='/weather';}} className="rounded-full bg-[#111] border border-[#1a1a1a] px-3 py-1.5 flex items-center gap-1.5 active:opacity-70 transition-opacity cursor-pointer"><span className="text-sm">{weather.icon}</span><span className="text-[12px] font-semibold text-[#888]">{weather.temp}°</span></div>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommandCenterCards() {
  const [syncing,setSyncing]=useState(false);
  const [modal,setModal]=useState<string|null>(null);
  const [refreshCount,setRefreshCount]=useState(0);

  const handleRefresh=useCallback(async()=>{
    setSyncing(true);
    try{['cc_health_v1','cc_finance_v1','cc_finance_v2','cc_finance_v3','cc_calendar_v1','cc_tasks_v1','cc_weather_v1','cc_knox_v2','cc_investments_v1','cc_investments_v2','cc_vehicle_v1'].forEach(k=>localStorage.removeItem(k));Object.keys(localStorage).filter(k=>k.startsWith('finance_')).forEach(k=>localStorage.removeItem(k));}catch{}
    setSyncing(false);
    setRefreshCount(c=>c+1);
  },[]);

  const quickActions=[
    {label:'⛽ Fuel',modal:'fuel'},
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 pb-3 z-30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] text-[#444] font-medium">{formatDay()}</div>
              <div className="text-[22px] font-extrabold text-white leading-tight font-display">{getGreeting()}, Mahlon</div>
              {syncing&&<div className="flex items-center gap-1.5 text-[10px] text-[#f0a050] mt-0.5 font-mono"><div className="w-2 h-2 border border-[#f0a050] border-t-transparent rounded-full animate-spin"/>Refreshing…</div>}
            </div>
            <WeatherWidget refreshCount={refreshCount}/>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {quickActions.map(({label,modal:m})=>(
              <button key={label} onClick={()=>{if(navigator.vibrate)navigator.vibrate(8);setModal(m);}}
                className="flex-shrink-0 text-[11px] font-semibold text-[#f0a050] border border-[#f0a050]/30 bg-[#f0a050]/5 px-3 py-1.5 rounded-full active:bg-[#f0a050]/15 transition-colors">
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <PullToRefresh onRefresh={handleRefresh}>
            <div className="px-4 pt-4 pb-24 space-y-3">
              <SectionLabel>Health</SectionLabel>
              <HealthCard refreshCount={refreshCount}/>
              <SectionLabel>Finance</SectionLabel>
              <FinanceRow refreshCount={refreshCount}/>
              <InvestmentsCard refreshCount={refreshCount}/>
              <SectionLabel>My Life</SectionLabel>
              <CalendarCard refreshCount={refreshCount}/>
              <TasksCard refreshCount={refreshCount}/>
              <VehicleCard refreshCount={refreshCount}/>
              <SectionLabel>News</SectionLabel>
              <NewsCard/>
            </div>
          </PullToRefresh>
        </div>
      </div>

      {modal==='fuel'&&<FuelModal onClose={()=>setModal(null)} onSaved={()=>setModal(null)}/>}
    </>
  );
}