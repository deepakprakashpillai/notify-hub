export function renderJinjaTemplate(
  template: string | null | undefined,
  data: Record<string, any>
): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr) => {
    let expression = expr.trim();
    let defaultValue = '';

    if (expression.includes('|')) {
      const parts = expression.split('|').map((s: string) => s.trim());
      expression = parts[0];
      for (let i = 1; i < parts.length; i++) {
        const filter = parts[i];
        if (filter.startsWith('default(')) {
          const match = filter.match(/default\((['"]?)(.*?)\1\)/);
          if (match) defaultValue = match[2];
        }
      }
    }

    const keys = expression.split('.');
    let val: any = data;
    for (const key of keys) {
      if (val && typeof val === 'object' && key in val) {
        val = val[key];
      } else {
        val = undefined;
        break;
      }
    }

    if (val !== undefined && val !== null) {
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }
      return String(val);
    }
    return defaultValue;
  });
}
