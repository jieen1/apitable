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

import React from 'react';
import styles from './toolbar.module.less';

interface ToolbarProps {
  children: React.ReactNode;
  variant?: 'default' | 'floating';
  'data-plain'?: boolean;
  className?: string;
}

interface ToolbarGroupProps {
  children: React.ReactNode;
  className?: string;
}

interface ToolbarSeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/**
 * Toolbar 容器组件
 * 用于组织编辑器工具栏的操作和控制
 */
export const Toolbar: React.FC<ToolbarProps> = ({ 
  children, 
  variant = 'default',
  'data-plain': dataPlain,
  className 
}) => {
  return (
    <div 
      className={`${styles.toolbar} ${styles[`toolbar--${variant}`]} ${dataPlain ? styles['toolbar--plain'] : ''} ${className || ''}`}
      role="toolbar"
      aria-label="编辑器工具栏"
    >
      {children}
    </div>
  );
};

/**
 * ToolbarGroup 组件
 * 用于对相关的工具栏按钮进行分组
 */
export const ToolbarGroup: React.FC<ToolbarGroupProps> = ({ children, className }) => {
  return (
    <div className={`${styles.toolbarGroup} ${className || ''}`} role="group">
      {children}
    </div>
  );
};

/**
 * ToolbarSeparator 组件
 * 用于在工具栏组之间添加视觉分隔
 */
export const ToolbarSeparator: React.FC<ToolbarSeparatorProps> = ({ 
  orientation = 'vertical',
  className 
}) => {
  return (
    <div 
      className={`${styles.toolbarSeparator} ${styles[`toolbarSeparator--${orientation}`]} ${className || ''}`}
      role="separator"
      aria-orientation={orientation}
    />
  );
};

