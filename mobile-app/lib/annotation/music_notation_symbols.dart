class MusicNotationSymbol {
  const MusicNotationSymbol({
    required this.codePoint,
    required this.label,
    required this.category,
    this.scale = 1,
    this.pickerScale = 1,
  });

  final int codePoint;
  final String label;
  final String category;
  final double scale;

  // Some Bravura glyphs (especially clefs/navigation marks) have much taller
  // font bounds than their visible artwork. Keep score-placement scale
  // independent from the compact symbol-picker preview scale.
  final double pickerScale;

  String get glyph => String.fromCharCode(codePoint);
  String get token =>
      'smufl:${codePoint.toRadixString(16).toUpperCase()}:$label';
}

const musicNotationSymbols = <MusicNotationSymbol>[
  MusicNotationSymbol(
    codePoint: 0xE4CE,
    label: 'Breath mark',
    category: 'Breath & pauses',
    scale: 1.2,
  ),
  MusicNotationSymbol(
    codePoint: 0xE4CF,
    label: 'Breath tick',
    category: 'Breath & pauses',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE4D1,
    label: 'Caesura',
    category: 'Breath & pauses',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE4D3,
    label: 'Short caesura',
    category: 'Breath & pauses',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE4C0,
    label: 'Fermata',
    category: 'Breath & pauses',
    scale: 1.2,
  ),
  MusicNotationSymbol(
    codePoint: 0xE4C1,
    label: 'Fermata below',
    category: 'Breath & pauses',
    scale: 1.2,
  ),
  MusicNotationSymbol(
    codePoint: 0xE4A0,
    label: 'Accent',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4A2,
    label: 'Staccato',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4A4,
    label: 'Tenuto',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4A6,
    label: 'Staccatissimo',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4AC,
    label: 'Marcato',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4B2,
    label: 'Louré',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE520,
    label: 'p',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE52B,
    label: 'pp',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE52C,
    label: 'mp',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE52D,
    label: 'mf',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE522,
    label: 'f',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE52F,
    label: 'ff',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE524,
    label: 'sfz',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE53E,
    label: 'Crescendo',
    category: 'Dynamics',
    scale: 1.05,
  ),
  MusicNotationSymbol(
    codePoint: 0xE53F,
    label: 'Diminuendo',
    category: 'Dynamics',
    scale: 1.05,
  ),
  MusicNotationSymbol(
    codePoint: 0xE260,
    label: 'Flat',
    category: 'Accidentals',
  ),
  MusicNotationSymbol(
    codePoint: 0xE261,
    label: 'Natural',
    category: 'Accidentals',
  ),
  MusicNotationSymbol(
    codePoint: 0xE262,
    label: 'Sharp',
    category: 'Accidentals',
  ),
  MusicNotationSymbol(
    codePoint: 0xE263,
    label: 'Double sharp',
    category: 'Accidentals',
  ),
  MusicNotationSymbol(
    codePoint: 0xE264,
    label: 'Double flat',
    category: 'Accidentals',
  ),
  MusicNotationSymbol(
    codePoint: 0xE047,
    label: 'Segno',
    category: 'Navigation',
    scale: 1.2,
    pickerScale: .72,
  ),
  MusicNotationSymbol(
    codePoint: 0xE048,
    label: 'Coda',
    category: 'Navigation',
    scale: 1.2,
    pickerScale: .72,
  ),
  MusicNotationSymbol(
    codePoint: 0xE040,
    label: 'Start repeat',
    category: 'Navigation',
    scale: 1.15,
    pickerScale: .78,
  ),
  MusicNotationSymbol(
    codePoint: 0xE041,
    label: 'End repeat',
    category: 'Navigation',
    scale: 1.15,
    pickerScale: .78,
  ),
  MusicNotationSymbol(
    codePoint: 0xE050,
    label: 'Treble clef',
    category: 'Clefs',
    scale: 1.25,
    pickerScale: .56,
  ),
  MusicNotationSymbol(
    codePoint: 0xE062,
    label: 'Bass clef',
    category: 'Clefs',
    scale: 1.25,
    pickerScale: .68,
  ),
  MusicNotationSymbol(
    codePoint: 0xE05C,
    label: 'C clef',
    category: 'Clefs',
    scale: 1.25,
    pickerScale: .62,
  ),
  MusicNotationSymbol(
    codePoint: 0xE0A2,
    label: 'Whole notehead',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE0A3,
    label: 'Half notehead',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE0A4,
    label: 'Black notehead',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE0A9,
    label: 'X notehead',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4E3,
    label: 'Whole rest',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4E4,
    label: 'Half rest',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4E5,
    label: 'Quarter rest',
    category: 'Notes & rests',
    scale: 1.1,
  ),
  MusicNotationSymbol(
    codePoint: 0xE4E6,
    label: 'Eighth rest',
    category: 'Notes & rests',
    scale: 1.1,
  ),
  MusicNotationSymbol(
    codePoint: 0xE4D0,
    label: 'Upbow breath',
    category: 'Breath & pauses',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4D2,
    label: 'Thick caesura',
    category: 'Breath & pauses',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4D4,
    label: 'Curved caesura',
    category: 'Breath & pauses',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4D7,
    label: 'Single caesura',
    category: 'Breath & pauses',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4C2,
    label: 'Very short fermata',
    category: 'Breath & pauses',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4C4,
    label: 'Short fermata',
    category: 'Breath & pauses',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4C6,
    label: 'Long fermata',
    category: 'Breath & pauses',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4C8,
    label: 'Very long fermata',
    category: 'Breath & pauses',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4B0,
    label: 'Accent staccato',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4B4,
    label: 'Tenuto accent',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4AE,
    label: 'Marcato staccato',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4BA,
    label: 'Let ring',
    category: 'Articulations',
  ),
  MusicNotationSymbol(
    codePoint: 0xE530,
    label: 'fff',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE531,
    label: 'ffff',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE52A,
    label: 'ppp',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE534,
    label: 'fp',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE526,
    label: 'fz',
    category: 'Dynamics',
    scale: 1.15,
  ),
  MusicNotationSymbol(
    codePoint: 0xE4E7,
    label: '16th rest',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4E8,
    label: '32nd rest',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE4E9,
    label: '64th rest',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE1D2,
    label: 'Quarter note',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE1D3,
    label: 'Eighth note',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE1D5,
    label: '16th note',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE1E7,
    label: 'Beamed eighths',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE1F0,
    label: 'Dotted eighths',
    category: 'Notes & rests',
  ),
  MusicNotationSymbol(
    codePoint: 0xE220,
    label: 'Single tremolo',
    category: 'Ornaments & technique',
  ),
  MusicNotationSymbol(
    codePoint: 0xE221,
    label: 'Double tremolo',
    category: 'Ornaments & technique',
  ),
  MusicNotationSymbol(
    codePoint: 0xE222,
    label: 'Triple tremolo',
    category: 'Ornaments & technique',
  ),
  MusicNotationSymbol(
    codePoint: 0xE566,
    label: 'Trill',
    category: 'Ornaments & technique',
  ),
  MusicNotationSymbol(
    codePoint: 0xE567,
    label: 'Turn',
    category: 'Ornaments & technique',
  ),
  MusicNotationSymbol(
    codePoint: 0xE56D,
    label: 'Mordent',
    category: 'Ornaments & technique',
  ),
  MusicNotationSymbol(
    codePoint: 0xE610,
    label: 'Down bow',
    category: 'Ornaments & technique',
  ),
  MusicNotationSymbol(
    codePoint: 0xE612,
    label: 'Up bow',
    category: 'Ornaments & technique',
  ),
  MusicNotationSymbol(
    codePoint: 0xE614,
    label: 'Harmonic',
    category: 'Ornaments & technique',
  ),
  MusicNotationSymbol(
    codePoint: 0xE650,
    label: 'Pedal',
    category: 'Keyboard & octave',
  ),
  MusicNotationSymbol(
    codePoint: 0xE655,
    label: 'Release pedal',
    category: 'Keyboard & octave',
  ),
  MusicNotationSymbol(
    codePoint: 0xE510,
    label: '8va',
    category: 'Keyboard & octave',
  ),
  MusicNotationSymbol(
    codePoint: 0xE512,
    label: '8vb',
    category: 'Keyboard & octave',
  ),
  MusicNotationSymbol(
    codePoint: 0xE514,
    label: '15ma',
    category: 'Keyboard & octave',
  ),
  MusicNotationSymbol(
    codePoint: 0xE516,
    label: '15mb',
    category: 'Keyboard & octave',
  ),
];

const choralAnnotationStamps = <String>[
  'NO BREATH',
  'TUNE',
  'VOWEL',
  'WATCH',
  'CONSONANT',
  'DYNAMIC',
  'RHYTHM',
  'INTONATION',
  'LIFT',
  'MATCH',
  'BLEND',
  'ENERGY',
];

bool isSmuflStamp(String? value) => value?.startsWith('smufl:') ?? false;

int? smuflCodePointFromStamp(String? value) {
  if (!isSmuflStamp(value)) return null;
  final parts = value!.split(':');
  if (parts.length < 2) return null;
  return int.tryParse(parts[1], radix: 16);
}

String smuflGlyphFromStamp(String? value) {
  final codePoint = smuflCodePointFromStamp(value);
  return codePoint == null ? '' : String.fromCharCode(codePoint);
}

String smuflLabelFromStamp(String? value) {
  if (!isSmuflStamp(value)) return value ?? '';
  final parts = value!.split(':');
  if (parts.length <= 2) return 'Music symbol';
  return parts.sublist(2).join(':');
}

MusicNotationSymbol? musicNotationSymbolForStamp(String? value) {
  final codePoint = smuflCodePointFromStamp(value);
  if (codePoint == null) return null;
  for (final symbol in musicNotationSymbols) {
    if (symbol.codePoint == codePoint) return symbol;
  }
  return null;
}
