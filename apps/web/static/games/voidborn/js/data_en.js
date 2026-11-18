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
    disc: ['Ricochet Disc', 'A glowing disc bounces from enemy to enemy.', ['+1 bounce', '+7 damage', '+1 disc', 'Faster throws', '+2 bounces', '+12 damage', '+1 disc, +1 bounce']],
    plasma: ['Plasma Torch', 'A cone of plasma burns everything in front of the ship. Short range, huge damage.', ['+2 damage', 'Wider cone', 'Longer flame', '+3 damage', 'Faster burn', '+3 damage, longer flame', 'Second flame']],
    meteor: ['Orbital Strike', 'Shells from orbit crash into the thickest packs of enemies.', ['+1 strike', '+25 damage', 'Bigger impact', '+1 strike', 'Faster recharge', '+40 damage', '+2 strikes']],
    quantum: ['Quantum Disc', 'Discs bounce almost endlessly and grow stronger with every bounce.'],
    comet: ['Comet', 'A wide flame and a trail of fire behind the ship. The faster you fly, the more it burns.'],
    starfall: ['Starfall', 'A rain of stars that always land critical hits.'],
    sentry: ['Sentry Drones', 'Drones circling your ship fire at the nearest enemies on their own.', ['+1 drone', '+5 damage', 'Faster fire rate', 'Longer range, pierce +1', '+1 drone', '+8 damage', '+1 drone, faster fire rate']],
    voidray: ['Void Ray', 'A beam latches onto an enemy and burns hotter the longer it holds on.', ['+1.5 damage', 'Longer range', '+1 beam', 'Heats up faster', '+2 damage', '+1 beam', 'Higher heat cap, +1.5 damage']],
    cluster: ['Cascade', 'A bomb lands in a pack of enemies and bursts into smaller charges.', ['+2 charges', '+16 damage', '+1 bomb', 'Bigger explosions', 'Faster recharge', '+24 damage', '+1 bomb, +2 charges']],
    armada: ['Armada', 'A whole squadron of drones fires twin piercing shots in every direction.'],
    devourer: ['Devourer', 'Beams jump to further enemies and heat up to ten times their damage.'],
    chainreact: ['Chain Reaction', 'Every charge bursts again. The whole battlefield in flames.'],
  };
  for (const id in W) {
    const [name, desc, ups] = W[id], d = WEAPONS[id];
    d.name = name; d.desc = desc;
    if (ups) ups.forEach((u, i) => { d.up[i][1] = u; });
  }
  const P = {
    might: ['Power Core', '+10% damage'], haste: ['Overclock', '−8% cooldown'], area: ['Gyroscope', '+10% area of effect'],
    speed: ['Thrusters', '+8% move speed'], armor: ['Plating', '+1 armor (−7% damage taken), +12 max HP'], magnet: ['Gravity Coil', '+30% pickup range'],
    duration: ['Focus Lens', '+10% duration and projectile speed'], regen: ['Nanobots', '+0.3 HP regen/s'],
    luck: ['Quantum Die', '+10% luck, +4% crit chance'], amount: ['Duplicator', '+1 projectile for all weapons'],
    critamp: ['Crit Amplifier', '+25% critical damage, +3% crit chance'],
    shield: ['Energy Shield', 'Absorbs one whole hit. Recharges in 30 s, 4 s faster with every further level.'],
  };
  for (const id in P) { PASSIVES[id].name = P[id][0]; PASSIVES[id].desc = P[id][1]; }
  const M = {
    might: ['Might Mutation', '+4% damage'], vigor: ['Vigor Mutation', '+10 max HP (filled at once)'], haste: ['Haste Mutation', '−3% cooldown'],
    area: ['Reach Mutation', '+4% area of effect'], crit: ['Precision Mutation', '+2% crit chance, +10% crit damage'],
  };
  for (const id in M) { MUTATIONS[id].name = M[id][0]; MUTATIONS[id].desc = M[id][1]; }
  const B = { warden: 'WARDEN', hive: 'HIVE', colossus: 'COLOSSUS', reaper: 'REAPER', monarch: 'VOID MONARCH' };
  for (const id in B) BOSSES[id].name = B[id];
  const S = [
    ['Neon Nebula', 'Where it all began. The void is only just opening its eyes.'],
    ['Crimson Belt', 'Molten wreckage of ancient fleets. Enemies strike without warning.'],
    ['Emerald Void', 'Living matter that splits and multiplies. Speed is everything.'],
    ['Golden Horizon', 'The edge of the event horizon. Bullets fly from every side.'],
    ['Heart of the Void', 'The end of everything. No one has ever come back.'],
    ['Meteor Storm', 'Meteors streak through a belt of wreckage. A warning line shows their path: dodge, or let one crush the horde.'],
    ['Monoculture', 'A single kind of enemy, in enormous numbers. Every two and a half minutes the void switches to another.'],
    ['Event Horizon', 'A wandering black hole pulls you in and creeps after you. Enemies it swallows are crushed.'],
    ['Darkness', 'Light reaches only a little way around the ship. What lies beyond, you learn when it hits you.'],
    ['Arena of Titans', 'Bosses arrive every two and a half minutes and elites come twice as often. Survive the whole parade.'],
    ['Collapse', 'The safe zone keeps shrinking and moving elsewhere. Outside it, the void tears you apart.'],
    ['The End of Everything', 'Meteors, a black hole and darkness all at once. There is no way further.'],
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
    might: ['Might', '+5% damage'], vitality: ['Vitality', '+10 max HP'], armor: ['Armor', '+1 armor (−7% damage taken)'], recovery: ['Recovery', '+0.1 HP/s'],
    haste: ['Overclock', '−3% cooldown'], area: ['Reach', '+5% area of effect'], speed: ['Thrusters', '+5% speed'],
    duration: ['Stabilizer', '+5% duration and projectile speed'], magnet: ['Magnet', '+15% pickup range'], growth: ['Growth', '+4% experience'],
    greed: ['Greed', '+10% shards'], luck: ['Luck', '+6% luck'], crit: ['Precision', '+2% crit chance'], reroll: ['Reroll', '+1 reroll per run'],
    skip: ['Skip', '+1 skip per run'], dash: ['Impulse', '+1 dash charge'], revival: ['Phoenix', '+1 revive per run'], amount: ['Duplicator', '+1 projectile for all weapons'],
    headstart: ['Head Start', 'Your starting weapon begins one level higher'], critamp: ['Crit Amplifier', '+15% critical damage'],
    dashblast: ['Shock Dash', 'Your dash hits enemies in its path for 15% of their health (bosses 1.5%)'], loot: ['Rich Loot', '+1 item in every chest'],
    secondwind: ['Second Wind', 'A revive restores full health and gives 5 s of invulnerability'], evomaster: ['Evolution Master', 'Weapons evolve at level 7 already'],
    cards: ['Wide Choice', 'One more card on every level-up'], pslot: ['Passive Slot', '+1 passive slot (7 instead of 6)'], wslot: ['Arsenal', '+1 weapon slot (7 instead of 6)'],
    dashcd: ['Quick Recharge', '−12% dash recharge time'], medkit: ['Med Kit', 'Hearts heal 10 more'], bounty: ['Elite Hunter', '+25% shards from elites, bosses and chests'],
    kit: ['Loadout', 'Every run starts with a random passive'], bossbane: ['Giant Slayer', '+10% damage to bosses and elites'],
    execute: ['Executioner', 'Regular enemies below 5% health (per level) die at once'], ocstart: ['Head-start Evolution', 'An evolved weapon starts one ★ higher'],
    deepmut: ['Deep Mutation', 'Every mutation cap +5'], gravwave: ['Gravity Wave', 'Every 40 s pulls in all crystals and shards on the map'],
    voidwill: ['Will of the Void', 'In endless mode enemies grow 25% slower'], e_thrust: ['Eternal Thrust', '+3% speed, −3% dash recharge time'],
    e_might: ['Eternal Might', '+5% damage'], e_vigor: ['Eternal Vigor', '+20 max HP, +0.15 HP/s'], e_haste: ['Eternal Tempo', '−2% cooldown'],
    e_area: ['Eternal Reach', '+4% area of effect and duration'], e_crit: ['Eternal Precision', '+1% crit chance, +6% crit damage'],
    e_growth: ['Eternal Insight', '+5% experience, +3% luck'], e_greed: ['Eternal Harvest', '+6% shards'],
    bp_sentry: ['Blueprint: Sentry Drones', 'Unlocks the new weapon Sentry Drones (evolves with Energy Shield)'],
    bp_voidray: ['Blueprint: Void Ray', 'Unlocks the new weapon Void Ray (evolves with Crit Amplifier)'],
    bp_cluster: ['Blueprint: Cascade', 'Unlocks the new weapon Cascade (evolves with Gyroscope)'],
    bans: ['Arms Plan', 'Strike 1 weapon (per level): it never shows up in a run and the others come more often'],
    hard: ['Hardpoint', 'A run starts with one extra weapon of your choice (per level)'], prelvl: ['Calibration', 'Weapons on hardpoints start one level higher'],
    ocmax: ['Beyond the Limit', 'Evolutions can be overcharged one ★ higher (★5 and ★6)'],
    echo: ['Echo', '25% chance a level-up also grants the second-best card'], bigslots: ['Grand Arsenal', '+1 weapon slot and +1 passive slot'],
    voidborn: ['Voidborn', 'Your starting weapon begins already evolved'],
  };
  for (const f of FORGE) { f.name = F[f.id][0]; f.desc = F[f.id][1]; }
  const PT = {
    guns: ['Guns', 'The barrels on the bow: damage, critical hits and elite hunting.'],
    cockpit: ['Cockpit', 'The navigation computer: luck, rerolls, more cards and mutations.'],
    reactor: ['Reactor', 'The heart of the ship: cooldown, reach, duration and weapon evolutions.'],
    hull: ['Hull', 'Plating and life support: health, armor, regeneration, revives.'],
    wings: ['Collector Wings', 'Magnetic sails: pickup range, experience, shards and loot.'],
    engines: ['Engines', 'Thrusters at the stern: speed and dashes.'],
    bay: ['Weapon Bay', 'Hardpoints and storage: weapon slots, your run loadout and blueprints of new weapons.'],
  };
  for (const p of PARTS) { p.name = PT[p.id][0]; p.desc = PT[p.id][1]; }
  const A = {
    k100: ['First Blood', 'Destroy 100 enemies.'], k1000: ['Cleaner', 'Destroy 1,000 enemies.'], k10000: ['Exterminator', 'Destroy 10,000 enemies.'],
    k50000: ['Calamity', 'Destroy 50,000 enemies.'], k250000: ['End of Civilizations', 'Destroy 250,000 enemies.'],
    t5: ['Survivor', 'Survive 5 minutes in a single run.'], t10: ['Resilient', 'Survive 10 minutes in a single run.'],
    t25: ['Eternal', 'Survive 25 minutes in a single run (endless mode).'], boss1: ['Titan Slayer', 'Defeat a boss.'], boss25: ['Monarch Hunter', 'Defeat 25 bosses.'],
    clear1: ['Nebula Cleared', 'Complete Sector I.'], clear2: ['Belt Breached', 'Complete Sector II.'], clear3: ['Emerald Hunter', 'Complete Sector III.'],
    clear4: ['Beyond the Horizon', 'Complete Sector IV.'], clear5: ['Heart Stopped', 'Complete Sector V.'],
    evo1: ['Metamorphosis', 'Evolve any weapon.'], evo4: ['Alchemist', 'Discover 4 different evolutions.'], evo8: ['Architect of Ruin', 'Discover 8 different evolutions.'],
    evoAll: ['Lord of the Void', 'Discover 11 different evolutions.'], t30: ['Undying', 'Survive 30 minutes in a single run (endless mode).'],
    lvl100: ['Mutant', 'Reach level 100 in a single run.'], masterAll: ['Grandmaster', 'Buy the whole Master Workshop.'], oc4: ['Overcharge', 'Overcharge an evolved weapon to ★4.'], master: ['Master Workshop', 'Buy your first upgrade in the Master Workshop.'],
    lvl30: ['Charged', 'Reach level 30 in a single run.'], lvl60: ['Overloaded', 'Reach level 60 in a single run.'],
    od1: ['Overdrive', 'Complete any sector on Overdrive 1.'], od5: ['Red Zone', 'Complete any sector on Overdrive 5.'], od10: ['Beyond the Limit', 'Complete any sector on Overdrive 10.'],
    rich: ['Collector', 'Collect 5,000 shards in total.'], forge1: ['Blacksmith', 'Buy your first upgrade in the Forge.'], forgeAll: ['Master Smith', 'Buy 50 upgrade levels in the Forge.'],
    arsenal: ['Arsenal', 'Hold 6 weapons at once in a single run.'], untouch: ['Untouchable', 'Go 3 minutes straight without getting hit.'],
    massacre: ['Massacre', 'Destroy 250 enemies within 10 seconds.'], clean: ['Not a Scratch', 'Defeat a boss without getting hit during the fight.'],
    clear6: ['Through the Stone Storm', 'Complete Sector VI.'], clear7: ['One Kind Is Not Enough', 'Complete Sector VII.'],
    clear8: ['Escape the Horizon', 'Complete Sector VIII.'], clear9: ['Light in the Dark', 'Complete Sector IX.'],
    sectorsAll: ['Lord of All Sectors', 'Complete all 12 sectors.'], meteorKills: ['Rockslide', 'Let meteors and the black hole destroy 300 enemies.'],
    voidAll: ['Void Smith', 'Buy the whole Void Workshop.'],
    clear10: ['The Parade Is Over', 'Complete Sector X.'], clear11: ['In the Middle of the Collapse', 'Complete Sector XI.'],
    clear12: ['After the End of Everything', 'Complete Sector XII.'], evo14: ['Complete Metamorphosis', 'Discover all 14 evolutions.'],
    oc6: ['Past the Overcharge Limit', 'Overcharge an evolved weapon to ★6.'], piece1: ['Masterpiece', 'Buy your first Masterpiece in the Forge.'],
    piecesAll: ['Gallery of Masters', 'Buy every Masterpiece.'], eternal10: ['Eternal Smith', 'Buy 10 levels in the Eternal Workshop.'],
    eternal50: ['Infinity', 'Buy 50 levels in the Eternal Workshop.'],
    runs10: ['Veteran', 'Play 10 runs.'], runs50: ['Legend', 'Play 50 runs.'], dash500: ['Acrobat', 'Dash 500 times.'], pilots: ['Full Squadron', 'Unlock all pilots.'],
  };
  for (const a of ACHIEVEMENTS) { a.name = A[a.id][0]; a.desc = A[a.id][1]; }
})();
