const DAILY_BASE = "https://api.daily.co/v1";

export async function dailyRequest<T>(path:string, init:RequestInit={}) : Promise<T> {
  const key=process.env.DAILY_API_KEY;
  if(!key) throw new Error("DAILY_API_KEY is not configured");
  const response=await fetch(`${DAILY_BASE}${path}`,{
    ...init,
    headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(init.headers||{})},
    cache:"no-store"
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.info||data?.error||`Daily request failed (${response.status})`);
  return data as T;
}

export function unixSeconds(value:Date|string|number){return Math.floor(new Date(value).getTime()/1000)}
