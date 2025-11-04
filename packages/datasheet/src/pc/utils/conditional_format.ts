import { Selectors, IReduxState, ViewFilterDerivate } from '@apitable/core';

export function getConditionalFillColor(state: IReduxState, recordId: string, fieldId?: string): number | undefined {
  const rules = Selectors.getConditionalFormatRules(state);
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
      console.log('get fill color ', rule, fieldId);
      return rule.color;
    }
  }
  return undefined;
}


