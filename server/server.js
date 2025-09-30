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

// can-play check (per game)
app.get('/can-play', (req,res) => {
  const { deviceId } = req.query;
  if(!deviceId) return res.json({ canPlay: true });

  const plays = readJSON(PLAYS_FILE, {});
  const key = `${deviceId}`;
  const last = plays[key];

  if(last === todayString()) {
    return res.json({ canPlay: false, reason: 'already_played_today' });
  }
  res.json({ canPlay: true });
});

// record that the device played
app.post('/record-play', (req,res) => {
  const { deviceId } = req.body;
  if(!deviceId) return res.status(400).json({ ok:false, error:'deviceId_required' });

  const plays = readJSON(PLAYS_FILE, {});
  const key = `${deviceId}`;
  plays[key] = todayString();
  writeJSON(PLAYS_FILE, plays);

  res.json({ ok:true });
});

// claim-coupon endpoint
// claim-coupon endpoint
app.post('/claim-coupon', (req, res) => {
  const { deviceId, score, gameId } = req.body;

  if (!deviceId || score === undefined || !gameId) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  const coupons = readJSON(COUPONS_FILE, []);
  const plays = readJSON(PLAYS_FILE, {});
  const key = `${deviceId}`;

  // mark that the user has played today
  plays[key] = todayString();
  writeJSON(PLAYS_FILE, plays);

  // find first available coupon for this game and score range
  const coupon = coupons.find(c =>
    c.gameId === gameId &&
    !c.claimed &&
    score >= c.minScore &&
    score <= c.maxScore
  );

  if (!coupon) {
    return res.json({ ok: false, error: "No coupon available for this score." });
  }

  // mark as claimed
  coupon.claimed = true;
  coupon.claimedBy = deviceId;
  coupon.claimedAt = new Date().toISOString();
  coupon.scoreWhenClaimed = score;

  writeJSON(COUPONS_FILE, coupons);

  res.json({ ok: true, coupon: coupon.code });
});

// verify coupon (used by cafe/restaurant)
app.get('/redeem/verify-coupon', (req,res) => {
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
app.post('/redeem/redeem-coupon', (req,res) => {
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
// admin stats endpoint
app.get('/admin/stats', (req,res) => {
  const coupons = readJSON(COUPONS_FILE, []);
  const plays = readJSON(PLAYS_FILE, {});

  const totalDevices = Object.keys(plays).length;
  const totalCoupons = coupons.length;
  const claimed = coupons.filter(c => c.claimed).length;
  const redeemed = coupons.filter(c => c.redeemed).length;

  // breakdown by game
  const games = {};
  coupons.forEach(c => {
    if(!games[c.gameId]) {
      games[c.gameId] = { total:0, claimed:0, redeemed:0 };
    }
    games[c.gameId].total++;
    if(c.claimed) games[c.gameId].claimed++;
    if(c.redeemed) games[c.gameId].redeemed++;
  });

  res.json({
    devices: totalDevices,
    coupons: {
      total: totalCoupons,
      claimed,
      redeemed
    },
    byGame: games
  });
});


app.listen(PORT, ()=> console.log('Server running on port', PORT));
