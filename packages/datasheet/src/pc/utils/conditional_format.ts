import { Selectors, IReduxState, ViewFilterDerivate } from '@apitable/core';

export function getConditionalFillColor(state: IReduxState, recordId: string, fieldId?: string): string | undefined {
  const rules = (Selectors as any).getConditionalFormatRules(state) as any[];
  if (!rules || !rules.length) return undefined;
  const datasheetId = Selectors.getActiveDatasheetId(state)!;
  const snapshot = Selectors.getSnapshot(state, datasheetId)!;
  const derivate = new ViewFilterDerivate(state as any, datasheetId);
  for (const rule of rules) {
    if (rule.scope === 'cell' && fieldId && rule.targetFieldId && rule.targetFieldId !== fieldId) {
      continue;
    }
    const rows = derivate.getFilterRowsBase({ filterInfo: rule.filterInfo, rows: [{ recordId } as any], recordMap: snapshot.recordMap });
    if (rows && rows.length) {
      return rule.color as string;
    }
  }
  return undefined;
}


