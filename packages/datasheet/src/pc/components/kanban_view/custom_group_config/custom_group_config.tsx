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

import React, { useState } from 'react';
import { Button, TextInput, useThemeColors, Typography } from '@apitable/components';
import { AddOutlined, DeleteOutlined } from '@apitable/icons';
import { FieldType, IField, Selectors, KanbanView, t, Strings } from '@apitable/core';
import { useAppSelector } from 'pc/store/react-redux';
import styles from './styles.module.less';

interface ICustomGroupConfigProps {
  field: IField;
  onSave: (customGroupMap: any) => void;
  onCancel: () => void;
}

export const CustomGroupConfig: React.FC<ICustomGroupConfigProps> = ({ field, onSave, onCancel }) => {
  const colors = useThemeColors();
  const view = useAppSelector(Selectors.getCurrentView) as any;
  
  // 初始化自定义分组配置
  const [customGroupMap, setCustomGroupMap] = useState<any>(() => {
    // 如果已有自定义配置，使用现有配置
    if (view.style.customGroupMap && Object.keys(view.style.customGroupMap).length > 0) {
      return { ...view.style.customGroupMap };
    }
    // 否则生成默认配置（每个选项一个组）
    return KanbanView.generateDefaultCustomGroupMap(field);
  });

  // 获取所有可用的选项
  const availableOptions = React.useMemo(() => {
    if (field.type === FieldType.SingleSelect) {
      return field.property.options.map((opt: any) => ({
        id: opt.id,
        name: opt.name,
        color: opt.color,
      }));
    } else if (field.type === FieldType.Member) {
      // Member 字段的处理
      const unitIds = (field.property as any).unitIds || [];
      return unitIds.map((unitId: string) => ({
        id: unitId,
        name: unitId, // TODO: 需要查询用户名
        color: undefined,
      }));
    }
    return [];
  }, [field]);

  // 获取已分配的选项ID
  const assignedOptionIds = React.useMemo(() => {
    const ids = new Set<string>();
    Object.values(customGroupMap).forEach((group: any) => {
      group.optionIds.forEach((id: string) => ids.add(id));
    });
    return ids;
  }, [customGroupMap]);

  // 获取未分配的选项
  const unassignedOptions = React.useMemo(() => {
    return availableOptions.filter(opt => !assignedOptionIds.has(opt.id));
  }, [availableOptions, assignedOptionIds]);

  // 按 order 排序的分组列表
  const sortedGroups = React.useMemo(() => {
    return Object.values(customGroupMap).sort((a: any, b: any) => a.order - b.order);
  }, [customGroupMap]);

  // 创建新组
  const handleCreateGroup = () => {
    const newGroupId = KanbanView.generateCustomGroupId();
    const maxOrder = Math.max(...Object.values(customGroupMap).map((g: any) => g.order), -1);
    
    setCustomGroupMap({
      ...customGroupMap,
      [newGroupId]: {
        id: newGroupId,
        name: `新分组 ${sortedGroups.length + 1}`,
        optionIds: [],
        order: maxOrder + 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  };

  // 删除组
  const handleDeleteGroup = (groupId: string) => {
    const newMap = { ...customGroupMap };
    delete newMap[groupId];
    setCustomGroupMap(newMap);
  };

  // 更新组名
  const handleUpdateGroupName = (groupId: string, newName: string) => {
    setCustomGroupMap({
      ...customGroupMap,
      [groupId]: {
        ...customGroupMap[groupId],
        name: newName,
        updatedAt: Date.now(),
      },
    });
  };

  // 从组中移除选项
  const handleRemoveOptionFromGroup = (groupId: string, optionId: string) => {
    const group = customGroupMap[groupId];
    const newOptionIds = group.optionIds.filter((id: string) => id !== optionId);
    
    setCustomGroupMap({
      ...customGroupMap,
      [groupId]: {
        ...group,
        optionIds: newOptionIds,
        updatedAt: Date.now(),
      },
    });
  };

  // 添加选项到组
  const handleAddOptionToGroup = (groupId: string, optionId: string) => {
    const group = customGroupMap[groupId];
    
    setCustomGroupMap({
      ...customGroupMap,
      [groupId]: {
        ...group,
        optionIds: [...group.optionIds, optionId],
        updatedAt: Date.now(),
      },
    });
  };

  // 保存配置
  const handleSave = () => {
    // 验证配置
    const validation = KanbanView.validateCustomGroupMap(
      customGroupMap,
      { [field.id]: field } as any,
      field.id
    );

    if (!validation.valid) {
      console.error('Invalid custom group map:', validation.errors);
      // TODO: 显示错误提示
      return;
    }

    onSave(customGroupMap);
  };

  return (
    <div className={styles.customGroupConfig}>
      <div className={styles.header}>
        <Typography variant="h6">自定义分组配置</Typography>
        <Typography variant="body4" color={colors.fc3}>
          将多个选项合并到一个看板分组中
        </Typography>
      </div>

      <div className={styles.content}>
        {/* 自定义分组列表 */}
        <div className={styles.groupList}>
          {sortedGroups.map((group: any) => (
            <div key={group.id} className={styles.groupItem}>
              <div className={styles.groupHeader}>
                <TextInput
                  value={group.name}
                  onChange={(e) => handleUpdateGroupName(group.id, e.target.value)}
                  className={styles.groupNameInput}
                />
                <Button
                  size="small"
                  shape="circle"
                  onClick={() => handleDeleteGroup(group.id)}
                >
                  <DeleteOutlined />
                </Button>
              </div>

              <div className={styles.groupOptions}>
                {group.optionIds.length === 0 ? (
                  <div className={styles.emptyOptions}>
                    <Typography variant="body4" color={colors.fc3}>
                      请从下方未分配选项中添加
                    </Typography>
                  </div>
                ) : (
                  group.optionIds.map((optionId: string) => {
                    const option = availableOptions.find(opt => opt.id === optionId);
                    if (!option) return null;
                    
                    return (
                      <div key={optionId} className={styles.optionTag}>
                        <span>{option.name}</span>
                        <span
                          className={styles.removeOption}
                          onClick={() => handleRemoveOptionFromGroup(group.id, optionId)}
                        >
                          ×
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 创建新组按钮 */}
        <Button
          onClick={handleCreateGroup}
          prefixIcon={<AddOutlined />}
          block
          className={styles.createGroupButton}
        >
          创建新分组
        </Button>

        {/* 未分配的选项 */}
        {unassignedOptions.length > 0 && (
          <div className={styles.unassignedSection}>
            <Typography variant="body3">未分配的选项</Typography>
            <div className={styles.unassignedOptions}>
              {unassignedOptions.map((option) => (
                <div
                  key={option.id}
                  className={styles.unassignedOption}
                  draggable
                >
                  <span>{option.name}</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddOptionToGroup(e.target.value, option.id);
                      }
                    }}
                    value=""
                    className={styles.assignSelect}
                  >
                    <option value="">添加到...</option>
                    {sortedGroups.map((group: any) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button onClick={onCancel}>取消</Button>
        <Button color="primary" onClick={handleSave}>
          保存配置
        </Button>
      </div>
    </div>
  );
};

