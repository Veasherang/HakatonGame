export const pad2 = (value) => String(Math.max(0, Math.floor(value))).padStart(2, '0');

export const formatTime = (seconds) => {
  const total = Math.max(0, Math.ceil(seconds));
  return `${pad2(total / 60)}:${pad2(total % 60)}`;
};

export const formatMoney = (value) => {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '−' : '';
  const digits = String(Math.abs(rounded));
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
};

export const formatSigned = (value, suffix = '') => {
  const rounded = Math.round(value);
  if (rounded === 0) return `0${suffix}`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}${suffix}`;
};

export const pct = (value) => `${Math.round(value)}%`;

export const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const plural = (count, one, few, many) => {
  const abs = Math.abs(count) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (tail > 1 && tail < 5) return few;
  if (tail === 1) return one;
  return many;
};

export const short = (text, max = 42) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

export const roman = (value) => ['I', 'II', 'III', 'IV', 'V'][value - 1] || String(value);
