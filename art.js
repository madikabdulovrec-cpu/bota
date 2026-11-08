// Illustrations and icons of the «Дала» style. People and Bota keep their own
// skin and clothing colours; everything themed takes colours from CSS tokens.
import { html } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';

const ICONS = {
  back: 'M15 18l-6-6 6-6',
  next: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M20 6L9 17l-5-5',
  send: 'M12 19V5M5.5 11.5L12 5l6.5 6.5',
  lock: 'M5 11h14v9H5zM8 11V7a4 4 0 0 1 8 0v4',
  chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z',
  ear: 'M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3-2.2 4-3.2 5.6-.8 1.3-.9 2.7-2.3 3.6-1.6 1-3.6.4-4.3-1.2M9.5 10a2.5 2.5 0 0 1 5 0c0 1.4-1.4 1.9-1.9 2.9',
  mic: 'M9 2.5h6v12H9zM5 11a7 7 0 0 0 14 0M12 18v3.5',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  circle: 'M3 19a9 9 0 0 1 18 0M7 19a5 5 0 0 1 10 0',
  heart: 'M12 20s-7-4.3-9.3-8.5C1.2 8.6 3 5.5 6.2 5.2c2-.2 3.9.8 5.8 3 1.9-2.2 3.8-3.2 5.8-3 3.2.3 5 3.4 3.5 6.3C19 15.7 12 20 12 20z',
  user: 'M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
  search: 'M4 11a7 7 0 1 0 14 0 7 7 0 1 0-14 0M20 20l-3.8-3.8',
  ornament: 'M12 21V12.5M12 12.5C12 7.5 7.6 5.6 5.2 8.2C3.6 10 4.6 12.8 7 12.6C8.6 12.5 9.2 10.8 8.2 10M12 12.5C12 7.5 16.4 5.6 18.8 8.2C20.4 10 19.4 12.8 17 12.6C15.4 12.5 14.8 10.8 15.8 10M8.5 17.5h7',
  basket: 'M3 9.5h18l-1.9 9.5H4.9zM7.5 9.5L12 4l4.5 5.5',
  cup: 'M4 9h12v5a6 6 0 0 1-12 0V9zM16 10h1.8a2.7 2.7 0 0 1 0 5.4H16',
  car: 'M4 15l1.8-6.5h12.4L20 15M3 15h18v3.5H3z',
  refresh: 'M20 11a8 8 0 0 0-14.3-4.6L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.6L20 16M20 20v-4h-4',
  flag: 'M5 21V4M5 4h12.5l-2.5 4.5 2.5 4.5H5',
  // Situations of the phrasebook: a shopping bag, the cross of a clinic, a pill, a bank card, a case.
  bag: 'M5.5 8h13l-1 12.5h-11zM9 8V6.5a3 3 0 0 1 6 0V8',
  plus: 'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z',
  pill: 'M10.6 20.4a4.9 4.9 0 0 1-7-7l6.8-6.8a4.9 4.9 0 0 1 7 7zM7 10l7 7',
  card: 'M3 6h18v12H3zM3 10h18M7 14.5h4',
  case: 'M3.5 8h17v11.5h-17zM9 8V5.5h6V8M3.5 13h17',
  // A рубеж: a rhombus within a rhombus, as in the ornaments of felt.
  gate: 'M12 2.8L21.2 12 12 21.2 2.8 12zM12 8.4L15.6 12 12 15.6 8.4 12z',
  phone: 'M7 2.5h10a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1zM12 7v7M9 11l3 3 3-3M10.5 18.5h3',
  file: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4zM14 3v4h4M9.5 14.5l2.5 2.5 2.5-2.5M12 10v7',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  calendar: 'M4 5.5h16v15H4zM4 10.5h16M8.5 3v5M15.5 3v5M8 14.5h2.5M13.5 14.5H16',
  speaker: 'M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  sound: 'M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
};

export function Icon({ name, size = 22, stroke = 2, label }) {
  const d = ICONS[name];
  return html`<svg class="ic" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" role=${label ? 'img' : null}
    aria-label=${label || null} aria-hidden=${label ? null : 'true'}><path d=${d}></path></svg>`;
}

export function PlayGlyph({ size = 14 }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12-7.4a1 1 0 0 0 0-1.72l-12-7.4A1 1 0 0 0 7 4.6z" fill="currentColor"></path></svg>`;
}

export function SpeakerGlyph({ size = 16 }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path></svg>`;
}

export function Sun({ size = 18 }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="stroke: var(--gold)">
    <circle cx="12" cy="12" r="4.3" style="fill: var(--gold-sun)"></circle>
    <path d="M12 2.6v2.5M12 18.9v2.5M2.6 12h2.5M18.9 12h2.5M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8"></path></svg>`;
}

export function Logo({ size = 28 }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" style="fill: var(--gold-wash)"></circle>
    <path d="M9.6 4.8v14.4M14.4 4.8v14.4M4.8 9.6h14.4M4.8 14.4h14.4" stroke-width="1.6" stroke-linecap="round" style="stroke: var(--gold-deep)"></path>
    <circle cx="12" cy="12" r="8.5" fill="none" stroke-width="2.2" style="stroke: var(--gold)"></circle></svg>`;
}

export function Bota({ size = 32, smile = true }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 120 120" aria-hidden="true" class="bota">
    <circle cx="60" cy="60" r="58" fill="#FBF1D9"></circle>
    <ellipse cx="31" cy="40" rx="9" ry="13" fill="#E9B86F" transform="rotate(-24 31 40)"></ellipse>
    <ellipse cx="89" cy="40" rx="9" ry="13" fill="#E9B86F" transform="rotate(24 89 40)"></ellipse>
    <circle cx="60" cy="64" r="36" fill="#EDBE7A"></circle>
    <ellipse cx="60" cy="79" rx="20" ry="14" fill="#F8E3B8"></ellipse>
    <circle cx="44" cy="60" r="5.5" fill="#2A1E12"></circle>
    <circle cx="76" cy="60" r="5.5" fill="#2A1E12"></circle>
    ${smile ? html`<path d="M53 87 Q60 93 67 87" stroke="#8A5A24" stroke-width="3.5" stroke-linecap="round" fill="none"></path>` : null}
  </svg>`;
}

const FACES = {
  aje: () => html`
    <circle cx="23" cy="23" r="23" fill="#FBF1D9"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#8F3E0D"></path>
    <path d="M13.4 22.5 C13.4 13.8 17.5 10.4 23 10.4 C28.5 10.4 32.6 13.8 32.6 22.5 C32.6 27.4 29.8 30.4 26.2 31.4 L23 32.2 L19.8 31.4 C16.2 30.4 13.4 27.4 13.4 22.5 Z" fill="#FFFFFF" stroke="#E3D3B8" stroke-width="0.9"></path>
    <ellipse cx="23" cy="22.4" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <circle cx="20.7" cy="21.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="21.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.8 25.3 Q23 26.9 25.2 25.3" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  erlan: () => html`
    <circle cx="23" cy="23" r="23" fill="#D9EFF2"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#0B7D8D"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#D9A273"></circle>
    <path d="M15.1 19.6 C14.9 13 18.5 10.7 23 10.7 C27.5 10.7 31.1 13 30.9 19.6 C29.6 16.4 26.8 15.3 23 15.3 C19.2 15.3 16.4 16.4 15.1 19.6 Z" fill="#2A1E12"></path>
    <circle cx="20.2" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.4 24.6 Q23 26.5 25.6 24.6" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  aigerim: () => html`
    <circle cx="23" cy="23" r="23" fill="#FBEADF"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#3E63C8"></path>
    <path d="M13.6 24.5 C13.4 15 17.8 11.2 23 11.2 C28.2 11.2 32.6 15 32.4 24.5 L33 33 C30.4 31.6 29.5 28.6 29.3 25.6 L16.7 25.6 C16.5 28.6 15.6 31.6 13 33 Z" fill="#2A1E12"></path>
    <ellipse cx="23" cy="22.6" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <path d="M16.6 21.4 C17 16.8 19.8 14.6 23 14.6 C26.2 14.6 29 16.8 29.4 21.4 C27.4 19.2 25.4 18.4 23 18.4 C20.6 18.4 18.6 19.2 16.6 21.4 Z" fill="#2A1E12"></path>
    <circle cx="20.7" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26 Q23 27.5 25.1 26" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  dana: () => html`
    <circle cx="23" cy="23" r="23" fill="#E7F1E4"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#D86A27"></path>
    <path d="M14 22 C13.6 14.2 17.8 11 23 11 C28.2 11 32.4 14.2 32 22 C31.2 19 28 16.6 23 16.6 C18 16.6 14.8 19 14 22 Z" fill="#5A3A1E"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E1AE82"></ellipse>
    <path d="M30.4 15.6 C34.2 16.6 35.4 20.6 33.4 24.4 C33.2 21.2 31.8 18.8 29.6 17.6 Z" fill="#5A3A1E"></path>
    <circle cx="20.7" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26.2 Q23 27.7 25.1 26.2" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  dauren: () => html`
    <circle cx="23" cy="23" r="23" fill="#E3EEF9"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#D86A27"></path>
    <path d="M18.2 33.4 L23 37.4 L27.8 33.4" fill="none" stroke="#F4E9D7" stroke-width="1.4"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="21.2" r="7.9" fill="#D9A273"></circle>
    <path d="M15 18.4 C15 12.8 18.6 10.4 23 10.4 C27.4 10.4 31 12.8 31 18.4 Z" fill="#0B7D8D"></path>
    <path d="M14.6 18.2 H34.2 C34.2 19.8 33.2 20.6 31.6 20.6 H14.6 Z" fill="#086472"></path>
    <circle cx="20.2" cy="22.2" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="22.2" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.4 25.4 Q23 27.3 25.6 25.4" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  bauyrzhan: () => html`
    <circle cx="23" cy="23" r="23" fill="#EAF2E3"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#2B4699"></path>
    <path d="M20.4 33.2 L23 36.6 L25.6 33.2 Z" fill="#FFFFFF"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#E1AE82"></circle>
    <path d="M15.1 19.2 C14.8 12.6 18.4 10.4 23 10.4 C27.6 10.4 31.2 12.6 30.9 19.2 C30 16.6 27.6 15.6 23 15.8 C19.2 16 16.4 16.8 15.1 19.2 Z" fill="#2A1E12"></path>
    <circle cx="20.3" cy="21.4" r="2.3" fill="none" stroke="#2A1E12" stroke-width="0.9"></circle>
    <circle cx="25.7" cy="21.4" r="2.3" fill="none" stroke="#2A1E12" stroke-width="0.9"></circle>
    <path d="M22.6 21.4 H23.4" stroke="#2A1E12" stroke-width="0.9"></path>
    <circle cx="20.3" cy="21.5" r="0.85" fill="#2A1E12"></circle>
    <circle cx="25.7" cy="21.5" r="0.85" fill="#2A1E12"></circle>
    <path d="M20.6 25.2 Q23 26.9 25.4 25.2" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  gulnar: () => html`
    <circle cx="23" cy="23" r="23" fill="#FBEADF"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#0B7D8D"></path>
    <path d="M13.4 22.5 C13.4 13.8 17.5 10.4 23 10.4 C28.5 10.4 32.6 13.8 32.6 22.5 C32.6 27.4 29.8 30.4 26.2 31.4 L23 32.2 L19.8 31.4 C16.2 30.4 13.4 27.4 13.4 22.5 Z" fill="#C44536"></path>
    <path d="M16 15.6 C19.5 13.6 26.5 13.6 30 15.6" fill="none" stroke="#F6CF6B" stroke-width="1.1" stroke-dasharray="1.6 1.6"></path>
    <ellipse cx="23" cy="22.4" rx="6.3" ry="7.1" fill="#E1AE82"></ellipse>
    <circle cx="20.7" cy="21.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="21.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.8 25.3 Q23 26.9 25.2 25.3" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  ata: () => html`
    <circle cx="23" cy="23" r="23" fill="#F3EBDD"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#4A5960"></path>
    <path d="M23 33 L19 38.6 M23 33 L27 38.6" stroke="#E8A013" stroke-width="1.2"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="21.6" r="7.7" fill="#E1AE82"></circle>
    <path d="M16.2 23.4 C16.6 30.2 19.8 33.2 23 33.2 C26.2 33.2 29.4 30.2 29.8 23.4 C28.2 26.4 25.8 27.4 23 27.4 C20.2 27.4 17.8 26.4 16.2 23.4 Z" fill="#F1EEE8"></path>
    <path d="M20 26.2 Q23 25 26 26.2" fill="none" stroke="#D9D3C8" stroke-width="1.4" stroke-linecap="round"></path>
    <path d="M15.6 17.4 C16 11.6 19.2 8.6 23 8.6 C26.8 8.6 30 11.6 30.4 17.4 Z" fill="#FFFFFF" stroke="#C9BBA0" stroke-width="0.8"></path>
    <path d="M14.2 17.2 H31.8 C31.8 18.8 30.6 19.6 29 19.6 H17 C15.4 19.6 14.2 18.8 14.2 17.2 Z" fill="#2A1E12"></path>
    <circle cx="20.4" cy="22.2" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.6" cy="22.2" r="0.95" fill="#2A1E12"></circle>`,
  madina: () => html`
    <circle cx="23" cy="23" r="23" fill="#FCE9EF"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#B4561C"></path>
    <circle cx="23" cy="9.6" r="4.4" fill="#2A1E12"></circle>
    <path d="M14.4 23 C14 15 18 11.6 23 11.6 C28 11.6 32 15 31.6 23 C30.6 19.4 27.4 17.6 23 17.6 C18.6 17.6 15.4 19.4 14.4 23 Z" fill="#2A1E12"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <path d="M16.8 20.6 C17.6 17.4 20 16 23 16 C26 16 28.4 17.4 29.2 20.6 C27.4 19.2 25.4 18.8 23 18.8 C20.6 18.8 18.6 19.2 16.8 20.6 Z" fill="#2A1E12"></path>
    <circle cx="20.7" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26.2 Q23 27.7 25.1 26.2" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  nurlan: () => html`
    <circle cx="23" cy="23" r="23" fill="#E8F0F2"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#086472"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="21" r="7.9" fill="#D9A273"></circle>
    <path d="M15.4 17.6 C15.8 12.8 19 10.6 23 10.6 C27 10.6 30.2 12.8 30.6 17.6 Z" fill="#8F3E0D"></path>
    <path d="M16.6 15.4 C20 14 26 14 29.4 15.4" fill="none" stroke="#E8A013" stroke-width="1"></path>
    <circle cx="20.2" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <path d="M19.8 24.8 C21 23.9 22.2 24.2 23 24.8 C23.8 24.2 25 23.9 26.2 24.8" fill="none" stroke="#2A1E12" stroke-width="1.3" stroke-linecap="round"></path>
    <path d="M21.2 26.6 Q23 27.6 24.8 26.6" fill="none" stroke="#6E4520" stroke-width="1" stroke-linecap="round"></path>`,
  askhat: () => html`
    <circle cx="23" cy="23" r="23" fill="#E6F4F1"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#FFFFFF" stroke="#C7D1D6" stroke-width="0.8"></path>
    <path d="M19.6 33.2 L23 38.4 L26.4 33.2" fill="#3E63C8"></path>
    <path d="M17.6 33.6 C16.6 36.4 18 38.6 20.4 38.6" fill="none" stroke="#2B4699" stroke-width="1.1"></path>
    <circle cx="20.6" cy="38.6" r="1.1" fill="#2B4699"></circle>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#E7B48A"></circle>
    <path d="M15.1 19.4 C14.9 12.8 18.5 10.5 23 10.5 C27.5 10.5 31.1 12.8 30.9 19.4 C29.8 16.8 27.6 15.4 25.4 15.4 C23.6 16.6 18.6 17 15.1 19.4 Z" fill="#3A2516"></path>
    <circle cx="20.2" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.4 24.6 Q23 26.5 25.6 24.6" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  saule: () => html`
    <circle cx="23" cy="23" r="23" fill="#FFF3D9"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#2E8B57"></path>
    <path d="M14 25 C13.6 15.6 17.6 11.4 23 11.4 C28.4 11.4 32.4 15.6 32 25 C30.8 23.6 30.4 21.2 30 19.4 C27.8 20.2 25.4 20.6 23 20.6 C20.2 20.6 17.8 20 16 19.4 C15.6 21.2 15.2 23.6 14 25 Z" fill="#3A2516"></path>
    <ellipse cx="23" cy="22.8" rx="6.2" ry="7" fill="#E1AE82"></ellipse>
    <path d="M16.8 20.8 C18.6 17.4 21 16.4 23.6 16.6 C26.4 16.8 28.4 18.2 29.4 21 C27 19.6 24.6 19.4 22.4 19.6 C20.4 19.8 18.4 20.2 16.8 20.8 Z" fill="#3A2516"></path>
    <circle cx="20.7" cy="22.9" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.9" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26.2 Q23 27.7 25.1 26.2" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  // Level A2, the city.
  zaure: () => html`
    <circle cx="23" cy="23" r="23" fill="#EAF2E3"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#3E63C8"></path>
    <path d="M13.4 22.5 C13.4 13.8 17.5 10.4 23 10.4 C28.5 10.4 32.6 13.8 32.6 22.5 C32.6 27.4 29.8 30.4 26.2 31.4 L23 32.2 L19.8 31.4 C16.2 30.4 13.4 27.4 13.4 22.5 Z" fill="#E8A013"></path>
    <circle cx="16.4" cy="18" r="0.9" fill="#FFFFFF"></circle>
    <circle cx="23" cy="12.8" r="0.9" fill="#FFFFFF"></circle>
    <circle cx="29.6" cy="18" r="0.9" fill="#FFFFFF"></circle>
    <ellipse cx="23" cy="22.4" rx="6.3" ry="7.1" fill="#D9A273"></ellipse>
    <circle cx="20.7" cy="21.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="21.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.8 25.3 Q23 26.9 25.2 25.3" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  aliya: () => html`
    <circle cx="23" cy="23" r="23" fill="#E3EEF9"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#0B7D8D"></path>
    <rect x="27" y="34.4" width="5" height="2.6" rx="0.6" fill="#FFFFFF"></rect>
    <path d="M30.6 14 C35.4 14.4 36.8 20 34.8 26.6 C34 22.6 32.4 19.4 29.8 17.6 Z" fill="#2A1E12"></path>
    <path d="M14.6 22 C14.2 14.4 18.2 11.2 23 11.2 C27.8 11.2 31.8 14.4 31.4 22 C30.4 18.6 27.4 16.6 23 16.6 C18.6 16.6 15.6 18.6 14.6 22 Z" fill="#2A1E12"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <path d="M16.8 20.6 C17.8 17.2 20.2 15.8 23.4 16 C26.4 16.2 28.6 17.8 29.4 20.8 C27.2 19.2 25 18.8 22.8 18.9 C20.6 19 18.6 19.6 16.8 20.6 Z" fill="#2A1E12"></path>
    <circle cx="20.7" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26.2 Q23 27.7 25.1 26.2" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  serik: () => html`
    <circle cx="23" cy="23" r="23" fill="#FBF1D9"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#2E3E45"></path>
    <path d="M19.4 33.2 L23 36.4 L26.6 33.2" fill="none" stroke="#9AA7AD" stroke-width="1.2"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#D9A273"></circle>
    <path d="M15.1 18.8 C15 12.6 18.6 10.4 23 10.4 C27.4 10.4 31 12.6 30.9 18.8 C29.4 16 26.6 15 23 15 C19.4 15 16.6 16 15.1 18.8 Z" fill="#1F1610"></path>
    <circle cx="20.2" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <path d="M19.6 24.6 C21 23.6 22.2 23.9 23 24.5 C23.8 23.9 25 23.6 26.4 24.6" fill="none" stroke="#1F1610" stroke-width="1.5" stroke-linecap="round"></path>
    <path d="M21.4 26.6 Q23 27.4 24.6 26.6" fill="none" stroke="#6E4520" stroke-width="1" stroke-linecap="round"></path>`,
  zhansaya: () => html`
    <circle cx="23" cy="23" r="23" fill="#FCE9EF"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#D86A27"></path>
    <path d="M13.6 24.5 C13.4 15 17.8 11.2 23 11.2 C28.2 11.2 32.6 15 32.4 24.5 L33 33 C30.4 31.6 29.5 28.6 29.3 25.6 L16.7 25.6 C16.5 28.6 15.6 31.6 13 33 Z" fill="#3A2516"></path>
    <ellipse cx="23" cy="22.6" rx="6.3" ry="7.1" fill="#E1AE82"></ellipse>
    <path d="M16.6 21.4 C17 16.8 19.8 14.6 23 14.6 C26.2 14.6 29 16.8 29.4 21.4 C27.4 19.2 25.4 18.4 23 18.4 C20.6 18.4 18.6 19.2 16.6 21.4 Z" fill="#3A2516"></path>
    <path d="M14.4 21 C14.4 13.4 18.4 9.6 23 9.6 C27.6 9.6 31.6 13.4 31.6 21" fill="none" stroke="#3E63C8" stroke-width="1.6"></path>
    <rect x="12.6" y="19.4" width="3.4" height="5.4" rx="1.6" fill="#3E63C8"></rect>
    <rect x="30" y="19.4" width="3.4" height="5.4" rx="1.6" fill="#3E63C8"></rect>
    <circle cx="20.7" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26 Q23 27.5 25.1 26" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  murat: () => html`
    <circle cx="23" cy="23" r="23" fill="#E6F4F1"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#4A5960"></path>
    <path d="M16.6 32.6 C20 34.6 26 34.6 29.4 32.6 L28.6 35.6 C25 36.8 21 36.8 17.4 35.6 Z" fill="#C44536"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#E1AE82"></circle>
    <path d="M15.6 22.4 C15.8 28.6 19 31.2 23 31.2 C27 31.2 30.2 28.6 30.4 22.4 C29.2 25.6 26.4 26.6 23 26.6 C19.6 26.6 16.8 25.6 15.6 22.4 Z" fill="#3A2516"></path>
    <path d="M15.1 19 C14.9 12.6 18.5 10.4 23 10.4 C27.5 10.4 31.1 12.6 30.9 19 C29.6 16 26.8 15.2 23 15.2 C19.2 15.2 16.4 16 15.1 19 Z" fill="#3A2516"></path>
    <circle cx="20.2" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <path d="M21 27.2 Q23 28.4 25 27.2" fill="none" stroke="#F4E9D7" stroke-width="1.1" stroke-linecap="round"></path>`,
  arman: () => html`
    <circle cx="23" cy="23" r="23" fill="#FFF3D9"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#2A1E12"></path>
    <path d="M19.4 33.1 L23 38.6 L26.6 33.1 Z" fill="#FFFFFF"></path>
    <path d="M20.4 33.6 L23 34.8 L25.6 33.6 L25.6 36 L23 34.8 L20.4 36 Z" fill="#C44536"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#D9A273"></circle>
    <path d="M15.1 19.4 C14.9 12.8 18.5 10.5 23 10.5 C27.5 10.5 31.1 12.8 30.9 19.4 C30 15.6 26.6 14.6 21.6 15.4 C19.4 15.8 16.6 17 15.1 19.4 Z" fill="#2A1E12"></path>
    <circle cx="20.2" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.4 24.6 Q23 26.5 25.6 24.6" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  zhanar: () => html`
    <circle cx="23" cy="23" r="23" fill="#E3EEF9"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#FFFFFF" stroke="#C7D1D6" stroke-width="0.8"></path>
    <path d="M19.8 32 L23 37 L26.2 32" fill="#0B7D8D"></path>
    <path d="M27.4 32.6 C28.6 35.4 27.4 37.8 25 37.8" fill="none" stroke="#2B4699" stroke-width="1.1"></path>
    <circle cx="25" cy="37.8" r="1.1" fill="#2B4699"></circle>
    <circle cx="23" cy="9.8" r="4" fill="#3A2516"></circle>
    <path d="M14.4 23 C14 15 18 11.6 23 11.6 C28 11.6 32 15 31.6 23 C30.6 19.4 27.4 17.6 23 17.6 C18.6 17.6 15.4 19.4 14.4 23 Z" fill="#3A2516"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <path d="M16.8 20.6 C17.6 17.4 20 16 23 16 C26 16 28.4 17.4 29.2 20.6 C27.4 19.2 25.4 18.8 23 18.8 C20.6 18.8 18.6 19.2 16.8 20.6 Z" fill="#3A2516"></path>
    <circle cx="20.7" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26.2 Q23 27.7 25.1 26.2" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  galiya: () => html`
    <circle cx="23" cy="23" r="23" fill="#EAF2E3"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#2E8B57"></path>
    <path d="M19.8 32 L23 36.4 L26.2 32" fill="#FFFFFF"></path>
    <path d="M14 26.4 C13.4 16 17.6 11.4 23 11.4 C28.4 11.4 32.6 16 32 26.4 L29.4 26.4 L29.4 22 L16.6 22 L16.6 26.4 Z" fill="#5A3A1E"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E1AE82"></ellipse>
    <path d="M16.6 20.4 C17.4 16.8 20 15.4 23 15.4 C26 15.4 28.6 16.8 29.4 20.4 C26.4 18.6 19.6 18.6 16.6 20.4 Z" fill="#5A3A1E"></path>
    <circle cx="20.4" cy="22.9" r="2.2" fill="none" stroke="#2A1E12" stroke-width="0.9"></circle>
    <circle cx="25.6" cy="22.9" r="2.2" fill="none" stroke="#2A1E12" stroke-width="0.9"></circle>
    <path d="M22.6 22.9 H23.4" stroke="#2A1E12" stroke-width="0.9"></path>
    <circle cx="20.4" cy="23" r="0.85" fill="#2A1E12"></circle>
    <circle cx="25.6" cy="23" r="0.85" fill="#2A1E12"></circle>
    <path d="M20.9 26.6 Q23 27.9 25.1 26.6" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  timur: () => html`
    <circle cx="23" cy="23" r="23" fill="#E8F0F2"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#2B4699"></path>
    <path d="M19.6 33.1 L23 37.6 L26.4 33.1 Z" fill="#FFFFFF"></path>
    <path d="M22.2 34 L23.8 34 L24.4 38.6 L23 39.6 L21.6 38.6 Z" fill="#C44536"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#E7B48A"></circle>
    <path d="M15.1 19.6 C14.8 12.8 18.4 10.4 23 10.4 C27.6 10.4 31.2 12.8 30.9 19.6 C30.2 16.4 28.4 15 25.8 14.8 L24.6 16.4 C21.4 15.8 17.6 16.6 15.1 19.6 Z" fill="#2A1E12"></path>
    <circle cx="20.2" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.4 24.6 Q23 26.5 25.6 24.6" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  aizhan: () => html`
    <circle cx="23" cy="23" r="23" fill="#FBEADF"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#086472"></path>
    <path d="M18 32.2 C20.4 34 25.6 34 28 32.2 L26.8 35.4 L23 33.8 L19.2 35.4 Z" fill="#E8A013"></path>
    <ellipse cx="29.8" cy="12.6" rx="3.4" ry="3" fill="#2A1E12"></ellipse>
    <path d="M14.6 22 C14.4 14 18.4 11 23 11 C27.6 11 31.6 14 31.4 22 C30.4 18 27 16.4 23 16.4 C19 16.4 15.6 18 14.6 22 Z" fill="#2A1E12"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <path d="M16.8 21 C17.4 17.4 19.8 15.6 23 15.6 C26.2 15.6 28.6 17.4 29.2 21 C26 18.4 20 18.4 16.8 21 Z" fill="#2A1E12"></path>
    <circle cx="20.7" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26.2 Q23 27.7 25.1 26.2" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  erbolat: () => html`
    <circle cx="23" cy="23" r="23" fill="#F3EBDD"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#8F3E0D"></path>
    <path d="M17.4 33.4 C20 35.2 26 35.2 28.6 33.4" fill="none" stroke="#B4561C" stroke-width="1.4"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#D9A273"></circle>
    <path d="M15.1 19.4 C14.8 12.8 18.4 10.4 23 10.4 C27.6 10.4 31.2 12.8 30.9 19.4 C29.8 16.2 27 15.2 23 15.2 C19 15.2 16.2 16.2 15.1 19.4 Z" fill="#B9B4AC"></path>
    <circle cx="20.2" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <path d="M19.6 24.6 C21 23.6 22.2 23.9 23 24.5 C23.8 23.9 25 23.6 26.4 24.6" fill="none" stroke="#9A948A" stroke-width="1.5" stroke-linecap="round"></path>
    <path d="M21.4 26.6 Q23 27.4 24.6 26.6" fill="none" stroke="#6E4520" stroke-width="1" stroke-linecap="round"></path>`,
  asem: () => html`
    <circle cx="23" cy="23" r="23" fill="#E7F1E4"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#C44536"></path>
    <circle cx="16" cy="16.2" r="4.2" fill="#5A3A1E"></circle>
    <circle cx="20.8" cy="12.6" r="4.4" fill="#5A3A1E"></circle>
    <circle cx="26.4" cy="12.8" r="4.4" fill="#5A3A1E"></circle>
    <circle cx="30.4" cy="16.8" r="4" fill="#5A3A1E"></circle>
    <circle cx="14.8" cy="22" r="3.6" fill="#5A3A1E"></circle>
    <circle cx="31.2" cy="22.4" r="3.6" fill="#5A3A1E"></circle>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#C98F5E"></ellipse>
    <circle cx="16.4" cy="26.6" r="1" fill="#E8A013"></circle>
    <circle cx="29.6" cy="26.6" r="1" fill="#E8A013"></circle>
    <circle cx="20.7" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26.2 Q23 27.7 25.1 26.2" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  // Level B1, society.
  kairat: () => html`
    <circle cx="23" cy="23" r="23" fill="#E3EEF9"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#2E3E45"></path>
    <path d="M19.6 33.1 L23 37.6 L26.4 33.1 Z" fill="#FFFFFF"></path>
    <path d="M22.2 34 L23.8 34 L24.4 38.6 L23 39.6 L21.6 38.6 Z" fill="#0B7D8D"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#D9A273"></circle>
    <path d="M15.1 19.2 C14.8 12.6 18.4 10.4 23 10.4 C27.6 10.4 31.2 12.6 30.9 19.2 C30 16.2 27.6 15.2 23 15.2 C18.4 15.2 16 16.2 15.1 19.2 Z" fill="#2A1E12"></path>
    <path d="M15.3 18.8 C15.2 17.6 15.4 16.6 15.9 15.8 M30.7 18.8 C30.8 17.6 30.6 16.6 30.1 15.8" fill="none" stroke="#9AA7AD" stroke-width="1.3"></path>
    <rect x="17.8" y="19.7" width="4.6" height="3.4" rx="1" fill="none" stroke="#2A1E12" stroke-width="0.9"></rect>
    <rect x="23.6" y="19.7" width="4.6" height="3.4" rx="1" fill="none" stroke="#2A1E12" stroke-width="0.9"></rect>
    <path d="M22.4 21.2 H23.6" stroke="#2A1E12" stroke-width="0.9"></path>
    <circle cx="20.1" cy="21.4" r="0.85" fill="#2A1E12"></circle>
    <circle cx="25.9" cy="21.4" r="0.85" fill="#2A1E12"></circle>
    <path d="M20.6 25.3 Q23 26.7 25.4 25.3" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  botagoz: () => html`
    <circle cx="23" cy="23" r="23" fill="#FCE9EF"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#8F3E0D"></path>
    <path d="M13.6 24.5 C13.4 15 17.8 11.2 23 11.2 C28.2 11.2 32.6 15 32.4 24.5 L33 33 C30.4 31.6 29.5 28.6 29.3 25.6 L16.7 25.6 C16.5 28.6 15.6 31.6 13 33 Z" fill="#2A1E12"></path>
    <ellipse cx="23" cy="22.6" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <path d="M16.6 21.4 C17 16.8 19.8 14.6 23 14.6 C26.2 14.6 29 16.8 29.4 21.4 C27.4 19.2 25.4 18.4 23 18.4 C20.6 18.4 18.6 19.2 16.6 21.4 Z" fill="#2A1E12"></path>
    <path d="M14.6 21 C14.6 13.6 18.6 10 23 10 C27.4 10 31.4 13.6 31.4 21" fill="none" stroke="#2E3E45" stroke-width="1.3"></path>
    <rect x="12.8" y="19.6" width="3.2" height="5" rx="1.5" fill="#2E3E45"></rect>
    <path d="M14.6 24.4 C15.2 27.6 17.6 28.6 20 27.8" fill="none" stroke="#2E3E45" stroke-width="1.1"></path>
    <circle cx="20.3" cy="27.7" r="0.9" fill="#2E3E45"></circle>
    <circle cx="20.7" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <path d="M21.4 25.8 Q23.2 27.2 25 25.8" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  erzhan: () => html`
    <circle cx="23" cy="23" r="23" fill="#EAF2E3"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#3E63C8"></path>
    <path d="M19 33.2 L23 36 L27 33.2" fill="none" stroke="#FFFFFF" stroke-width="1.3"></path>
    <rect x="27.4" y="35" width="4.4" height="2.4" rx="0.5" fill="#F6CF6B"></rect>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#E1AE82"></circle>
    <path d="M15.1 19.4 C14.8 12.6 18.4 10.4 23 10.4 C27.6 10.4 31.2 12.6 30.9 19.4 C30 16 27.8 14.8 24.2 15 L23.4 16.6 C20.2 16 17.2 16.8 15.1 19.4 Z" fill="#3A2516"></path>
    <circle cx="20.2" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.4" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.4 24.6 Q23 26.5 25.6 24.6" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  gulmira: () => html`
    <circle cx="23" cy="23" r="23" fill="#FFF3D9"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#2E8B57"></path>
    <path d="M19.8 32 L23 36.4 L26.2 32" fill="#FFFFFF"></path>
    <circle cx="23" cy="9.8" r="4" fill="#5A3A1E"></circle>
    <path d="M14.4 23 C14 15 18 11.6 23 11.6 C28 11.6 32 15 31.6 23 C30.6 19.4 27.4 17.6 23 17.6 C18.6 17.6 15.4 19.4 14.4 23 Z" fill="#5A3A1E"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E1AE82"></ellipse>
    <path d="M16.8 20.6 C17.6 17.4 20 16 23 16 C26 16 28.4 17.4 29.2 20.6 C27.4 19.2 25.4 18.8 23 18.8 C20.6 18.8 18.6 19.2 16.8 20.6 Z" fill="#5A3A1E"></path>
    <circle cx="20.4" cy="22.9" r="2.1" fill="none" stroke="#8F3E0D" stroke-width="0.8"></circle>
    <circle cx="25.6" cy="22.9" r="2.1" fill="none" stroke="#8F3E0D" stroke-width="0.8"></circle>
    <path d="M22.5 22.9 H23.5" stroke="#8F3E0D" stroke-width="0.8"></path>
    <circle cx="20.4" cy="23" r="0.85" fill="#2A1E12"></circle>
    <circle cx="25.6" cy="23" r="0.85" fill="#2A1E12"></circle>
    <path d="M20.9 26.6 Q23 27.9 25.1 26.6" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  samat: () => html`
    <circle cx="23" cy="23" r="23" fill="#E8F0F2"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#D86A27"></path>
    <path d="M20.6 33.4 V36.6 M25.4 33.4 V36.6" stroke="#F4E9D7" stroke-width="1" stroke-linecap="round"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#B07A50"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#C98F5E"></circle>
    <path d="M16 22.6 C16.4 27.6 19.4 29.6 23 29.6 C26.6 29.6 29.6 27.6 30 22.6 C28.6 25.4 26 26.4 23 26.4 C20 26.4 17.4 25.4 16 22.6 Z" fill="#3A2516" opacity="0.35"></path>
    <path d="M15 19.6 C14.4 12.4 18.4 9.8 23 9.8 C27.6 9.8 31.6 12.4 31 19.6 C30.4 16.4 28.6 14.4 26.4 14.6 C25.2 15.4 23.4 15.6 21.6 15.2 C19.4 14.8 16.4 16.2 15 19.6 Z" fill="#1F1610"></path>
    <circle cx="20.2" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.4 24.4 Q23 26.4 25.6 24.4" fill="none" stroke="#5A3A1E" stroke-width="1.1" stroke-linecap="round"></path>`,
  dilnaz: () => html`
    <circle cx="23" cy="23" r="23" fill="#E3EEF9"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#2B4699"></path>
    <path d="M13.6 24.5 C13.4 15 17.8 11.2 23 11.2 C28.2 11.2 32.6 15 32.4 24.5 L33 33 C30.4 31.6 29.5 28.6 29.3 25.6 L16.7 25.6 C16.5 28.6 15.6 31.6 13 33 Z" fill="#3A2516"></path>
    <ellipse cx="23" cy="22.6" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <path d="M16.6 22 C16.8 16.4 19.6 14.4 23.6 14.6 C27 14.8 29.2 16.8 29.4 19.6 C27.2 17.8 24.4 17.6 21.8 18.4 C19.6 19 17.8 20.2 16.6 22 Z" fill="#3A2516"></path>
    <circle cx="16.5" cy="27" r="1.1" fill="#E8A013"></circle>
    <circle cx="29.5" cy="27" r="1.1" fill="#E8A013"></circle>
    <circle cx="20.7" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26 Q23 27.5 25.1 26" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  aruzhan: () => html`
    <circle cx="23" cy="23" r="23" fill="#E7F1E4"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#E8A013"></path>
    <path d="M23 11 C27.4 6.4 32.6 7.2 33.4 12 C31 10.6 27.6 10.8 25.2 12.4 Z" fill="#2A1E12"></path>
    <path d="M14.6 22 C14.2 14.4 18.2 11.2 23 11.2 C27.8 11.2 31.8 14.4 31.4 22 C30.4 18.6 27.4 16.6 23 16.6 C18.6 16.6 15.6 18.6 14.6 22 Z" fill="#2A1E12"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E1AE82"></ellipse>
    <path d="M16.8 20.6 C17.8 17.2 20.2 15.8 23.4 16 C26.4 16.2 28.6 17.8 29.4 20.8 C27.2 19.2 25 18.8 22.8 18.9 C20.6 19 18.6 19.6 16.8 20.6 Z" fill="#2A1E12"></path>
    <circle cx="20.7" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26.2 Q23 27.7 25.1 26.2" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  bekzat: () => html`
    <circle cx="23" cy="23" r="23" fill="#FBF1D9"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#3E63C8"></path>
    <path d="M18.6 33.6 V39.4 M27.4 33.6 V39.4" stroke="#F6CF6B" stroke-width="1.4" stroke-linecap="round"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="21.2" r="7.9" fill="#D9A273"></circle>
    <path d="M15 18.4 C15 12.8 18.6 10.4 23 10.4 C27.4 10.4 31 12.8 31 18.4 Z" fill="#C44536"></path>
    <path d="M14.6 18.2 H34.2 C34.2 19.8 33.2 20.6 31.6 20.6 H14.6 Z" fill="#8F2F23"></path>
    <circle cx="20.2" cy="22.2" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="22.2" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.4 25.4 Q23 27.3 25.6 25.4" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  raushan: () => html`
    <circle cx="23" cy="23" r="23" fill="#FCE9EF"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#8F3E0D"></path>
    <path d="M13.4 22.5 C13.4 13.8 17.5 10.4 23 10.4 C28.5 10.4 32.6 13.8 32.6 22.5 C32.6 27.4 29.8 30.4 26.2 31.4 L23 32.2 L19.8 31.4 C16.2 30.4 13.4 27.4 13.4 22.5 Z" fill="#2E8B57"></path>
    <path d="M16 15.6 C19.5 13.6 26.5 13.6 30 15.6" fill="none" stroke="#F6CF6B" stroke-width="1.1" stroke-dasharray="1.6 1.6"></path>
    <ellipse cx="23" cy="22.4" rx="6.3" ry="7.1" fill="#D9A273"></ellipse>
    <circle cx="20.7" cy="21.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="21.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.8 25.3 Q23 26.9 25.2 25.3" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  adil: () => html`
    <circle cx="23" cy="23" r="23" fill="#E6F4F1"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#4A5960"></path>
    <path d="M19.4 33.2 L23 36.4 L26.6 33.2" fill="none" stroke="#D5DDE0" stroke-width="1.2"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="21" r="7.9" fill="#E1AE82"></circle>
    <path d="M15.2 17.6 C15.6 12.6 19 10.2 23.4 10.2 C28 10.2 31.2 12.4 31.4 16.4 L33.6 17.6 C33.6 18.6 32.8 19 31.8 19 H15.4 Z" fill="#5A3A1E"></path>
    <circle cx="20.2" cy="21.6" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.6" r="0.95" fill="#2A1E12"></circle>
    <path d="M19.6 24.8 C21 23.8 22.2 24.1 23 24.7 C23.8 24.1 25 23.8 26.4 24.8" fill="none" stroke="#9A948A" stroke-width="1.5" stroke-linecap="round"></path>
    <path d="M21.4 26.8 Q23 27.6 24.6 26.8" fill="none" stroke="#6E4520" stroke-width="1" stroke-linecap="round"></path>`,
  // Level B2, free conversation.
  nurzhan: () => html`
    <circle cx="23" cy="23" r="23" fill="#EAF2E3"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#086472"></path>
    <path d="M19.6 33.1 L23 37.4 L26.4 33.1 Z" fill="#FFFFFF"></path>
    <circle cx="27.8" cy="35.6" r="1" fill="#2A1E12"></circle>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#E1AE82"></circle>
    <path d="M15.1 19 C14.6 12.8 17.8 9.6 22.6 9.6 C27.6 9.4 31.4 12.2 30.9 19 C30.2 16.2 28.6 14.8 26.6 14.6 C24.6 13.2 21.4 13 19.2 14.2 C17.2 15.2 15.8 16.8 15.1 19 Z" fill="#2A1E12"></path>
    <circle cx="20.2" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.4 24.6 Q23 26.5 25.6 24.6" fill="none" stroke="#6E4520" stroke-width="1.1" stroke-linecap="round"></path>`,
  moldir: () => html`
    <circle cx="23" cy="23" r="23" fill="#FFF3D9"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#3E63C8"></path>
    <path d="M13.6 24.5 C13.4 15 17.8 11.2 23 11.2 C28.2 11.2 32.6 15 32.4 24.5 C32.8 27.4 31.6 29.8 30 30.6 C29.6 28.6 29.4 27 29.3 25.6 L16.7 25.6 C16.6 27 16.4 28.6 16 30.6 C14.4 29.8 13.2 27.4 13.6 24.5 Z" fill="#5A3A1E"></path>
    <ellipse cx="23" cy="22.6" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <path d="M16.6 21.4 C17 16.8 19.8 14.6 23 14.6 C26.2 14.6 29 16.8 29.4 21.4 C27.4 19.2 25.4 18.4 23 18.4 C20.6 18.4 18.6 19.2 16.6 21.4 Z" fill="#5A3A1E"></path>
    <path d="M16.2 16.4 C19.6 13.4 26.4 13.4 29.8 16.4" fill="none" stroke="#E8A013" stroke-width="1.6" stroke-linecap="round"></path>
    <circle cx="20.7" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.6 25.8 Q23 27.8 25.4 25.8" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  gauhar: () => html`
    <circle cx="23" cy="23" r="23" fill="#E3EEF9"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#2B4699"></path>
    <circle cx="19.4" cy="32.7" r="0.7" fill="#FFFFFF"></circle>
    <circle cx="21.2" cy="33.4" r="0.7" fill="#FFFFFF"></circle>
    <circle cx="23" cy="33.7" r="0.7" fill="#FFFFFF"></circle>
    <circle cx="24.8" cy="33.4" r="0.7" fill="#FFFFFF"></circle>
    <circle cx="26.6" cy="32.7" r="0.7" fill="#FFFFFF"></circle>
    <ellipse cx="23" cy="22.6" rx="6.3" ry="7.1" fill="#D9A273"></ellipse>
    <path d="M15.6 21 C15 14.4 18.6 11.2 23 11.2 C27.6 11.2 31.2 14.4 30.6 20.6 C29.4 18 27.4 16.6 24.6 16.4 C22 16.4 19.6 17.4 17.8 18.8 C16.8 19.4 16 20.2 15.6 21 Z" fill="#2A1E12"></path>
    <circle cx="20.7" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.6" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26 Q23 27.5 25.1 26" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  quanysh: () => html`
    <circle cx="23" cy="23" r="23" fill="#FBF1D9"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#8F3E0D"></path>
    <path d="M19 33.2 L23 38 L27 33.2" fill="none" stroke="#E8A013" stroke-width="1.3"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#D9A273"></circle>
    <path d="M15.8 16.8 C16.2 12 19.2 9.8 23 9.8 C26.8 9.8 29.8 12 30.2 16.8 Z" fill="#C44536"></path>
    <path d="M16.8 14.8 C19.8 13 26.2 13 29.2 14.8" fill="none" stroke="#F6CF6B" stroke-width="1.1" stroke-dasharray="1.4 1.4"></path>
    <circle cx="20.2" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.8" cy="21.2" r="0.95" fill="#2A1E12"></circle>
    <path d="M19.6 24.6 C21 23.6 22.2 23.9 23 24.5 C23.8 23.9 25 23.6 26.4 24.6" fill="none" stroke="#2A1E12" stroke-width="1.4" stroke-linecap="round"></path>
    <path d="M21 26.6 Q23 27.8 25 26.6" fill="none" stroke="#6E4520" stroke-width="1" stroke-linecap="round"></path>`,
  toqtar: () => html`
    <circle cx="23" cy="23" r="23" fill="#D9EFF2"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#2E8B57"></path>
    <path d="M19 33.2 L23 38.4 L27 33.2" fill="none" stroke="#F6CF6B" stroke-width="1.3"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#C98F5E"></rect>
    <circle cx="23" cy="21.4" r="7.7" fill="#E1AE82"></circle>
    <path d="M16 23 C16.2 31.6 19.6 35.6 23 35.6 C26.4 35.6 29.8 31.6 30 23 C28.6 26.6 26 27.6 23 27.6 C20 27.6 17.4 26.6 16 23 Z" fill="#F1EEE8"></path>
    <path d="M20 26.2 Q23 25 26 26.2" fill="none" stroke="#D9D3C8" stroke-width="1.4" stroke-linecap="round"></path>
    <path d="M16.6 17.2 L18.4 7.4 C21 6.4 25 6.4 27.6 7.4 L29.4 17.2 Z" fill="#FFFFFF" stroke="#C9BBA0" stroke-width="0.8"></path>
    <path d="M14.6 17 H31.4 L31 19.4 H15 Z" fill="#2A1E12"></path>
    <circle cx="20.4" cy="22" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.6" cy="22" r="0.95" fill="#2A1E12"></circle>`,
  zeinep: () => html`
    <circle cx="23" cy="23" r="23" fill="#FCE9EF"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#4A5960"></path>
    <path d="M19.8 32 L23 36.4 L26.2 32" fill="#FFFFFF"></path>
    <circle cx="23" cy="10" r="3.8" fill="#B9B4AC"></circle>
    <path d="M14.4 23 C14 15 18 11.6 23 11.6 C28 11.6 32 15 31.6 23 C30.6 19.4 27.4 17.6 23 17.6 C18.6 17.6 15.4 19.4 14.4 23 Z" fill="#B9B4AC"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E1AE82"></ellipse>
    <path d="M16.8 20.6 C17.6 17.4 20 16 23 16 C26 16 28.4 17.4 29.2 20.6 C27.4 19.2 25.4 18.8 23 18.8 C20.6 18.8 18.6 19.2 16.8 20.6 Z" fill="#B9B4AC"></path>
    <circle cx="20.4" cy="22.9" r="2.1" fill="none" stroke="#2A1E12" stroke-width="0.8"></circle>
    <circle cx="25.6" cy="22.9" r="2.1" fill="none" stroke="#2A1E12" stroke-width="0.8"></circle>
    <path d="M22.5 22.9 H23.5" stroke="#2A1E12" stroke-width="0.8"></path>
    <circle cx="20.4" cy="23" r="0.85" fill="#2A1E12"></circle>
    <circle cx="25.6" cy="23" r="0.85" fill="#2A1E12"></circle>
    <path d="M20.9 26.6 Q23 27.9 25.1 26.6" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
  darkhan: () => html`
    <circle cx="23" cy="23" r="23" fill="#E7F1E4"></circle>
    <path d="M7 38 C9.6 34.4 14.6 33 23 33 C31.4 33 36.4 34.4 39 38 A23 23 0 0 1 7 38 Z" fill="#E8A013"></path>
    <rect x="20.6" y="26.5" width="4.8" height="6" fill="#B07A50"></rect>
    <circle cx="23" cy="20.8" r="7.9" fill="#C98F5E"></circle>
    <path d="M15 19 L15.6 13.2 L17.8 15 L19 10.6 L21.2 13.6 L23 9.6 L24.8 13.6 L27 10.6 L28.2 15 L30.4 13.2 L31 19 C29.6 16.4 26.8 15.4 23 15.4 C19.2 15.4 16.4 16.4 15 19 Z" fill="#3A2516"></path>
    <path d="M19.2 21.6 Q20.2 20.4 21.2 21.6 M24.8 21.6 Q25.8 20.4 26.8 21.6" fill="none" stroke="#2A1E12" stroke-width="1.1" stroke-linecap="round"></path>
    <path d="M19.6 24 Q23 28.6 26.4 24 Z" fill="#8F2F23"></path>
    <path d="M20.4 24.4 H25.6" stroke="#FFFFFF" stroke-width="0.9"></path>`,
  aqmaral: () => html`
    <circle cx="23" cy="23" r="23" fill="#E8F0F2"></circle>
    <path d="M7 38 C9.8 33.6 16 31.6 23 31.6 C30 31.6 36.2 33.6 39 38 A23 23 0 0 1 7 38 Z" fill="#2E3E45"></path>
    <path d="M19.8 32 L23 36.6 L26.2 32" fill="#FFFFFF"></path>
    <path d="M30.6 21 C33.4 23 33.6 27.6 31.6 30.4 C31.4 27.4 30.8 24.6 29.6 22.8 Z" fill="#1F1610"></path>
    <path d="M14.6 23.6 C14.2 14.8 18.2 11.2 23 11.2 C27.8 11.2 31.8 14.8 31.4 23.6 C30.4 19.6 27.6 17.8 23 17.8 C18.4 17.8 15.6 19.6 14.6 23.6 Z" fill="#1F1610"></path>
    <ellipse cx="23" cy="22.8" rx="6.3" ry="7.1" fill="#E7B48A"></ellipse>
    <path d="M16.6 21.4 C17 16.8 19.8 14.8 23 14.8 C26.2 14.8 29 16.8 29.4 21.4 C27.8 19 25.6 17.8 23 17.6 C20.4 17.8 18.2 19 16.6 21.4 Z" fill="#1F1610"></path>
    <circle cx="16.5" cy="26.6" r="0.9" fill="#F6CF6B"></circle>
    <circle cx="29.5" cy="26.6" r="0.9" fill="#F6CF6B"></circle>
    <circle cx="20.7" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <circle cx="25.3" cy="22.8" r="0.95" fill="#2A1E12"></circle>
    <path d="M20.9 26.2 Q23 27.7 25.1 26.2" fill="none" stroke="#8A5A24" stroke-width="1.1" stroke-linecap="round"></path>`,
};

export function Avatar({ who, size = 40, label }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 46 46" role=${label ? 'img' : null}
    aria-label=${label || null} aria-hidden=${label ? null : 'true'} class="avatar">${(FACES[who] || FACES.erlan)()}</svg>`;
}

export function Yurt() {
  return html`<g>
    <path d="M5 31 C15 18 27 10 34 9 L46 9 C53 10 65 18 75 31 Z" fill="#0B7D8D"></path>
    <path d="M13 24.5 C25 16 55 16 67 24.5" fill="none" stroke="#E8A013" stroke-width="2.5" stroke-linecap="round"></path>
    <rect x="32" y="4.5" width="16" height="5" rx="2.5" fill="#E8A013"></rect>
    <rect x="9" y="31" width="62" height="19" fill="#F4E9D7"></rect>
    <path d="M12.5 34 L19.5 47 M19.5 34 L12.5 47 M23 34 L29 47 M29 34 L23 47 M51 34 L57 47 M57 34 L51 47 M60.5 34 L67.5 47 M67.5 34 L60.5 47" stroke="#E3D3B8" stroke-width="1.4"></path>
    <rect x="33" y="35.5" width="14" height="14.5" rx="2" fill="#D86A27"></rect>
    <path d="M40 35.5 V50" stroke="#B4561C" stroke-width="1.2"></path>
    <path d="M1 50.5 H79" stroke-width="1.5" stroke-linecap="round" style="stroke: var(--line2)"></path>
  </g>`;
}

// A standing person for photos: x = centre, c = clothes, s = skin, h = hair style.
function Person({ x, c, s = '#E7B48A', h = 'short', hair = '#2A1E12', scale = 1 }) {
  const t = `translate(${x} 0) scale(${scale}) translate(${-x} 0)`;
  const head = h === 'scarf'
    ? html`<path d=${`M${x - 13} 69 C${x - 13} 57 ${x - 7} 52 ${x} 52 C${x + 7} 52 ${x + 13} 57 ${x + 13} 69 C${x + 13} 76 ${x + 9} 80 ${x + 4} 81 L${x} 82 L${x - 4} 81 C${x - 9} 80 ${x - 13} 76 ${x - 13} 69 Z`} fill="#FFFFFF" stroke="#E3D3B8" stroke-width="1"></path>`
    : h === 'long'
      ? html`<path d=${`M${x - 13} 70 C${x - 13} 57 ${x - 7} 52 ${x} 52 C${x + 7} 52 ${x + 13} 57 ${x + 13} 70 L${x + 14} 86 C${x + 10} 84 ${x + 9} 78 ${x + 8.6} 73 L${x - 8.6} 73 C${x - 9} 78 ${x - 10} 84 ${x - 14} 86 Z`} fill=${hair}></path>`
      : null;
  const top = h === 'short' || h === 'grey'
    ? html`<path d=${`M${x - 12} 68 C${x - 12} 57 ${x - 7} 54 ${x} 54 C${x + 7} 54 ${x + 12} 57 ${x + 12} 68 C${x + 10} 62.5 ${x + 6} 61 ${x} 61 C${x - 6} 61 ${x - 10} 62.5 ${x - 12} 68 Z`} fill=${h === 'grey' ? '#B9B4AC' : hair}></path>`
    : h === 'long'
      ? html`<path d=${`M${x - 10} 66 C${x - 9.4} 59.4 ${x - 5} 56.6 ${x} 56.6 C${x + 5} 56.6 ${x + 9.4} 59.4 ${x + 10} 66 C${x + 7} 62.6 ${x + 3.6} 61.6 ${x} 61.6 C${x - 3.6} 61.6 ${x - 7} 62.6 ${x - 10} 66 Z`} fill=${hair}></path>`
      : null;
  return html`<g transform=${t}>
    <path d=${`M${x - 24} 112 C${x - 24} 96 ${x - 14} 88 ${x} 88 C${x + 14} 88 ${x + 24} 96 ${x + 24} 112 Z`} fill=${c}></path>
    ${head}
    <rect x=${x - 4} y="80" width="8" height="9" fill="#C98F5E"></rect>
    <circle cx=${x} cy="70" r="11" fill=${s}></circle>
    ${top}
    <circle cx=${x - 4.5} cy="71" r="1.4" fill="#2A1E12"></circle>
    <circle cx=${x + 4.5} cy="71" r="1.4" fill="#2A1E12"></circle>
    <path d=${`M${x - 4} 75.5 Q${x} 78.5 ${x + 4} 75.5`} fill="none" stroke="#6E4520" stroke-width="1.6" stroke-linecap="round"></path>
  </g>`;
}

export function Photo({ kind }) {
  const frame = (label, body) => html`<svg class="photo" viewBox="0 0 200 112" role="img" aria-label=${label}>
    <rect width="200" height="112" rx="12" fill="#D9EFF2"></rect>
    <circle cx="170" cy="24" r="10" fill="#F6CF6B"></circle>
    <path d="M0 86 Q50 72 100 82 T200 78 V112 H0 Z" fill="#BFE0E5"></path>
    ${body}
  </svg>`;
  if (kind === 'snow' || kind === 'rain') {
    const snow = kind === 'snow';
    const drops = [];
    for (let i = 0; i < 24; i++) {
      const x = ((i * 37) % 192) + 4;
      const y = ((i * 53) % 70) + 6;
      drops.push(snow
        ? html`<circle cx=${x} cy=${y} r=${i % 3 === 0 ? 2.2 : 1.5} fill="#FFFFFF"></circle>`
        : html`<path d=${`M${x} ${y} l-3 8`} stroke="#4F7690" stroke-width="1.6" stroke-linecap="round"></path>`);
    }
    return html`<svg class="photo" viewBox="0 0 200 112" role="img" aria-label=${snow ? 'За окном идёт снег' : 'За окном идёт дождь'}>
      <rect width="200" height="112" rx="12" fill=${snow ? '#C9D8E4' : '#A9BCC9'}></rect>
      <path d="M0 84 Q50 74 100 80 T200 76 V112 H0 Z" fill=${snow ? '#F4F8FB' : '#7E9BAA'}></path>
      <path d="M38 84 L50 54 L62 84 Z" fill="#2E6B4F"></path>
      ${snow ? html`<path d="M44 70 L50 56 L56 70 Z" fill="#FFFFFF"></path>` : null}
      <g transform="translate(118 44)">
        <path d="M0 22 L18 6 L36 22 V42 H0 Z" fill="#E8D6BF"></path>
        <path d="M-3 23 L18 3 L39 23" fill="none" stroke=${snow ? '#FFFFFF' : '#8F3E0D'} stroke-width="3.5" stroke-linecap="round"></path>
        <rect x="13" y="27" width="10" height="15" fill="#8F3E0D"></rect>
      </g>
      ${drops}
    </svg>`;
  }
  if (kind === 'dombra') {
    return html`<svg class="photo" viewBox="0 0 200 112" role="img" aria-label="Домбра">
      <rect width="200" height="112" rx="12" fill="#FBF1D9"></rect>
      <g transform="rotate(-24 104 58)">
        <ellipse cx="62" cy="58" rx="33" ry="22" fill="#B4561C"></ellipse>
        <ellipse cx="62" cy="58" rx="25" ry="15" fill="#C97A3D"></ellipse>
        <circle cx="68" cy="58" r="4" fill="#5A2A0A"></circle>
        <rect x="92" y="54" width="84" height="8" rx="3" fill="#8F3E0D"></rect>
        <path d="M108 54v8M122 54v8M136 54v8M150 54v8M162 54v8" stroke="#E8D6BF" stroke-width="1.2"></path>
        <rect x="172" y="51" width="13" height="14" rx="3" fill="#5A2A0A"></rect>
        <path d="M44 56.5 H180 M44 59.5 H180" stroke="#F4E9D7" stroke-width="0.8"></path>
      </g>
    </svg>`;
  }
  if (kind === 'family') {
    return frame('Фото: семья Айгерім — мама, папа и два старших брата', html`
      <${Person} x=${34} c="#2B4699" h="grey" s="#D9A273" />
      <${Person} x=${78} c="#8F3E0D" h="scarf" />
      <${Person} x=${124} c="#0B7D8D" s="#D9A273" />
      <${Person} x=${168} c="#D86A27" s="#E1AE82" />`);
  }
  if (kind === 'mama') {
    return frame('Фото: мама', html`<${Person} x=${100} c="#B4561C" h="long" scale=${1.1} />`);
  }
  return frame('Фото: трое друзей улыбаются', html`
    <${Person} x=${52} c="#D86A27" />
    <${Person} x=${100} c="#3E63C8" h="long" s="#D9A273" />
    <${Person} x=${148} c="#0B7D8D" s="#E1AE82" />`);
}

// Month as a shanyrak: one spoke (уық) per day. fresh: today's spoke has just been added — it stands out.
export function Shanyrak({ year, month, days, today, size = 120, fresh }) {
  const n = new Date(year, month + 1, 0).getDate();
  const spokes = [];
  for (let i = 1; i <= n; i++) {
    const a = (-90 + ((i - 1) * 360) / n) * (Math.PI / 180);
    const x1 = 85 + 40 * Math.cos(a), y1 = 85 + 40 * Math.sin(a);
    const x2 = 85 + 75 * Math.cos(a), y2 = 85 + 75 * Math.sin(a);
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    let cls = 'spoke-future';
    if (days[key]) cls = fresh && i === today ? 'spoke-done spoke-new' : 'spoke-done';
    else if (i === today) cls = 'spoke-today';
    else if (i < today) cls = 'spoke-miss';
    spokes.push(html`<line x1=${x1.toFixed(1)} y1=${y1.toFixed(1)} x2=${x2.toFixed(1)} y2=${y2.toFixed(1)} class=${cls}></line>`);
  }
  return html`<svg width=${size} height=${size} viewBox="0 0 170 170" aria-hidden="true" class="shanyrak">
    ${spokes}
    <circle cx="85" cy="85" r="30" style="fill: var(--gold-wash)"></circle>
    <path d="M76 59.5V110.5M94 59.5V110.5M59.5 76H110.5M59.5 94H110.5" stroke-width="3" stroke-linecap="round" style="stroke: var(--gold-deep)"></path>
    <circle cx="85" cy="85" r="30" fill="none" stroke-width="5" style="stroke: var(--gold)"></circle>
  </svg>`;
}

// A voice message: the shape of a real recording when its levels (0..1) are known, else a drawn one.
export function Wave({ bars = 16, levels }) {
  const hs = [6, 12, 20, 24, 14, 8, 18, 22, 12, 16, 22, 10, 16, 8, 12, 6];
  const list = levels && levels.length ? levels.map((l) => Math.round(4 + Math.min(1, l) * 20)) : Array.from({ length: bars }, (_, i) => hs[i % hs.length]);
  const out = list.map((h, i) => html`<rect x=${i * 6} y=${(26 - h) / 2} width="3.5" height=${h} rx="1.75"></rect>`);
  return html`<svg width=${list.length * 6} height="26" viewBox=${`0 0 ${list.length * 6} 26`} aria-hidden="true" class="wave">${out}</svg>`;
}
