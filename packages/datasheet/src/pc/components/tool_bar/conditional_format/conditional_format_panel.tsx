/**
 * 条件填色面板
 */
import * as React from 'react';
import { useCallback, useState } from 'react';
import classNames from 'classnames';
import { TextButton, DropdownSelect, RadioGroup } from '@apitable/components';
import { useAppSelector } from 'pc/store/react-redux';
import { useDispatch } from 'react-redux';
import { ColorPicker } from 'pc/components/common/color_picker';
import styles from './style.module.less';
import ConditionList from '../view_filter/condition_list';
import { ExecuteFilterFn } from '../view_filter/interface';
import {
  getNewId,
  IDPrefix,
  FilterConjunction, 
  IFilterInfo,
  Field,
  Strings, 
  t, 
  Selectors, 
  CollaCommandName, 
  StoreActions,
  IFieldMap,
  ILookUpField
} from '@apitable/core';
import { resourceService } from 'pc/resource_service';
import { executeCommandWithMirror } from 'pc/utils/execute_command_with_mirror';

const Option = DropdownSelect.Option;

interface IProps {
  triggerInfo?: any;
}

type RuleDraft = {
  id: string;
  // 是否整行填色；为 true 则保存为 scope:'row'，否则为 'cell'
  fillWholeRow: boolean;
  targetFieldId?: string;
  filterInfo: IFilterInfo;
  color: number;
};

export const ConditionalFormatPanel: React.FC<IProps> = () => {
  const dispatch = useDispatch();
  const view = useAppSelector((s) => Selectors.getCurrentView(s)!);
  const datasheetId = useAppSelector((s) => s.pageParams.datasheetId!);
  const fieldMap = useAppSelector((s) => Selectors.getFieldMap(s, datasheetId)) as IFieldMap;
  const columns = useAppSelector((s) => Selectors.getVisibleColumns(s));
  const rules = useAppSelector((s) => (Selectors as any).getConditionalFormatRules(s)) as any[];
  const [drafts, setDrafts] = useState<RuleDraft[]>(() => (rules && rules.length ? rules : []));

  const addRule = useCallback(() => {
    const firstFieldId = columns[0]?.fieldId;
    const field = firstFieldId ? fieldMap[firstFieldId] : undefined;
    const acceptFilterOperators = field ? Field.bindModel(field).acceptFilterOperators : [];
    const newOperate = acceptFilterOperators[0];
    const newDraft: RuleDraft = {
      id: getNewId(IDPrefix.Condition),
      fillWholeRow: false,
      targetFieldId: firstFieldId,
      color: 0,
      filterInfo: {
        conjunction: FilterConjunction.Or,
        conditions: field
          ? [
            {
              conditionId: getNewId(IDPrefix.Condition),
              fieldId: firstFieldId,
              operator: newOperate,
              fieldType: field.type as any,
              value: null,
            },
          ]
          : [],
      },
    };
    setDrafts((prev) => [...prev, newDraft]);
  }, [columns, fieldMap]);

  const updateRule = useCallback((id: string, patch: Partial<RuleDraft>) => {
    setDrafts((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const deleteRule = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const save = useCallback(() => {
    const payload = drafts.map(({ id, fillWholeRow, targetFieldId, filterInfo, color }) => ({
      id,
      scope: fillWholeRow ? 'row' : 'cell',
      targetFieldId: fillWholeRow ? undefined : targetFieldId,
      filterInfo,
      color,
    }));
    executeCommandWithMirror(
      () => {
        return resourceService.instance!.commandManager.execute({
          cmd: CollaCommandName.SetViewConditionalFormat,
          viewId: view.id,
          rules: payload as any,
        }).result;
      },
      {
      },
    );
    dispatch(StoreActions.triggerViewDerivationComputed(datasheetId!, view.id));
  }, [drafts, view, datasheetId, dispatch]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>配置填色规则</div>
      <div className={styles.list}>
        {drafts.map((rule) => {
          const fId = rule.targetFieldId || columns[0]?.fieldId;
          const field = fId ? fieldMap[fId] as unknown as ILookUpField : undefined;
          return (
            <div key={rule.id} className={styles.ruleItem}>
              <div className={styles.line}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={rule.fillWholeRow}
                      onChange={(e) => updateRule(rule.id, { fillWholeRow: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    整行填色
                  </label>
                </div>
                <div className={styles.color}>
                  <ColorPicker
                    option={{ id: rule.id, name: '', color: rule.color as number || 0 }}
                    onChange={(_type, _id, value) => updateRule(rule.id, { color: value as number})}
                    triggerComponent={<div className={styles.colorBlock} style={{ background: rule.color }} />}
                  />
                </div>
              </div>
              <div className={classNames(styles.filter)}>
                <ConditionList
                  filterInfo={rule.filterInfo}
                  fieldMap={fieldMap}
                  changeFilter={(fn: ExecuteFilterFn) => {
                    const next = fn(rule.filterInfo);
                    updateRule(rule.id, {
                      filterInfo: next || { conjunction: rule.filterInfo.conjunction, conditions: [] },
                    });
                  }}
                  deleteFilter={(idx: number) => {
                    const f = { ...rule.filterInfo, conditions: rule.filterInfo.conditions.filter((_c, i) => i !== idx) };
                    updateRule(rule.id, { filterInfo: f });
                    deleteRule(rule.id);
                  }}
                  datasheetId={datasheetId}
                  field={field}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.footer}>
        <TextButton onClick={addRule}>{t(Strings.add_filter)}</TextButton>
        <TextButton style={{ marginLeft: 12 }} onClick={save}>
          {t(Strings.save)}
        </TextButton>
      </div>
    </div>
  );
};


