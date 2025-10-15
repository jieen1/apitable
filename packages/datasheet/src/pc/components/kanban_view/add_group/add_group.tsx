/**
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { useClickAway } from 'ahooks';
import produce from 'immer';
import { size } from 'lodash';
import { useState } from 'react';
import * as React from 'react';
import { useThemeColors } from '@apitable/components';
import { Field, FieldType, IField, IMemberField, ISelectField, Selectors, SingleSelectField, Strings, t, KanbanStyleKey, KanbanView } from '@apitable/core';
import { AddOutlined } from '@apitable/icons';
import { useAppSelector } from 'pc/store/react-redux';
import { MemberFieldHead, OptionFieldHead } from '../group_header';
import { useCommand } from '../hooks/use_command';
import styles from '../styles.module.less';

interface IAddGroup {
  kanbanFieldId: string;
}

export const AddGroup: React.FC<React.PropsWithChildren<IAddGroup>> = (props) => {
  const colors = useThemeColors();
  const { kanbanFieldId } = props;
  const view = useAppSelector(Selectors.getCurrentView) as any;
  const fieldMap = useAppSelector((state) => Selectors.getFieldMap(state, state.pageParams.datasheetId!))!;
  const recordMap = useAppSelector((state) => {
    const sanpshot = Selectors.getSnapshot(state)!;
    return sanpshot.recordMap;
  });
  const ref = React.useRef<HTMLDivElement>(null);
  const kanbanField = fieldMap[kanbanFieldId]!;
  const [editing, setEditing] = useState(false);
  const command = useCommand();

  // 🔑 判断是否为自定义分组模式
  const isCustomGroupMode = Boolean(view.style.customGroupMap && Object.keys(view.style.customGroupMap).length > 0);

  function setFieldAttr(newField: IField) {
    command.setFieldAttr(kanbanFieldId, newField);
    setEditing(false);
  }

  function addRecord(unitIds: string[]) {
    command.addRecords(size(recordMap), 1, [{ [kanbanFieldId]: unitIds }]);
    setEditing(false);
  }

  function onClick() {
    if (editing) {
      return;
    }
    
    // 🔑 自定义分组模式：创建新的自定义组
    if (isCustomGroupMode) {
      const currentGroups = Object.values(view.style.customGroupMap || {});
      const maxOrder = currentGroups.length > 0 
        ? Math.max(...currentGroups.map((g: any) => g.order)) 
        : -1;
      
      const newGroupId = KanbanView.generateCustomGroupId();
      const updatedCustomGroupMap = {
        ...view.style.customGroupMap,
        [newGroupId]: {
          id: newGroupId,
          name: `新分组 ${currentGroups.length + 1}`,
          optionIds: [],
          order: maxOrder + 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      command.setKanbanStyle({
        styleKey: KanbanStyleKey.CustomGroupMap,
        styleValue: updatedCustomGroupMap,
      });
      return;
    }
    
    // 默认模式：进入编辑状态
    setEditing(true);
  }

  const commonProps = {
    editing,
    setEditing,
    isAdd: true,
  };

  // Implemented at the top of the member column so that the member column can go beyond displaying ellipses and
  // adapts to the width of the statistics on the right
  useClickAway(
    () => {
      kanbanField.type !== FieldType.SingleSelect && setEditing(false);
    },
    ref,
    'mousedown',
  );

  function HeadOption() {
    const option = (Field.bindModel(kanbanField) as SingleSelectField).createNewOption('');
    const newField = produce(kanbanField as ISelectField, (draft) => {
      draft.property.options.push(option);
      return draft;
    });
    return <OptionFieldHead cellValue={option.id} field={newField} onCommand={setFieldAttr} {...commonProps} />;
  }

  return (
    <div ref={ref} className={styles.addNewBoard} onClick={onClick}>
      {!editing ? (
        <div className={styles.addTip}>
          <AddOutlined color={colors.thirdLevelText} />
          {isCustomGroupMode ? '添加自定义分组' : t(Strings.kanban_add_new_group)}
        </div>
      ) : kanbanField.type === FieldType.SingleSelect ? (
        <HeadOption />
      ) : (
        <MemberFieldHead cellValue={['']} field={kanbanField as any as IMemberField} onCommand={addRecord} {...commonProps} isNewBoard />
      )}
    </div>
  );
};
