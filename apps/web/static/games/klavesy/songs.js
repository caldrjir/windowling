'use strict';
// ── KLÁVESY · skladby ───────────────────────────────────────────────────────
// Jen volná díla (autoři zemřeli před víc než 70 lety, lidové písně). Melodie i akordy jsou
// zapsané ručně, aranže pro jednotlivé styly skládá audio.js z akordů.
//
// Zápis: řádek = jedna doba mřížky (`unit`), `bar` řádků na takt, `beat` řádků na dobu,
// `pickup` řádků předtaktí. Melodie: `E5` (1 řádek), `E5:2`, `D5:.5`, `r` pauza (prodlouží
// předchozí dlaždici), `|` hranice taktu (kontroluje se). Akordy: takty oddělené `|`, v taktu
// rovným dílem nebo `Am:3`. První takt patří předtaktí, když nějaké je. `rps` = řádků za
// sekundu při základní rychlosti.
const KlSongs = (() => {
  const SONGS = [
    {
      id: 'oda', name: ['Óda na radost', 'Ode to Joy'], by: 'L. van Beethoven', style: 'edm', rps: 2.7, bar: 4, beat: 1, pickup: 0,
      mel: `E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | E5:1.5 D5:.5 D5:2 | E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | D5:1.5 C5:.5 C5:2 |
        D5 D5 E5 C5 | D5 E5:.5 F5:.5 E5 C5 | D5 E5:.5 F5:.5 E5 D5 | C5 D5 G4:2 | E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | D5:1.5 C5:.5 C5:2`,
      ch: 'C | G | C | G | C | G | C | G C | G | G C | G | Am G | C | G | C | G C',
    },
    {
      id: 'eliska', name: ['Pro Elišku', 'Für Elise'], by: 'L. van Beethoven', style: 'piano', rps: 3.4, bar: 6, beat: 2, pickup: 2,
      mel: `E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4:2 r C4 E4 A4 | B4:2 r E4 G#4 B4 | C5:2 r E4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4:2 r C4 E4 A4 | B4:2 r E4 C5 B4 |
        A4:2 r B4 C5 D5 | E5:3 G4 F5 E5 | D5:3 F4 E5 D5 | C5:3 E4 D5 C5 | B4:2 r E4 E5 r | r E5 E6 r r D#5 | E5 r r D#5 E5 D#5 |
        E5 D#5 E5 B4 D5 C5 | A4:2 r C4 E4 A4 | B4:2 r E4 C5 B4 | A4:4`,
      ch: '- | E | Am | E | Am | E | Am | E | Am | C | G | Am | E | E | E | E | Am | E | Am',
    },
    {
      id: 'turecky', name: ['Turecký pochod', 'Turkish March'], by: 'W. A. Mozart', style: 'rock', rps: 3.6, bar: 8, beat: 4, pickup: 4,
      mel: `B4 A4 G#4 A4 | C5:4 D5 C5 B4 C5 | E5:4 F5 E5 D#5 E5 | B5 A5 G#5 A5 B5 A5 G#5 A5 | C6:4 A5:2 C6:2 |
        B5:2 A5:2 G5:2 A5:2 | B5:2 A5:2 G5:2 A5:2 | B5:2 A5:2 G5:2 F#5:2 | E5:4`,
      ch: '- | Am | Am | E | Am | Am | Am | Am B7 | Em',
    },
    {
      id: 'nachtmusik', name: ['Malá noční hudba', 'Eine kleine Nachtmusik'], by: 'W. A. Mozart', style: 'house', rps: 3.2, bar: 8, beat: 2, pickup: 0,
      mel: `G5:3 D5 G5:3 D5 | G5 D5 G5 B5 D6:4 | C6:3 A5 C6:3 A5 | C6 A5 F#5 A5 D5:4 |
        G5:3 D5 G5:3 D5 | G5 D5 G5 B5 D6:4 | C6:3 A5 C6:3 A5 | C6 A5 F#5 A5 G5:4`,
      ch: 'G | G | D7 | D | G | G | D7 | D7 G',
    },
    {
      id: 'kanon', name: ['Kánon D dur', 'Canon in D'], by: 'J. Pachelbel', style: 'pop', rps: 3.0, bar: 8, beat: 2, pickup: 0,
      mel: `E5 C5 G4 C5 D5 B4 G4 B4 | C5 A4 E4 A4 B4 G4 E4 G4 | A4 F4 C4 F4 G4 E4 C4 E4 | A4 F4 C4 F4 B4 G4 D4 G4 |
        C5:4 B4:4 | A4:4 G4:4 | F4:4 E4:4 | F4:4 D4:4`,
      ch: 'C G | Am Em | F C | F G | C G | Am Em | F C | F G',
    },
    {
      id: 'kralhor', name: ['V jeskyni krále hor', 'In the Hall of the Mountain King'], by: 'E. Grieg', style: 'rock', rps: 3.0, bar: 8, beat: 2, pickup: 0,
      mel: `B3 C#4 D4 E4 F#4 D4 F#4:2 | F4 C#4 F4:2 E4 C4 E4:2 | B3 C#4 D4 E4 F#4 D4 F#4 B4 | A4 F#4 D4 F#4 A4:4 |
        B3 C#4 D4 E4 F#4 D4 F#4:2 | F4 C#4 F4:2 E4 C4 E4:2 | B3 C#4 D4 E4 F#4 D4 F#4 B4 | A4 F#4 D4 F#4 A4:4 |
        F#4 G#4 A4 B4 C#5 A4 C#5:2 | C5 G#4 C5:2 B4 G4 B4:2 | F#4 G#4 A4 B4 C#5 A4 C#5 F#5 | E5 C#5 A4 C#5 E5:4 |
        F#4 G#4 A4 B4 C#5 A4 C#5:2 | C5 G#4 C5:2 B4 G4 B4:2 | F#4 G#4 A4 B4 C#5 A4 C#5 F#5 | E5 C#5 A4 C#5 E5:4`,
      ch: 'Bm | C# C | Bm | D | Bm | C# C | Bm | D | F#m | G# G | F#m | A | F#m | G# G | F#m | A',
    },
    {
      id: 'korobejniki', name: ['Korobejniki', 'Korobeiniki'], by: 'lidová / folk', style: 'edm', rps: 3.2, bar: 8, beat: 2, pickup: 0,
      mel: `E5:2 B4 C5 D5:2 C5 B4 | A4:2 A4 C5 E5:2 D5 C5 | B4:3 C5 D5:2 E5:2 | C5:2 A4:2 A4:4 |
        r D5:2 F5 A5:2 G5 F5 | E5:3 C5 E5:2 D5 C5 | B4:2 B4 C5 D5:2 E5:2 | C5:2 A4:2 A4:4`,
      ch: 'E7 | Am | E7 | Am | Dm | C | E7 | Am',
    },
    {
      id: 'menuet', name: ['Menuet G dur', 'Minuet in G'], by: 'C. Petzold (J. S. Bach)', style: 'piano', rps: 3.2, bar: 6, beat: 2, pickup: 0,
      mel: `D5:2 G4 A4 B4 C5 | D5:2 G4:2 G4:2 | E5:2 C5 D5 E5 F#5 | G5:2 G4:2 G4:2 | C5:2 D5 C5 B4 A4 | B4:2 C5 B4 A4 G4 | F#4:2 G4 A4 B4 G4 | A4:6 |
        D5:2 G4 A4 B4 C5 | D5:2 G4:2 G4:2 | E5:2 C5 D5 E5 F#5 | G5:2 G4:2 G4:2 | C5:2 D5 C5 B4 A4 | B4:2 C5 B4 A4 G4 | A4:2 B4 A4 G4 F#4 | G4:6`,
      ch: 'G | G | C | G | C | G | D | D | G | G | C | G | C | G | D | G',
    },
    {
      id: 'entertainer', name: ['The Entertainer', 'The Entertainer'], by: 'S. Joplin', style: 'pop', rps: 3.6, bar: 8, beat: 4, pickup: 2,
      mel: `D5 D#5 | E5 C6:2 E5 C6:2 E5 C6:5 C6 D6 D#6 E6 C6 D6 E6:2 B5 D6:2 C6:7 D5 D#5
        E5 C6:2 E5 C6:2 E5 C6:5 A5 G5 F#5 A5 C6 E6:2 D6 C6 A5 D6:8`,
      ch: '- | C | C | C:4 G7:3 C:1 | C | C | C D7 | Am D7 | G7',
    },
    {
      id: 'greensleeves', name: ['Greensleeves', 'Greensleeves'], by: 'lidová / folk', style: 'piano', rps: 3.0, bar: 6, beat: 2, pickup: 2,
      mel: `A4:2 | C5:4 D5:2 | E5:3 F5 E5:2 | D5:4 B4:2 | G4:3 A4 B4:2 | C5:4 A4:2 | A4:3 G#4 A4:2 | B4:4 G#4:2 | E4:4 A4:2 |
        C5:4 D5:2 | E5:3 F5 E5:2 | D5:4 B4:2 | G4:3 A4 B4:2 | C5:3 B4 A4:2 | G#4:3 F#4 G#4:2 | A4:4`,
      ch: '- | Am:4 G:2 | C | G | Em | Am | Am | E | E:4 Am:2 | Am:4 G:2 | C | G | Em | Am | E | Am',
    },
    {
      id: 'largo', name: ['Largo z Novosvětské', 'Largo (New World)'], by: 'A. Dvořák', style: 'piano', rps: 2.3, bar: 4, beat: 1, pickup: 0,
      mel: `E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5 E5 G5 E5 | D5:4 | E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5 E5 D5 C5 | C5:4`,
      ch: 'C | C | G Em | G | C | C | G | C',
    },
    {
      id: 'vltava', name: ['Vltava', 'The Moldau'], by: 'B. Smetana', style: 'pop', rps: 4.0, bar: 6, beat: 3, pickup: 0,
      mel: `E5:2 F#5 G5:2 A5 | B5:3 B5:3 | C6:3 C6:3 | B5:6 | A5:3 A5:3 | G5:3 G5:3 | F#5:3 F#5:3 | E5:6 |
        E5:2 F#5 G5:2 A5 | B5:3 B5:3 | C6:3 C6:3 | B5:6 | A5:3 A5:3 | G5:3 G5:3 | F#5:3 F#5:3 | E5:6`,
      ch: 'Em | Em | Am | Em | Am | Em | B7 | Em | Em | Em | Am | Em | Am | Em | B7 | Em',
    },
    {
      id: 'ukolebavka', name: ['Ukolébavka', 'Lullaby'], by: 'J. Brahms', style: 'piano', rps: 2.8, bar: 6, beat: 2, pickup: 2,
      mel: `E5 E5 | G5:3 E5 E5:2 | G5:4 E5 G5 | C6:2 B5:3 A5 | A5:2 G5:2 D5 E5 | F5:2 D5:2 D5 E5 | F5:4 D5 F5 | B5 A5 G5:2 B5:2 | C6:4`,
      ch: '- | C | C | C:2 G:4 | D7:2 G:4 | G7 | G7 | G7 | C',
    },
    {
      id: 'twinkle', name: ['Blikej, hvězdičko', 'Twinkle, Twinkle'], by: 'lidová / folk', style: 'pop', rps: 2.8, bar: 4, beat: 1, pickup: 0,
      mel: `C5 C5 G5 G5 | A5 A5 G5:2 | F5 F5 E5 E5 | D5 D5 C5:2 | G5 G5 F5 F5 | E5 E5 D5:2 | G5 G5 F5 F5 | E5 E5 D5:2 |
        C5 C5 G5 G5 | A5 A5 G5:2 | F5 F5 E5 E5 | D5 D5 C5:2`,
      ch: 'C | F C | F C | G C | C F | C G | C F | C G | C | F C | F C | G C',
    },
    {
      id: 'narozeniny', name: ['Hodně štěstí, zdraví', 'Happy Birthday'], by: 'M. a P. Hill', style: 'pop', rps: 2.8, bar: 6, beat: 2, pickup: 2,
      mel: `G4:1.5 G4:.5 | A4:2 G4:2 C5:2 | B4:4 G4:1.5 G4:.5 | A4:2 G4:2 D5:2 | C5:4 G4:1.5 G4:.5 | G5:2 E5:2 C5:2 | B4:2 A4:2 F5:1.5 F5:.5 | E5:2 C5:2 D5:2 | C5:4`,
      ch: '- | C | G | G | C | C | G7:2 F:4 | C G | C',
    },
    {
      id: 'rolnicky', name: ['Rolničky', 'Jingle Bells'], by: 'J. Pierpont', style: 'pop', rps: 3.0, bar: 4, beat: 1, pickup: 0,
      mel: `E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:.5 | E5:4 | F5 F5 F5:1.5 F5:.5 | F5 E5 E5 E5:.5 E5:.5 | E5 D5 D5 E5 | D5:2 G5:2 |
        E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:.5 | E5:4 | F5 F5 F5:1.5 F5:.5 | F5 E5 E5 E5:.5 E5:.5 | G5 G5 F5 D5 | C5:4`,
      ch: 'C | C | C | C | F | C | G | G | C | C | C | C | F | C | G | C',
    },
    {
      id: 'susanna', name: ['Oh! Susanna', 'Oh! Susanna'], by: 'S. Foster', style: 'house', rps: 3.2, bar: 8, beat: 2, pickup: 2,
      mel: `C5 D5 | E5:2 G5:2 G5:3 A5 | G5:2 E5:2 C5:3 D5 | E5:2 E5:2 D5:2 C5:2 | D5:6 C5 D5 | E5:2 G5:2 G5:3 A5 | G5:2 E5:2 C5:3 D5 | E5:2 E5:2 D5:2 D5:2 | C5:6`,
      ch: '- | C | C | C:4 G:2 C:2 | G | C | C | C G | C',
    },
    {
      id: 'saints', name: ['When the Saints', 'When the Saints'], by: 'lidová / folk', style: 'house', rps: 2.8, bar: 4, beat: 1, pickup: 3,
      mel: `C5 E5 F5 | G5:4 | r C5 E5 F5 | G5:4 | r C5 E5 F5 | G5:2 E5:2 | C5:2 E5:2 | D5:4 | r E5 E5 D5 | C5:3 C5 | E5:2 G5:2 | G5:2 F5:2 |
        r E5 F5 G5 | E5:2 C5:2 | D5:4 | C5`,
      ch: '- | C | C | C | C | C | C | G | C7 | C | C | C:2 F:2 | C | C | G | C',
    },
    {
      id: 'auld', name: ['Auld Lang Syne', 'Auld Lang Syne'], by: 'lidová / folk', style: 'piano', rps: 3.0, bar: 8, beat: 2, pickup: 2,
      mel: `G4:2 | C5:3 C5 C5:2 E5:2 | D5:3 C5 D5:2 E5:2 | C5:3 C5 E5:2 G5:2 | A5:6 A5:2 | G5:3 E5 E5:2 C5:2 | D5:3 C5 D5:2 E5:2 | C5:3 A4 A4:2 G4:2 | C5:6`,
      ch: '- | C | G:6 C:2 | C | F | C | G:6 C:2 | F:6 G:2 | C',
    },
    {
      id: 'vanoce', name: ['We Wish You a Merry Christmas', 'We Wish You a Merry Christmas'], by: 'lidová / folk', style: 'pop', rps: 3.0, bar: 6, beat: 2, pickup: 2,
      mel: `G4:2 | C5:2 C5 D5 C5 B4 | A4:2 A4:2 A4:2 | D5:2 D5 E5 D5 C5 | B4:2 G4:2 G4:2 | E5:2 E5 F5 E5 D5 | C5:2 A4:2 G4 G4 | A4:2 D5:2 B4:2 | C5:4`,
      ch: '- | C | F | D7 | G | C | F | Dm:2 G:4 | C',
    },
  ];

  const STYLES = [
    { id: 'piano', name: ['Klavír', 'Piano'] },
    { id: 'pop', name: ['Pop', 'Pop'] },
    { id: 'house', name: ['House', 'House'] },
    { id: 'edm', name: ['EDM', 'EDM'] },
    { id: 'rock', name: ['Rock', 'Rock'] },
  ];

  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(s) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
    if (!m) throw new Error('bad note ' + s);
    return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], sus4: [0, 5, 7] };
  function chord(s) {
    if (s === '-') return null;
    const m = /^([A-G])(#|b)?(m7|maj7|m|7|dim|sus4)?$/.exec(s);
    if (!m) throw new Error('bad chord ' + s);
    const root = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    return { name: s, root, pcs: QUAL[m[3] || ''].map(i => (root + i) % 12) };
  }

  // Skladba → noty melodie (r0, len řádků dlaždice, dur znějící délka, midi) a akordy (r0, len)
  function parse(song) {
    const notes = [];
    let pos = 0;
    const bars = [];
    for (const tok of song.mel.split(/\s+/).filter(Boolean)) {
      if (tok === '|') {
        const k = (pos - song.pickup) / song.bar;
        if (pos !== song.pickup && (k !== Math.round(k) || k < 0)) throw new Error(`${song.id}: bar line at row ${pos}`);
        bars.push(pos);
        continue;
      }
      const [n, d] = tok.split(':'), len = d ? parseFloat(d) : 1;
      if (!(len > 0)) throw new Error(`${song.id}: bad length ${tok}`);
      if (n === 'r') {
        if (!notes.length) throw new Error(`${song.id}: leading rest`);
        notes[notes.length - 1].len += len;
      } else notes.push({ r0: pos, len, dur: len, midi: midi(n) });
      pos += len;
    }
    const total = pos;
    if (Math.abs(total / song.bar - Math.round(total / song.bar)) > 1e-9) throw new Error(`${song.id}: length ${total} is not whole bars of ${song.bar}`);
    const chords = [];
    const cbars = song.ch.split('|').map(s => s.trim().split(/\s+/).filter(Boolean));
    const want = (song.pickup ? 1 : 0) + Math.ceil((total - song.pickup) / song.bar - 1e-9);
    if (cbars.length !== want) throw new Error(`${song.id}: ${cbars.length} chord bars, expected ${want}`);
    let r = 0;
    cbars.forEach((toks, i) => {
      const blen = song.pickup && i === 0 ? song.pickup : Math.min(song.bar, total - r);
      const fixed = toks.reduce((a, t) => a + (t.includes(':') ? parseFloat(t.split(':')[1]) : 0), 0);
      const free = toks.filter(t => !t.includes(':')).length;
      let c = r;
      for (const t of toks) {
        const [nm, d] = t.split(':');
        const len = d ? parseFloat(d) : (blen - fixed) / free;
        chords.push({ r0: c, len, ch: chord(nm) });
        c += len;
      }
      r += blen;
    });
    return { notes, chords, total };
  }

  return { SONGS, STYLES, parse, midi, chord };
})();
if (typeof module !== 'undefined') module.exports = KlSongs;
