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
  StoreActions
} from '@apitable/core';
import { resourceService } from 'pc/resource_service';
import { executeCommandWithMirror } from 'pc/utils/execute_command_with_mirror';

const Option = DropdownSelect.Option;

interface IProps {
  triggerInfo?: any;
}

type RuleDraft = {
  id: string;
  scope: 'row' | 'cell';
  targetFieldId?: string;
  filterInfo: IFilterInfo;
  color: string;
};

export const ConditionalFormatPanel: React.FC<IProps> = () => {
  const dispatch = useDispatch();
  const view = useAppSelector((s) => Selectors.getCurrentView(s)!);
  const datasheetId = useAppSelector((s) => s.pageParams.datasheetId!);
  const fieldMap = useAppSelector((s) => Selectors.getFieldMap(s, datasheetId))!;
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
      scope: 'row',
      targetFieldId: firstFieldId,
      color: 'rgba(255, 247, 198, 1)',
      filterInfo: {
        conjunction: FilterConjunction.And,
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
    const payload = drafts.map(({ id, scope, targetFieldId, filterInfo, color }) => ({ id, scope, targetFieldId, filterInfo, color }));
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
      <div className={styles.header}>{t(Strings.advanced_features) /* 复用已有文案占位 */}</div>
      <div className={styles.list}>
        {drafts.map((rule) => {
          const fId = rule.targetFieldId || columns[0]?.fieldId;
          const field = fId ? fieldMap[fId] : undefined;
          return (
            <div key={rule.id} className={styles.ruleItem}>
              <div className={styles.line}>
                <RadioGroup
                  value={rule.scope}
                  onChange={(v) => updateRule(rule.id, { scope: v as any })}
                  options={[
                    { label: '按行', value: 'row' },
                    { label: '按列', value: 'cell' },
                  ]}
                />
                {rule.scope === 'cell' && (
                  <DropdownSelect
                    triggerStyle={{ width: 200 }}
                    value={rule.targetFieldId}
                    onSelected={(opt) => updateRule(rule.id, { targetFieldId: opt.value as string })}
                  >
                    {columns.map((c, index) => (
                      <Option key={c.fieldId} value={c.fieldId} currentIndex={index} />
                    ))}
                  </DropdownSelect>
                )}
                <div className={styles.color}>
                  <ColorPicker
                    option={{ id: rule.id, name: '', color: 0 }}
                    onChange={(_type, _id, value) => updateRule(rule.id, { color: String(value) })}
                    triggerComponent={<div className={styles.colorBlock} style={{ background: rule.color }} />}
                  />
                </div>
                <TextButton onClick={() => deleteRule(rule.id)} style={{ marginLeft: 8 }}>
                  {t(Strings.delete)}
                </TextButton>
              </div>
              <div className={classNames(styles.filter)}>
                <ConditionList
                  filterInfo={rule.filterInfo}
                  fieldMap={fieldMap}
                  changeFilter={(fn: (cur: IFilterInfo) => IFilterInfo) => updateRule(rule.id, { filterInfo: fn(rule.filterInfo) })}
                  deleteFilter={(idx: number) => {
                    const f = { ...rule.filterInfo, conditions: rule.filterInfo.conditions.filter((_c, i) => i !== idx) };
                    updateRule(rule.id, { filterInfo: f });
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


