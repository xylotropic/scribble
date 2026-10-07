'use strict';
// Send the latest complete timer snapshot in order, including an empty final snapshot.
function createNativeTimerPill({request,now=Date.now,onError=()=>{}}) {
  let desired=null,running=false,disposed=false;
  async function drain() {
    if(running)return;running=true;
    try {while(desired){const payload=desired;desired=null;try{await request('timerPillSync',payload);}catch(error){onError(error);}}}
    finally{running=false;}
  }
  return {
    sync(timers,labels) {
      if(disposed)return;
      const current=now();
      const ids=new Set();
      desired={timers:timers.filter(timer=>timer && typeof timer.id==='string' && timer.id.length>0 && timer.id.length<=100 && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(timer.id) && typeof timer.title==='string' && Number.isFinite(timer.endsAt) && timer.endsAt>current && timer.endsAt<=current+30*86400*1000)
        .sort((a,b)=>a.endsAt-b.endsAt||a.id.localeCompare(b.id)).filter(timer=>!ids.has(timer.id) && ids.add(timer.id)).slice(0,32)
        .map(({id,title,endsAt})=>({id,title:title.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu,' ').slice(0,200).trim() || labels?.timer || 'Timer',endsAt})),...(labels?{labels:{...labels}}:{})};
      void drain();
    },
    dispose(){if(disposed)return;disposed=true;desired={timers:[]};void drain();},
  };
}
module.exports={createNativeTimerPill};
