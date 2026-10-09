function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function mockSvg(label: string, hue: number, height = 1200): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}" viewBox="0 0 800 ${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 60% 35%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 15%)"/></linearGradient></defs>
<rect width="800" height="${height}" fill="url(#g)"/>
<text x="400" y="${height / 2}" font-family="sans-serif" font-size="56" fill="#fff" text-anchor="middle">${esc(label)}</text>
</svg>`;
}
