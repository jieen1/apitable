/**
 * 条件填色面板
 */
import * as React from 'react';
import { useCallback, useState, useRef } from 'react';
import classNames from 'classnames';
import { TextButton, useThemeColors, ScreenSize, useResponsive } from '@apitable/components';
import { IUseListenTriggerInfo, useListenVisualHeight } from '@apitable/components';
import { useAppSelector } from 'pc/store/react-redux';
import { useDispatch } from 'react-redux';
import { ColorPicker } from 'pc/components/common/color_picker';
import styles from './style.module.less';
import ConditionList from '../view_filter/condition_list';
import { ExecuteFilterFn } from '../view_filter/interface';
import { setColor } from 'pc/components/multi_grid/format';
import {
  getNewId,
  IDPrefix,
  FilterConjunction, 
  Field,
  Strings, 
  t, 
  Selectors, 
  CollaCommandName, 
  StoreActions,
  IFieldMap,
  ILookUpField,
  IConditionalFormatRule,
  BasicValueType,
  FilterDuration
} from '@apitable/core';
import { resourceService } from 'pc/resource_service';
import { executeCommandWithMirror } from 'pc/utils/execute_command_with_mirror';

interface ConditionalFormatPanelProps {
  triggerInfo?: IUseListenTriggerInfo;
}

const MIN_HEIGHT = 70;
const MAX_HEIGHT = 260;
export const ConditionalFormatPanel: React.FC<ConditionalFormatPanelProps> = (props: ConditionalFormatPanelProps) => {
  const { triggerInfo } = props;
  const colors = useThemeColors();
  const dispatch = useDispatch();
  const view = useAppSelector((s) => Selectors.getCurrentView(s)!);
  const datasheetId = useAppSelector((s) => s.pageParams.datasheetId!);
  const fieldMap = useAppSelector((s) => Selectors.getFieldMap(s, datasheetId)) as IFieldMap;
  const columns = useAppSelector((s) => Selectors.getVisibleColumns(s));
  const rules = useAppSelector((s) => Selectors.getConditionalFormatRules(s));
  const [drafts, setDrafts] = useState<IConditionalFormatRule[]>(rules || []);
  const cacheTheme = useAppSelector(Selectors.getTheme);

  const { screenIsAtMost } = useResponsive();
  const isMobile = screenIsAtMost(ScreenSize.md);
  const containerRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const scrollShadowRef = useRef<HTMLDivElement>(null);

  const { style, onListenResize } = useListenVisualHeight({
    listenNode: containerRef,
    childNode: childRef,
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
    triggerInfo,
    position: 'sticky',
    showOnParent: false,
    onScroll: ({ height, scrollHeight, scrollTop }) => {
      const ele = scrollShadowRef.current;
      if (!ele) return;
      if (scrollTop + height > scrollHeight - 10) {
        // Masked scrollable styles.
        ele.style.display = 'none';
        return;
      }
      // Display scrollable style.
      if (ele.style.display === 'block') {
        return;
      }
      ele.style.display = 'block';
    },
  });

  const addRule = useCallback(() => {
    const firstFieldId = columns[0]?.fieldId;
    const field = firstFieldId ? fieldMap[firstFieldId] : undefined;
    const acceptFilterOperators = field ? Field.bindModel(field).acceptFilterOperators : [];
    const newOperate = acceptFilterOperators[0];
    const newDraft: IConditionalFormatRule = {
      id: getNewId(IDPrefix.Condition),
      scope: 'cell',
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
              value: Field.bindModel(field).valueType === BasicValueType.DateTime ? [FilterDuration.ExactDate, null] : null,
            },
          ]
          : [],
      },
    };
    setDrafts((prev) => [...prev, newDraft]);
  }, [columns, fieldMap]);
``
  const updateRule = useCallback((id: string, patch: Partial<IConditionalFormatRule>) => {
    setDrafts((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const deleteRule = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const save = useCallback(() => {
    const payload = drafts.map(({ id, scope, targetFieldId, filterInfo, color }) => ({
      id,
      scope: scope,
      targetFieldId: scope === 'cell' ? targetFieldId : undefined,
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
    <div className={classNames(styles.wrapper, styles.shadow)} ref={containerRef}>
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
                      checked={rule.scope === 'row'}
                      onChange={(e) => updateRule(rule.id, { scope: e.target.checked ? 'row' : 'cell' })}
                      style={{ marginRight: 6 }}
                    />
                    整行填色
                  </label>
                </div>
                <div className={styles.color}>
                  <div className={styles.outer}>
                    <div
                      className={styles.inner}
                      style={{
                        backgroundColor: rule.color === -1 ? colors.defaultBg : setColor(rule.color, cacheTheme),
                      }}
                    />
                  </div>
                  <ColorPicker
                    option={{ id: rule.id, name: '', color: rule.color || 0 }}
                    onChange={(_type, _id, value) => updateRule(rule.id, { color: value as number})}
                    triggerComponent={<div className={styles.colorBlock} style={{ background: setColor(rule.color, cacheTheme) }} />}
                  />
                </div>
              </div>
              <div className={classNames(styles.filter)} ref={childRef} style={{ ...style, overflow: 'auto' }}>
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
                <div ref={scrollShadowRef} className={classNames(!isMobile && styles.scrollShadow)} />
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


