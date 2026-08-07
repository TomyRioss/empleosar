export function parseRelativeDate(text: string): Date | undefined {
  if (!text) return undefined;

  const cleaned = text
    .toLowerCase()
    .replace(/publicado\s*/i, "")
    .replace(/hace\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const now = new Date();

  const es = [
    { regex: /un\s+momento|ahora|re[ií]en|justo ahora/i, seconds: 0 },
    { regex: /unos?\s*(minutos?|min\.?)\b/i, seconds: 60 },
    { regex: /(\d+)\s*(minutos?|min\.?|mins?)\b/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 60 },
    { regex: /una?\s*hora\b/i, seconds: 3600 },
    { regex: /(\d+)\s*(horas?|hrs?|hr\.?)\b/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 3600 },
    { regex: /un\s+d[ií]a\b/i, seconds: 86400 },
    { regex: /(\d+)\s*(d[ií]as?)\b/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 86400 },
    { regex: /una?\s*semana\b/i, seconds: 604800 },
    { regex: /(\d+)\s*(semanas?)\b/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 604800 },
    { regex: /un\s+mes\b/i, seconds: 2592000 },
    { regex: /(\d+)\s*(meses?)\b/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 2592000 },
  ];

  const en = [
    { regex: /just now|a moment ago/i, seconds: 0 },
    { regex: /a\s+(minute|min)\b/i, seconds: 60 },
    { regex: /(\d+)\s*(minutes?|mins?|min\.?)\s*ago/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 60 },
    { regex: /an?\s*hour\b/i, seconds: 3600 },
    { regex: /(\d+)\s*(hours?|hrs?)\s*ago/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 3600 },
    { regex: /a\s+day\b/i, seconds: 86400 },
    { regex: /(\d+)\s*(days?)\s*ago/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 86400 },
    { regex: /a\s+week\b/i, seconds: 604800 },
    { regex: /(\d+)\s*(weeks?)\s*ago/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 604800 },
    { regex: /a\s+month\b/i, seconds: 2592000 },
    { regex: /(\d+)\s*(months?)\s*ago/i, fn: (m: RegExpMatchArray) => parseInt(m[1]) * 2592000 },
    { regex: /yesterday/i, seconds: 86400 },
  ];

  for (const rules of [es, en]) {
    for (const rule of rules) {
      const match = cleaned.match(rule.regex);
      if (match) {
        const seconds = "fn" in rule && rule.fn ? rule.fn(match) : rule.seconds;
        return new Date(now.getTime() - seconds * 1000);
      }
    }
  }

  return undefined;
}
