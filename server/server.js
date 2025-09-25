const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname,'..','public')));

const COUPONS_FILE = path.join(__dirname,'coupons.json');
const PLAYS_FILE = path.join(__dirname,'plays.json');

function readJSON(file, fallback){
  try{ const raw = fs.readFileSync(file,'utf8'); return JSON.parse(raw || 'null') || fallback; }
  catch(e){ return fallback; }
}
function writeJSON(file, obj){ fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8'); }

function todayString(){ return new Date().toDateString(); }

// can-play check
app.get('/can-play', (req,res) => {
  const deviceId = req.query.deviceId;
  if(!deviceId) return res.json({ canPlay: true });
  const plays = readJSON(PLAYS_FILE, {});
  const last = plays[deviceId];
  if(last === todayString()) return res.json({ canPlay: false, reason: 'already_played_today' });
  res.json({ canPlay: true });
});

// record that the device played (called by client when they lose)
app.post('/record-play', (req,res) => {
  const { deviceId } = req.body;
  if(!deviceId) return res.status(400).json({ ok:false, error:'deviceId_required' });
  const plays = readJSON(PLAYS_FILE, {});
  plays[deviceId] = todayString();
  writeJSON(PLAYS_FILE, plays);
  res.json({ ok:true });
});

// claim a coupon (called on win). This will also mark the device as played today.
app.post('/claim-coupon', (req,res) => {
  const { deviceId } = req.body;
  if(!deviceId) return res.status(400).json({ ok:false, error:'deviceId_required' });

  const plays = readJSON(PLAYS_FILE, {});
  if(plays[deviceId] === todayString()) return res.json({ ok:false, error:'already_played_today' });

  const coupons = readJSON(COUPONS_FILE, []);
  const idx = coupons.findIndex(c => !c.claimed);
  if(idx === -1) return res.json({ ok:false, error:'no_coupons_left' });

  // claim
  coupons[idx].claimed = true;
  coupons[idx].claimedBy = deviceId;
  coupons[idx].claimedAt = (new Date()).toISOString();

  plays[deviceId] = todayString();

  writeJSON(COUPONS_FILE, coupons);
  writeJSON(PLAYS_FILE, plays);

  res.json({ ok:true, coupon: coupons[idx].code });
});

// verify coupon (used by cafe/restaurant)
app.get('/verify-coupon', (req,res) => {
  const code = req.query.code;
  if(!code) return res.json({ ok:false, message:'Please enter a code' });

  const coupons = readJSON(COUPONS_FILE, []);
  const c = coupons.find(x => x.code === code);

  if(!c) return res.json({ ok:false, message:'Coupon not found' });
  if(!c.claimed) return res.json({ ok:false, message:'Coupon not yet claimed' });
  if(c.redeemed) return res.json({ ok:false, message:'Coupon already redeemed' });

  res.json({ ok:true, message:'Coupon is valid and can be redeemed' });
});

// redeem coupon (crew side)
app.post('/redeem-coupon', (req,res) => {
    const { code, crewName } = req.body;
  if(!code) return res.json({ ok:false, message:'Code required' });

  const coupons = readJSON(COUPONS_FILE, []);
  const idx = coupons.findIndex(x => x.code === code);
  if(idx === -1) return res.json({ ok:false, message:'Coupon not found' });

  const c = coupons[idx];
  if(!c.claimed) return res.json({ ok:false, message:'Coupon not yet claimed' });
  if(c.redeemed) return res.json({ ok:false, message:'Coupon already redeemed' });

  // mark as redeemed
  c.redeemed = true;
  c.redeemedBy = crewName || 'staff';
  c.redeemedAt = (new Date()).toISOString();
  coupons[idx] = c;
  writeJSON(COUPONS_FILE, coupons);

  res.json({ ok:true, message:'Redeemed successfully!' });
});

app.listen(PORT, ()=> console.log('Server running on port', PORT));