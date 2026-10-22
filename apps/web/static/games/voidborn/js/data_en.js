'use strict';
// ── Anglický překlad herních dat (přepíše české texty z data.js) ────────────
if (LANG === 'en') (() => {
  const W = {
    pulse: ['Pulse Cannon', 'Fires energy pulses at the nearest target.', ['+1 projectile', '+5 damage', 'Faster fire rate', '+1 projectile', 'Pierce +1', '+8 damage', '+1 projectile, pierce +1']],
    orbit: ['Orbital Blades', 'Blades circling your ship shred everything they touch.', ['+1 blade', '+6 damage', 'Wider orbit, faster spin', '+1 blade', '+1.5 s duration', '+9 damage', '+1 blade, wider orbit']],
    arc: ['Arc Discharge', 'Lightning strikes a target and jumps to nearby enemies.', ['+1 jump', '+8 damage', '+1 bolt', 'Faster recharge', '+2 jumps', '+12 damage', '+1 bolt, +1 jump']],
    seeker: ['Seeker Missiles', 'Missiles find their own targets and explode.', ['+1 missile', '+10 damage', 'Bigger explosions', '+1 missile', 'Faster recharge', '+14 damage', '+2 missiles']],
    nova: ['Shockwave', 'Periodically releases a ring of energy that knocks enemies back.', ['+10 damage', 'Larger radius', 'Faster recharge', '+14 damage', 'Larger radius', 'Double wave', '+20 damage, stronger knockback']],
    lance: ['Beam Lance', 'A piercing laser beam across the whole screen.', ['+14 damage', '+1 beam', 'Faster recharge', 'Wider beam', '+1 beam', '+24 damage', '+1 beam, faster recharge']],
    mines: ['Void Mines', 'Deploys mines that detonate on enemy contact.', ['+1 mine', '+20 damage', 'Bigger explosions', 'Faster deployment', '+1 mine', '+30 damage', '+2 mines']],
    aura: ['Frost Field', 'An icy aura damages and slows nearby enemies.', ['Larger field', '+3 damage', 'Stronger slow', 'Larger field', '+4 damage', 'More frequent hits', 'Larger, stronger field']],
    hyperpulse: ['Hyperpulse', 'A relentless barrage of pulses that explode on impact.'],
    halo: ['Halo', 'An eternal ring of blades that never stops.'],
    tesla: ['Tesla Storm', 'Chain lightning leaping across the entire horde.'],
    swarm: ['Swarm', 'A cloud of micro-missiles that floods the battlefield.'],
    supernova: ['Supernova', 'A triple stellar blast that crushes everything around you.'],
    prism: ['Prism Beam', 'Rotating beams in every direction.'],
    singularity: ['Singularity', 'Creates black holes that devour enemies.'],
    entropy: ['Entropy Field', 'A field of absolute zero. Kills inside it heal you.'],
  };
  for (const id in W) {
    const [name, desc, ups] = W[id], d = WEAPONS[id];
    d.name = name; d.desc = desc;
    if (ups) ups.forEach((u, i) => { d.up[i][1] = u; });
  }
  const P = {
    might: ['Power Core', '+10% damage'], haste: ['Overclock', '−7% cooldown'], area: ['Gyroscope', '+10% area of effect'],
    speed: ['Thrusters', '+8% move speed'], armor: ['Plating', '+1 armor, +12 max HP'], magnet: ['Gravity Coil', '+30% pickup range'],
    duration: ['Focus Lens', '+10% duration and projectile speed'], regen: ['Nanobots', '+0.3 HP regen/s'],
    luck: ['Quantum Die', '+10% luck, +4% crit chance'], amount: ['Duplicator', '+1 projectile for all weapons'],
  };
  for (const id in P) { PASSIVES[id].name = P[id][0]; PASSIVES[id].desc = P[id][1]; }
  const B = { warden: 'WARDEN', hive: 'HIVE', colossus: 'COLOSSUS', reaper: 'REAPER', monarch: 'VOID MONARCH' };
  for (const id in B) BOSSES[id].name = B[id];
  const S = [
    ['Neon Nebula', 'Where it all began. The void is only just opening its eyes.'],
    ['Crimson Belt', 'Molten wreckage of ancient fleets. Enemies strike without warning.'],
    ['Emerald Void', 'Living matter that splits and multiplies. Speed is everything.'],
    ['Golden Horizon', 'The edge of the event horizon. Bullets fly from every side.'],
    ['Heart of the Void', 'The end of everything. No one has ever come back.'],
  ];
  SECTORS.forEach((s, i) => { s.name = S[i][0]; s.desc = S[i][1]; });
  const PL = {
    vex: ['Scout', 'A balanced pilot for any situation.', '+10% experience'],
    kira: ['Duelist', 'Dances in the middle of the horde while the blades do the rest.', '+15% move speed'],
    orion: ['Engineer', 'Squeezes the most out of every circuit.', '+10% area, −5% cooldown'],
    nyx: ['Huntress', 'Strikes first. Has no time for defense.', '+20% damage, −20 HP'],
    titan: ['Guardian', 'Slow, but practically indestructible.', '+50 HP, +2 armor, −10% speed'],
    echo: ['Saboteur', 'Plays the odds and always wins.', '+25% luck, +2 rerolls'],
    lumen: ['Sniper', 'One shot, one row of wrecks.', '+15% duration and projectile speed, +5% crit'],
    zero: ['Cryomancer', 'Around Zero, even time freezes.', '+0.5 regen, +20% magnet'],
    omega: ['Anomaly', 'Nobody knows where Omega came from. Not even Omega.', 'Random weapon, +1 projectile, +1 revive'],
  };
  for (const p of PILOTS) { const t = PL[p.id]; p.role = t[0]; p.desc = t[1]; p.perk = t[2]; }
  const F = {
    might: ['Might', '+5% damage'], vitality: ['Vitality', '+10 max HP'], armor: ['Armor', '+1 armor'], recovery: ['Recovery', '+0.1 HP/s'],
    haste: ['Overclock', '−3% cooldown'], area: ['Reach', '+5% area of effect'], speed: ['Thrusters', '+5% speed'],
    duration: ['Stabilizer', '+5% duration and projectile speed'], magnet: ['Magnet', '+15% pickup range'], growth: ['Growth', '+4% experience'],
    greed: ['Greed', '+10% shards'], luck: ['Luck', '+6% luck'], crit: ['Precision', '+2% crit chance'], reroll: ['Reroll', '+1 reroll per run'],
    skip: ['Skip', '+1 skip per run'], dash: ['Impulse', '+1 dash charge'], revival: ['Phoenix', '+1 revive per run'], amount: ['Duplicator', '+1 projectile for all weapons'],
  };
  for (const f of FORGE) { f.name = F[f.id][0]; f.desc = F[f.id][1]; }
  const A = {
    k100: ['First Blood', 'Destroy 100 enemies.'], k1000: ['Cleaner', 'Destroy 1,000 enemies.'], k10000: ['Exterminator', 'Destroy 10,000 enemies.'],
    k50000: ['Calamity', 'Destroy 50,000 enemies.'], k250000: ['End of Civilizations', 'Destroy 250,000 enemies.'],
    t5: ['Survivor', 'Survive 5 minutes in a single run.'], t10: ['Resilient', 'Survive 10 minutes in a single run.'],
    t25: ['Eternal', 'Survive 25 minutes in a single run (endless mode).'], boss1: ['Titan Slayer', 'Defeat a boss.'], boss25: ['Monarch Hunter', 'Defeat 25 bosses.'],
    clear1: ['Nebula Cleared', 'Complete Sector I.'], clear2: ['Belt Breached', 'Complete Sector II.'], clear3: ['Emerald Hunter', 'Complete Sector III.'],
    clear4: ['Beyond the Horizon', 'Complete Sector IV.'], clear5: ['Heart Stopped', 'Complete Sector V.'],
    evo1: ['Metamorphosis', 'Evolve any weapon.'], evo4: ['Alchemist', 'Discover 4 different evolutions.'], evo8: ['Architect of Ruin', 'Discover all 8 evolutions.'],
    lvl30: ['Charged', 'Reach level 30 in a single run.'], lvl60: ['Overloaded', 'Reach level 60 in a single run.'],
    od1: ['Overdrive', 'Complete any sector on Overdrive 1.'], od5: ['Red Zone', 'Complete any sector on Overdrive 5.'], od10: ['Beyond the Limit', 'Complete any sector on Overdrive 10.'],
    rich: ['Collector', 'Collect 5,000 shards in total.'], forge1: ['Blacksmith', 'Buy your first upgrade in the Forge.'], forgeAll: ['Master Smith', 'Buy 50 upgrade levels in the Forge.'],
    arsenal: ['Arsenal', 'Hold 6 weapons at once in a single run.'], untouch: ['Untouchable', 'Go 3 minutes straight without getting hit.'],
    massacre: ['Massacre', 'Destroy 250 enemies within 10 seconds.'], clean: ['Not a Scratch', 'Defeat a boss without getting hit during the fight.'],
    runs10: ['Veteran', 'Play 10 runs.'], runs50: ['Legend', 'Play 50 runs.'], dash500: ['Acrobat', 'Dash 500 times.'], pilots: ['Full Squadron', 'Unlock all pilots.'],
  };
  for (const a of ACHIEVEMENTS) { a.name = A[a.id][0]; a.desc = A[a.id][1]; }
})();
