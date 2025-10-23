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
import styles from './button.module.less';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  'data-style'?: 'default' | 'ghost' | 'primary' | 'outline';
  'data-active'?: boolean;
  'data-size'?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * Button 组件
 * 用于工具栏的通用按钮组件
 */
export const Button: React.FC<ButtonProps> = ({ 
  children, 
  'data-style': dataStyle = 'default',
  'data-active': dataActive = false,
  'data-size': dataSize = 'medium',
  className,
  disabled,
  ...props 
}) => {
  const buttonClassName = [
    styles.button,
    styles[`button--${dataStyle}`],
    styles[`button--${dataSize}`],
    dataActive ? styles['button--active'] : '',
    disabled ? styles['button--disabled'] : '',
    className || ''
  ].filter(Boolean).join(' ');

  return (
    <button 
      className={buttonClassName}
      disabled={disabled}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
};

