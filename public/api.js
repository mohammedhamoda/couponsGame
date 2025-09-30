// api.js
const SERVER_BASE = '';

let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem('deviceId', deviceId);
}

export  async function canPlay() {
  try {
    const res = await fetch(`/can-play?deviceId=${encodeURIComponent(deviceId)}`);
    return await res.json();
  } catch(e) { return { canPlay:true }; }
}


export async function claimCoupon(score, gameId) {
  const res = await fetch(`/claim-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, score, gameId })
  });
  return res.json();
}

export async function recordPlay() {
  await fetch(`${SERVER_BASE}/record-play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId })
  });
}
