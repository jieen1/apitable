
import {
  IRecord, IReduxState, IViewDerivation, IViewProperty, IViewRow, Role,
} from 'exports/store/interfaces';
import {
  getCurrentView,
  getKanbanFieldId,
} from 'modules/database/store/selectors/resource/datasheet/calc';
import { getFieldRoleByFieldId } from 'modules/database/store/selectors/resource/datasheet/base';
import { UN_GROUP, ViewType } from 'modules/shared/store/constants';
import { FieldType, IField, IMemberField, IUnitIds } from 'types/field_types';
import { ViewDerivateBase } from './view_derivate_base';
import { polyfillOldData } from 'model/field/const';

export class ViewDerivateKanban extends ViewDerivateBase {
  constructor(protected override state: IReduxState, public override datasheetId: string) {
    super(state, datasheetId);
  }

  private getGroupValueMap(field: IField) {
    let sourceData: string[] = [];
    if (field.type === FieldType.SingleSelect) {
      sourceData = field.property.options.map(item => item.id);
    } else {
      sourceData = (field as IMemberField).property.unitIds || [];
    }
    return sourceData.reduce<{ [key: string]: IRecord[] }>((map, item) => {
      map[item] = [];
      return map;
    }, { [UN_GROUP]: [] });
  }

  /**
   * 判断是否为自定义分组模式
   */
  private isCustomGroupMode(view: IViewProperty): boolean {
    if (view.type !== ViewType.Kanban) {
      return false;
    }
    const kanbanView = view as any;
    // 方式1：显式指定 groupMode
    if (kanbanView.style.groupMode === 'custom') {
      return true;
    }
    // 方式2：存在 customGroupMap 且非空
    if (kanbanView.style.customGroupMap && Object.keys(kanbanView.style.customGroupMap).length > 0) {
      return true;
    }
    return false;
  }

  /**
   * 获取自定义分组的映射表
   */
  private getCustomGroupValueMap(customGroupMap: any): { [key: string]: IRecord[] } {
    const groupMap: { [key: string]: IRecord[] } = { [UN_GROUP]: [] };
    
    // 为每个自定义组创建空数组
    Object.keys(customGroupMap).forEach(customGroupId => {
      groupMap[customGroupId] = [];
    });
    
    return groupMap;
  }

  /**
   * 创建选项ID到自定义组ID的映射
   */
  private buildOptionToCustomGroupMap(customGroupMap: any): Map<string, string> {
    const optionMap = new Map<string, string>();
    
    Object.entries(customGroupMap).forEach(([customGroupId, group]: [string, any]) => {
      if (group.optionIds && Array.isArray(group.optionIds)) {
        group.optionIds.forEach((optionId: string) => {
          optionMap.set(optionId, customGroupId);
        });
      }
    });
    
    return optionMap;
  }

  /**
   * 获取自定义看板分组映射
   */
  private getCustomKanbanGroupMap(rows: IViewRow[], kanbanFieldId: string, customGroupMap: any) {
    const snapshot = this.state.datasheetMap[this.datasheetId]!.datasheet!.snapshot;
    const recordMap = snapshot.recordMap;
    const fieldMap = snapshot.meta.fieldMap;
    const field = fieldMap[kanbanFieldId];
    
    if (!field) {
      return {};
    }

    // 初始化自定义分组映射
    const groupMap = this.getCustomGroupValueMap(customGroupMap);
    
    // 创建选项ID到自定义组ID的映射
    const optionToGroupMap = this.buildOptionToCustomGroupMap(customGroupMap);

    // 遍历记录，分配到对应的自定义组
    for (const { recordId } of rows) {
      const record = recordMap[recordId];
      if (!record) {
        console.warn('! ' + `${recordId} is not exist, check kanban data`);
        continue;
      }
      
      const fieldData = record.data[kanbanFieldId];

      // 如果字段值为空，归入未分组
      if (fieldData == null) {
        groupMap[UN_GROUP]!.push(record);
        continue;
      }

      try {
        let optionId: string | null = null;

        // 提取选项ID
        if (field.type === FieldType.Member) {
          const unitIds = polyfillOldData(fieldData as IUnitIds);
          optionId = unitIds?.[0] || null;
        } else {
          optionId = fieldData as string;
        }

        // 查找该选项属于哪个自定义组
        if (optionId) {
          const customGroupId = optionToGroupMap.get(optionId);
          if (customGroupId && groupMap[customGroupId]) {
            groupMap[customGroupId]!.push(record);
          } else {
            // 选项未分配到任何自定义组，归入未分组
            groupMap[UN_GROUP]!.push(record);
          }
        } else {
          groupMap[UN_GROUP]!.push(record);
        }
      } catch (e) {
        console.warn('! ' + `${fieldData} is not exist, check kanban data`);
        groupMap[UN_GROUP]!.push(record);
      }
    }

    return groupMap;
  }

  /**
   * 获取默认看板分组映射（原有逻辑）
   */
  private getDefaultKanbanGroupMap(rows: IViewRow[], kanbanFieldId: string) {
    const snapshot = this.state.datasheetMap[this.datasheetId]!.datasheet!.snapshot;
    const fieldPermissionMap = this.state.datasheetMap[this.datasheetId]?.fieldPermissionMap;
    
    const recordMap = snapshot.recordMap;
    const fieldRole = getFieldRoleByFieldId(fieldPermissionMap, kanbanFieldId);

    const fieldMap = snapshot.meta.fieldMap;
    const field = fieldMap[kanbanFieldId];
    if (fieldRole === Role.None || !field) {
      return {
        UN_GROUP: rows.map(row => {
          return recordMap[row.recordId]!;
        }),
      };
    }

    const groupMap = this.getGroupValueMap(field);

    for (const { recordId } of rows) {
      const record = recordMap[recordId];
      if (!record) {
        console.warn('! ' + `${recordId} is not exist,check kanban data`);
        continue;
      }
      const fieldData = record.data[kanbanFieldId];

      if (fieldData == null) {
        groupMap[UN_GROUP]!.push(record);
        continue;
      }
      try {

        if (field.type === FieldType.Member) {
          const id = polyfillOldData(fieldData as IUnitIds)?.[0];
          id && groupMap[id]!.push(record);

          continue;
        }

        groupMap[fieldData as string]!.push(record);
      } catch (e) {
        console.warn('! ' + `${fieldData} is not exist,check kanban data`);
      }
    }

    return groupMap;
  }

  private getKanbanGroupMap(rows: IViewRow[], kanbanFieldId?: string | null) {
    const snapshot = this.state.datasheetMap[this.datasheetId]!.datasheet!.snapshot;
    const fieldPermissionMap = this.state.datasheetMap[this.datasheetId]?.fieldPermissionMap;
    if (!kanbanFieldId || !snapshot) {
      return {};
    }

    const view = getCurrentView(this.state);
    
    // 🔑 关键：根据配置选择不同的分组逻辑
    if (view && this.isCustomGroupMode(view)) {
      const customGroupMap = (view as any).style.customGroupMap;
      return this.getCustomKanbanGroupMap(rows, kanbanFieldId, customGroupMap);
    }

    // 默认逻辑：保持原有行为
    return this.getDefaultKanbanGroupMap(rows, kanbanFieldId);
  }

  // Sorting under Kanban view.
  private getSortRowsByKanbanGroup(view: IViewProperty, rows: IViewRow[], kanbanGroupMap: { [key: string]: IRecord[] } | undefined) {
    const snapshot = this.state.datasheetMap[this.datasheetId]?.datasheet!.snapshot;
    if (!view || view.type !== ViewType.Kanban || !snapshot) {
      return rows;
    }

    const kanbanFieldId = view?.style.kanbanFieldId;
    if (!kanbanFieldId) {
      return rows;
    }

    const field = snapshot.meta.fieldMap![kanbanFieldId];
    if (!field) {
      return rows;
    }

    const fieldPermissionMap = this.state.datasheetMap[this.datasheetId]?.fieldPermissionMap;

    if (getFieldRoleByFieldId(fieldPermissionMap, kanbanFieldId) === Role.None) {
      // kanbanFieldId Permissions have been set and are not visible to the current user,
      // there is no need to handle the following logic.
      return rows;
    }

    if (!kanbanGroupMap) {
      return rows;
    }

    let groupIds: string[];
    
    // 🔑 关键：根据模式获取不同的 groupIds
    if (this.isCustomGroupMode(view)) {
      const customGroupMap = (view as any).style.customGroupMap;
      // 自定义模式：按 order 排序获取自定义组ID
      groupIds = Object.values(customGroupMap)
        .sort((a: any, b: any) => a.order - b.order)
        .map((group: any) => group.id);
    } else {
      // 默认模式：从字段获取选项ID
      groupIds = field.type === FieldType.SingleSelect
        ? field.property.options.map(item => item.id)
        : (field as IMemberField).property.unitIds;
    }
    
    if (!Array.isArray(groupIds)) {
      return rows;
    }
    
    const flatRows = [UN_GROUP, ...groupIds].map(groupId => {
      const kanbanGroup = kanbanGroupMap[groupId];
      if (!kanbanGroup) {
        return [];
      }
      return kanbanGroup.map(record => ({ recordId: record.id }));
    }).flat();
    return flatRows;
  }

  override getViewDerivation(view?: IViewProperty): IViewDerivation {
    view = view || getCurrentView(this.state);
    const { rowsWithoutSearch } = super.getViewDerivation(view);
    const viewDerivationWithSearch = this.getViewDerivationWithSearch(view!, rowsWithoutSearch);
    return {
      rowsWithoutSearch,
      ...viewDerivationWithSearch
    };
  }

  override getViewDerivationWithSearch(view: IViewProperty, rowsWithoutSearch: IViewRow[]) {
    const kanbanGroupMapWithoutSearch = this.getKanbanGroupMap(rowsWithoutSearch, getKanbanFieldId(this.state));

    rowsWithoutSearch = this.getSortRowsByKanbanGroup(view!, rowsWithoutSearch, kanbanGroupMapWithoutSearch);

    const { visibleRows, searchResults } = this.getSearchRows(rowsWithoutSearch, view);
    const kanbanGroupMap = this.getKanbanGroupMap(visibleRows, getKanbanFieldId(this.state));
    const visibleRowsIndexMap = new Map(visibleRows.map((item, index) => [item.recordId, index]));

    return {
      // Raw rows of data, grouped without any filtering sorting.
      rowsIndexMap:  new Map(view!.rows!.map((item, index) => [item.recordId, index])),

      // Excluding pre-sorted row data, including filtered sorted grouped search
      pureVisibleRows: visibleRows,

      // Map of the row-order data after view property calculation
      pureVisibleRowsIndexMap: visibleRowsIndexMap,

      // Visual row data, including filtering sorting grouping search pre-sorting
      visibleRows,

      // A map with recordId as key and order as value
      visibleRowsIndexMap: visibleRowsIndexMap,

      // Kanban middle properties
      kanbanGroupMap,

      searchResults,
    };
  }
}
