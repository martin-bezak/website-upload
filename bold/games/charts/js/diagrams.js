/* Small schematic drawings for the pattern library: the price path (thick), the pattern lines (thin),
   the breakout point and an arrow to the textbook target. viewBox 0 0 160 90, y grows downwards. */

const D = {
  head_shoulders: { path: '8,72 30,40 42,54 62,18 82,54 96,40 112,60 124,70', lines: ['34,56 116,58'], arrow: '124,70 150,86' },
  inverse_head_shoulders: { path: '8,18 30,50 42,36 62,72 82,36 96,50 112,30 124,20', lines: ['34,34 116,32'], arrow: '124,20 150,4' },
  double_top: { path: '8,74 36,20 60,50 84,20 104,52 120,66', lines: ['56,50 120,50'], arrow: '120,66 150,84' },
  double_bottom: { path: '8,16 36,70 60,40 84,70 104,38 120,24', lines: ['56,40 120,40'], arrow: '120,24 150,6' },
  bull_flag: { path: '8,80 20,76 52,20 60,30 68,24 76,34 84,28 92,20', lines: ['52,18 92,26', '58,34 92,40'], arrow: '92,20 140,4' },
  bear_flag: { path: '8,10 20,14 52,70 60,60 68,66 76,56 84,62 92,70', lines: ['52,72 92,64', '58,56 92,50'], arrow: '92,70 140,86' },
  ascending_triangle: { path: '8,78 26,26 40,62 58,26 72,48 88,26 98,38 110,16', lines: ['22,26 108,26', '40,62 98,38'], arrow: '110,16 146,4' },
  descending_triangle: { path: '8,12 26,64 40,28 58,64 72,42 88,64 98,52 110,74', lines: ['22,64 108,64', '40,28 98,52'], arrow: '110,74 146,86' },
  symmetrical_triangle: { path: '8,46 24,12 40,72 58,22 74,60 90,32 102,48 114,24', lines: ['24,12 112,40', '40,72 112,50'], arrow: '114,24 148,6' },
  cup_handle: { path: '8,30 18,22 34,52 52,66 70,66 88,50 104,22 114,32 122,28 130,16', lines: ['18,22 128,22'], arrow: '130,16 152,4' }
};

export function diagram(pattern) {
  const d = D[pattern];
  if (!d) return '';
  const [ax1, ay1, ax2, ay2] = d.arrow.split(/[ ,]/).map(Number);
  return `<svg viewBox="0 0 160 90" class="cg-diagram" aria-hidden="true">
    ${d.lines.map(l => { const [x1, y1, x2, y2] = l.split(/[ ,]/); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="cg-d-line"/>`; }).join('')}
    <polyline points="${d.path}" class="cg-d-path"/>
    <line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" class="cg-d-arrow"/>
    <circle cx="${ax2}" cy="${ay2}" r="3" class="cg-d-target"/>
  </svg>`;
}
