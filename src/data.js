/* =============================================================================
   SCALE — level metadata
   Twelve stops from a whole human being down to the quarks inside a proton.
   `unitMeters` = how many real metres one model unit represents. It is used by
   the live scale bar so the on-screen ruler stays physically honest.
   ========================================================================== */
window.SCALE = window.SCALE || {};

window.SCALE.LEVELS = [
  {
    id: 'body',
    name: 'Human Body',
    kind: 'Organism',
    scale: '1.7 m',
    unitMeters: 1,
    accent: '#2f6bff',
    tagline: 'You, at human scale',
    blurb:
      'A complete human being: about 1.7 metres of bone, muscle, blood and nerve. ' +
      'Everything further down this ladder is happening inside you, right now, all at once.',
    compare: 'Roughly one doorway tall.',
    facts: [
      ['Height', '≈ 1.7 m (5 ft 7 in)'],
      ['Cell count', '~37 trillion'],
      ['Water', '≈ 60% of body mass'],
      ['Parts', '206 bones · 600+ muscles']
    ]
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    kind: 'Structure',
    scale: '1.7 m',
    unitMeters: 1,
    accent: '#7c8ba1',
    tagline: 'The living scaffold',
    blurb:
      'Strip away the soft tissue and what is left is a frame that holds you up, ' +
      'protects your organs and gives your muscles something to pull against. ' +
      'Bone is not dead scaffolding — it is living tissue that rebuilds itself constantly.',
    compare: 'The femur alone is about a quarter of your height.',
    facts: [
      ['Bones', '206 in an adult'],
      ['Longest', 'Femur — about 48 cm'],
      ['Smallest', 'Stapes, in the ear — 3 mm'],
      ['Rebuild rate', '~10% of bone replaced per year']
    ]
  },
  {
    id: 'organs',
    name: 'Organs',
    kind: 'Organ',
    scale: '25 cm',
    unitMeters: 0.26,
    accent: '#e0503f',
    tagline: 'Specialised machines, packed tight',
    blurb:
      'Everything above the waist fits inside a space the size of a shoebox. ' +
      'Each organ is a machine with one job — pump, filter, absorb, oxygenate — ' +
      'and each one is built from billions of cells that all agreed to do it together.',
    compare: 'Your heart is about the size of your two fists.',
    facts: [
      ['Heart', '~12 cm · 5 L pumped per minute'],
      ['Lungs', '~25 cm · 480 million alveoli'],
      ['Liver', 'Largest internal organ, ~1.5 kg'],
      ['Small intestine', '~6 m long, unfolded']
    ]
  },
  {
    id: 'tissue',
    name: 'Tissue',
    kind: 'Tissue',
    scale: '2 mm',
    unitMeters: 0.0005,
    accent: '#2f9e8f',
    tagline: 'Cells that agreed to specialise',
    blurb:
      'At millimetre scale, an organ resolves into tissues — sheets, tubes and bundles ' +
      'of cells with a shared job. This is a slab of epithelium: cells pressed side by ' +
      'side like honeycomb, sealed so nothing leaks between them.',
    compare: 'One cubic millimetre of tissue holds around 100,000 cells.',
    facts: [
      ['Basic tissue types', '4 — epithelial, connective, muscle, nervous'],
      ['Cell spacing', 'Cells touch, with ~20 nm gaps'],
      ['Junctions', 'Tight junctions seal the sheet'],
      ['Polarity', 'Top and bottom faces do different jobs']
    ]
  },
  {
    id: 'cell',
    name: 'The Cell',
    kind: 'Cell',
    scale: '20 µm',
    unitMeters: 0.00001,
    accent: '#3f8fdd',
    tagline: 'The smallest thing that is alive',
    blurb:
      'A cell is a droplet of salty water wrapped in a film of oil, running thousands of ' +
      'chemical reactions at once without ever getting them wrong. Everything alive is ' +
      'either a cell or a colony of them.',
    compare: 'About 25–50 of them would fit across a grain of salt.',
    facts: [
      ['Typical size', '10–30 µm across'],
      ['Proteins', '~200 million molecules per cell'],
      ['Power plants', 'Mitochondria, making ATP'],
      ['Membrane', 'Only 5 nm thick']
    ]
  },
  {
    id: 'nucleus',
    name: 'Cell Nucleus',
    kind: 'Organelle',
    scale: '6 µm',
    unitMeters: 0.000003,
    accent: '#7a6bd8',
    tagline: 'Two metres of DNA, folded into a speck',
    blurb:
      'The control room. Every instruction for building and running you is stored in here, ' +
      'wrapped around protein spools and coiled so tightly that two metres of DNA fits ' +
      'inside something smaller than a dust mote.',
    compare: 'If the nucleus were a basketball, your DNA would stretch about 80 km.',
    facts: [
      ['Diameter', '~6 µm'],
      ['Contents', '46 chromosomes (23 pairs)'],
      ['DNA packed inside', '~2 m per cell'],
      ['Pores', '~3,000 gates in the envelope']
    ]
  },
  {
    id: 'chromosome',
    name: 'Chromosome',
    kind: 'Genome',
    scale: '1.4 µm',
    unitMeters: 0.0000007,
    accent: '#5a49c0',
    tagline: 'DNA at maximum compression',
    blurb:
      'Before a cell divides, it packs its DNA into these X-shaped bundles. Each chromatid ' +
      'is a single DNA molecule, compressed about a thousandfold — the densest data storage ' +
      'arrangement we know of.',
    compare: 'Laid out end to end, the 46 chromosomes would be about 2 m of DNA.',
    facts: [
      ['Length', '~1.4 µm when condensed'],
      ['Per cell', '46 chromosomes'],
      ['Contents', 'One DNA molecule each'],
      ['Compression', '~1,000× shorter than loose DNA']
    ]
  },
  {
    id: 'dna',
    name: 'DNA Double Helix',
    kind: 'Molecule',
    scale: '2 nm',
    unitMeters: 0.000000001,
    accent: '#2f6bff',
    tagline: 'The instruction tape',
    blurb:
      'Two backbones spiral around each other with rungs of paired bases between them. ' +
      'The pairing rule — A always with T, G always with C — is what lets the molecule ' +
      'copy itself, and it is why life can persist.',
    compare: 'About 40,000 DNA helices side by side would span a human hair.',
    facts: [
      ['Diameter', '2 nm'],
      ['One turn', '3.4 nm — exactly 10 base pairs'],
      ['Per human cell', '~3.2 billion base pairs'],
      ['Copying accuracy', '~1 error per billion bases']
    ]
  },
  {
    id: 'molecule',
    name: 'Molecule — ATP',
    kind: 'Molecule',
    scale: '1 nm',
    unitMeters: 0.00000000015,
    accent: '#e08a2b',
    tagline: 'The cell\u2019s energy currency',
    blurb:
      'Molecules are atoms holding hands. ATP is the small, rechargeable battery every cell ' +
      'spends to do work — snap off its last phosphate and you release the energy that moves ' +
      'a muscle, pumps an ion, or copies a gene.',
    compare: 'A single cell recycles around 10 million ATP molecules per second.',
    facts: [
      ['Formula', 'C\u2081\u2080H\u2081\u2086N\u2085O\u2081\u2083P\u2083'],
      ['Width', '~1 nm'],
      ['Energy per bond', '~30 kJ/mol'],
      ['Turnover', '~10\u2077 molecules per cell per day']
    ]
  },
  {
    id: 'atom',
    name: 'Atom',
    kind: 'Atom',
    scale: '0.1 nm',
    unitMeters: 0.000000000018,
    accent: '#3f8fdd',
    tagline: 'Almost entirely empty space',
    blurb:
      'An atom is a tiny, heavy nucleus surrounded by a cloud of electrons. If the nucleus ' +
      'were a marble on a football pitch, the electrons would be a haze at the touchlines — ' +
      'matter is overwhelmingly nothing.',
    compare: 'The nucleus is 100,000× smaller than the atom it sits in.',
    facts: [
      ['Diameter', '~0.1 nm (100 pm)'],
      ['Nucleus', '10\u207b\u00b9\u2075 m — 100,000× smaller'],
      ['Electrons', 'Point-like, arranged in shells'],
      ['Mass', '>99.9% is in the nucleus']
    ]
  },
  {
    id: 'nucleon',
    name: 'Atomic Nucleus',
    kind: 'Nucleus',
    scale: '5 fm',
    unitMeters: 0.0000000000000025,
    accent: '#e0503f',
    tagline: 'Where the strong force lives',
    blurb:
      'Protons and neutrons are packed shoulder to shoulder, held by the strong nuclear force — ' +
      'the strongest force in nature, and one that only reaches across about one proton width. ' +
      'Squeeze matter this hard and it becomes denser than a neutron star.',
    compare: 'A teaspoon of nuclear matter would weigh about a billion tonnes.',
    facts: [
      ['Diameter', '~5 femtometres (5×10\u207b\u00b9\u2075 m)'],
      ['Carbon-12', '6 protons + 6 neutrons'],
      ['Density', '~2.3×10\u00b9\u2077 kg/m\u00b3'],
      ['Binding', 'Strong force, ~100× stronger than electric']
    ]
  },
  {
    id: 'quark',
    name: 'Quarks',
    kind: 'Fundamental',
    scale: '< 10\u207b\u00b9\u2078 m',
    unitMeters: 0.00000000000000085,
    accent: '#8a4fd8',
    tagline: 'The bottom of the ladder',
    blurb:
      'Protons and neutrons are not elementary. Each is three quarks bound by gluons — and ' +
      'as far as any experiment can tell, quarks are point-like: they have no measurable size ' +
      'at all. This is where our walk stops.',
    compare: 'No experiment has ever found an edge on a quark.',
    facts: [
      ['Proton', 'two up + one down quark (uud)'],
      ['Neutron', 'one up + two down quarks (udd)'],
      ['Quark size', 'No measurable radius, < 10\u207b\u00b9\u2078 m'],
      ['Confinement', 'Quarks are never found alone']
    ]
  }
];

/* =============================================================================
   LINKS — the connective tissue between adjacent stops.

   LINKS[i] is the edge joining LEVELS[i] (the larger thing) to LEVELS[i + 1]
   (the smaller thing inside it). Eleven edges join the twelve levels.

     ratio  — how much smaller the child is than the parent, as a chip label
     rel    — one sentence stating the actual physical relation
     down   — what the child IS, seen from the parent  (the door label)
     up     — what the parent IS, seen from the child  (the "part of" label)

   The geometric half of each link lives in models.js: every builder except the
   last places a `door` anchor at the spot where the next level down really is,
   so the app can point at it and let you walk through.
   ========================================================================== */
window.SCALE.LINKS = [
  {
    ratio: '\u00d71',
    rel: 'The skeleton is exactly as tall as you are \u2014 it is your body with ' +
      'the body taken out.',
    down: 'the frame inside you',
    up: 'the whole body'
  },
  {
    ratio: '\u00d73',
    rel: 'The ribcage and pelvis close into a cage. The organs sit inside it, ' +
      'held in place and shielded from anything you walk into.',
    down: 'the organs the cage protects',
    up: 'the cage around them'
  },
  {
    ratio: '\u00d7300',
    rel: 'Cut into any organ and it resolves into folded sheets of tissue \u2014 ' +
      'the same few cell types, arranged to do different jobs.',
    down: 'the tissue lining the lungs',
    up: 'the organ it lines'
  },
  {
    ratio: '\u00d7100',
    rel: 'Tissue is nothing but cells pressed together. One of them, lifted clear ' +
      'of the sheet, is the next stop.',
    down: 'one cell, lifted out',
    up: 'the sheet of cells around it'
  },
  {
    ratio: '\u00d73',
    rel: 'The nucleus is the control room \u2014 about a third of the cell across, ' +
      'holding every instruction the cell obeys.',
    down: 'the control room inside',
    up: 'the cell it runs'
  },
  {
    ratio: '\u00d74',
    rel: 'Packed in here are 46 chromosomes, each one a single DNA molecule wound ' +
      'up a thousand times tighter than the chromatin around it.',
    down: 'one chromosome, condensed',
    up: 'the nucleus it is stored in'
  },
  {
    ratio: '\u00d7700',
    rel: 'Unpack one chromatid and you are left with a single DNA double helix \u2014 ' +
      'two nanometres wide, and about two metres long.',
    down: 'the single DNA molecule',
    up: 'the chromosome it was packed into'
  },
  {
    ratio: '\u00d72',
    rel: 'Every rung and every backbone link in the helix is a molecule in its own ' +
      'right. ATP is one of the small ones the cell keeps on hand.',
    down: 'one molecule \u2014 ATP',
    up: 'the helix it belongs to'
  },
  {
    ratio: '\u00d710',
    rel: 'ATP is 31 atoms held in a chain by chemical bonds. Pull one atom out of ' +
      'that chain and you have the next stop.',
    down: 'a single atom',
    up: 'the molecule it is bonded into'
  },
  {
    ratio: '\u00d7100,000',
    rel: 'The atom is almost entirely empty space. The nucleus at its centre is ' +
      '100,000 times smaller than the atom it sits in.',
    down: 'the nucleus at the centre',
    up: 'the atom around it'
  },
  {
    ratio: 'point-like',
    rel: 'A proton is not elementary. Three quarks bound by gluons, with no ' +
      'measurable size of their own \u2014 this is the bottom of the ladder.',
    down: 'three quarks inside',
    up: 'the proton they build'
  }
];
