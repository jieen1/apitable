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

import { Settings } from 'config';
import { Strings, t } from '../../exports/i18n';
import { DatasheetActions } from 'commands_actions/datasheet';
import { IFieldMap, IKanbanViewProperty, ISnapshot } from '../../exports/store/interfaces';
import { ViewType } from 'modules/shared/store/constants';
import { IViewColumn, IViewProperty } from '../../exports/store/interfaces';
import { FieldType, IField, IMemberProperty } from 'types';
import { CardView } from './card_view';
import { integrateCdnHost } from 'utils';

export class KanbanView extends CardView {

  static findGroupFieldId(srcView: IViewProperty, fieldMap: IFieldMap) {
    const column = srcView.columns.find(item => {
      const field = fieldMap[item.fieldId]!;
      return field.type === FieldType.SingleSelect ||
        (field.type === FieldType.Member && !field.property.isMulti);
    });
    return column?.fieldId;
  }

  static getFieldProperty(column: IViewColumn | undefined, fieldMap: IFieldMap) {
    if (!column) {
      return [];
    }
    const field = fieldMap[column.fieldId]!;
    if (field.type === FieldType.Member) {
      return field.property.unitIds;
    }
    if (field.type === FieldType.SingleSelect) {
      return field.property.options.map(item => item.id);
    }
    return [];

  }

  static getHiddenGroupMap(field: IField | undefined) {
    if (!field) {
      return;
    }

    const hiddenGroupMap: { [key: string]: boolean } = {};

    if (field.type === FieldType.SingleSelect) {
      field.property.options.forEach(item => {
        hiddenGroupMap[item.id] = false;
      });
    } else {
      (field.property as IMemberProperty).unitIds.forEach(id => {
        hiddenGroupMap[id] = false;
      });
    }

    return hiddenGroupMap;
  }

  static defaultStyle(snapshot: ISnapshot, activeViewId: string) {
    const srcView = this.getSrcView(snapshot, activeViewId);

    // the first attachment field will be default cover field

    const kanbanFieldId = this.findGroupFieldId(srcView, snapshot.meta.fieldMap)!;
    const field = snapshot.meta.fieldMap[kanbanFieldId];

    return {
      isCoverFit: false,
      coverFieldId: undefined,
      kanbanFieldId,
      isColNameVisible: true,
      hiddenGroupMap: KanbanView.getHiddenGroupMap(field),
    };
  }

  static generateDefaultProperty(snapshot: ISnapshot, activeViewId: string | null | undefined): IKanbanViewProperty {
    const srcView = this.getSrcView(snapshot, activeViewId);
    const views = snapshot.meta.views;
    return {
      id: DatasheetActions.getNewViewId(views),
      name: DatasheetActions.getDefaultViewName(views, ViewType.Kanban),
      type: ViewType.Kanban,
      columns: this.defaultColumns(srcView, 2),
      rows: this.defaultRows(srcView),
      style: this.defaultStyle(snapshot, activeViewId!),
      groupInfo: [{ fieldId: this.findGroupFieldId(srcView, snapshot.meta.fieldMap)!, desc: false }],
      displayHiddenColumnWithinMirror: true
    };
  }

  static getViewIntroduce() {
    return {
      title: t(Strings.kanban_view),
      desc: t(Strings.kanban_guide_desc),
      videoGuide: integrateCdnHost(Settings.view_kanban_guide_video.value),
    };
  }

  /**
   * 从字段生成默认的自定义分组配置
   * 每个选项初始化为一个独立的自定义组
   */
  static generateDefaultCustomGroupMap(field: IField | undefined): any {
    if (!field) {
      return {};
    }

    const customGroupMap: any = {};
    let options: Array<{ id: string; name: string }> = [];

    if (field.type === FieldType.SingleSelect) {
      options = field.property.options.map((opt: any) => ({
        id: opt.id,
        name: opt.name,
      }));
    } else if (field.type === FieldType.Member) {
      // Member 字段需要从 unitIds 获取
      const unitIds = (field.property as IMemberProperty).unitIds || [];
      options = unitIds.map((unitId: string) => ({
        id: unitId,
        name: unitId, // Member 字段需要后续查询用户名
      }));
    }

    // 为每个选项创建一个默认的自定义组
    options.forEach((option, index) => {
      const groupId = `grp_${option.id}_${Date.now()}_${index}`;
      customGroupMap[groupId] = {
        id: groupId,
        name: option.name,
        optionIds: [option.id],
        order: index,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    return customGroupMap;
  }

  /**
   * 验证自定义分组配置的有效性
   */
  static validateCustomGroupMap(
    customGroupMap: any,
    fieldMap: IFieldMap,
    kanbanFieldId: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const field = fieldMap[kanbanFieldId];

    if (!field) {
      errors.push(`Kanban field ${kanbanFieldId} not found`);
      return { valid: false, errors };
    }

    // 获取所有可用的选项ID
    let availableOptionIds: string[] = [];
    if (field.type === FieldType.SingleSelect) {
      availableOptionIds = field.property.options.map((opt: any) => opt.id);
    } else if (field.type === FieldType.Member) {
      availableOptionIds = (field.property as IMemberProperty).unitIds || [];
    }

    // 验证每个自定义组
    const allOptionIds: string[] = [];
    Object.values(customGroupMap).forEach((group: any) => {
      // 1. 验证 ID 存在
      if (!group.id) {
        errors.push(`Group missing ID`);
      }

      // 2. 验证名称存在
      if (!group.name || group.name.trim() === '') {
        errors.push(`Group ${group.id} missing name`);
      }

      // 3. 验证 optionIds 存在且为数组
      if (!Array.isArray(group.optionIds)) {
        errors.push(`Group ${group.id} optionIds must be an array`);
        return;
      }

      // 4. 验证所有 optionId 都是有效的
      group.optionIds.forEach((optionId: string) => {
        if (!availableOptionIds.includes(optionId)) {
          errors.push(`Group ${group.id} contains invalid optionId: ${optionId}`);
        }
        // 检查重复
        if (allOptionIds.includes(optionId)) {
          errors.push(`OptionId ${optionId} appears in multiple groups`);
        }
        allOptionIds.push(optionId);
      });

      // 5. 验证 order 是数字
      if (typeof group.order !== 'number') {
        errors.push(`Group ${group.id} order must be a number`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 自动修复无效的自定义分组配置
   */
  static repairCustomGroupMap(
    customGroupMap: any,
    fieldMap: IFieldMap,
    kanbanFieldId: string
  ): any {
    const field = fieldMap[kanbanFieldId];
    if (!field) {
      return {};
    }

    let availableOptionIds: string[] = [];
    if (field.type === FieldType.SingleSelect) {
      availableOptionIds = field.property.options.map((opt: any) => opt.id);
    } else if (field.type === FieldType.Member) {
      availableOptionIds = (field.property as IMemberProperty).unitIds || [];
    }

    const repairedMap: any = {};
    const usedOptionIds = new Set<string>();

    Object.entries(customGroupMap).forEach(([groupId, group]: [string, any]) => {
      // 过滤掉无效的和重复的 optionId
      const validOptionIds = (group.optionIds || []).filter((id: string) => 
        availableOptionIds.includes(id) && !usedOptionIds.has(id)
      );

      // 记录已使用的 optionId
      validOptionIds.forEach((id: string) => usedOptionIds.add(id));

      // 只保留包含有效选项的组
      if (validOptionIds.length > 0) {
        repairedMap[groupId] = {
          ...group,
          optionIds: validOptionIds,
        };
      }
    });

    return repairedMap;
  }

  /**
   * 生成新的自定义组ID
   */
  static generateCustomGroupId(): string {
    return `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
