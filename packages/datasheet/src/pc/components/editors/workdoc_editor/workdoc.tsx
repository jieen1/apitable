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

import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Input, InputRef, Drawer } from 'antd';
import { ICellValue, Strings, t, IWorkDocValue } from '@apitable/core';
import { EditOutlined } from '@apitable/icons';
import { useAppSelector } from 'pc/store/react-redux';
import { PlateCollaborativeEditor } from './plate_collaborative_editor';
import { Status } from './interface';
import styles from './workdoc.module.less';

interface IWorkDocCellValue extends IWorkDocValue {
}

interface IWorkdocProps {
  datasheetId: string;
  cellValue?: ICellValue;
  editing?: boolean;
  toggleEditing?: (next?: boolean) => void;
  fieldId: string;
  recordId?: string;
  onSave?: (val: any) => void;
  editable?: boolean;
}

/**
 * 生成唯一文档 ID
 */
const generateDocumentId = () => {
  return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Workdoc 协作文档编辑器组件
 * 使用 Tiptap + Hocuspocus 实现实时协作编辑
 */
export const Workdoc: React.FC<IWorkdocProps> = (props) => {
  const { 
    editing = false, 
    toggleEditing, 
    cellValue, 
    onSave, 
    editable = true, 
    datasheetId, 
    fieldId, 
    recordId 
  } = props;
  
  const userInfo = useAppSelector(state => state.user.info);
  const [status, setStatus] = useState<Status>(Status.Connecting);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState('');
  const titleInputRef = useRef<InputRef>(null);

  // 获取或创建文档元数据
  const documentMeta = useMemo<IWorkDocCellValue>(() => {
    const value = cellValue as IWorkDocCellValue[];
    if (value && Array.isArray(value) && value.length > 0) {
      return value[0];
    }
    // 创建新文档
    return {
      documentId: generateDocumentId(),
      title: '',
    };
  }, [cellValue]);

  // 首次编辑时保存文档元数据
  useEffect(() => {
    if (editing && (!cellValue || (cellValue as IWorkDocCellValue[]).length === 0)) {
      const saveValue: IWorkDocValue[] = [documentMeta];
      onSave?.(saveValue);
    }
  }, [editing, cellValue, documentMeta, onSave]);

  // 初始化标题编辑
  useEffect(() => {
    if (isEditingTitle) {
      setLocalTitle(documentMeta.title || '');
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle, documentMeta.title]);

  // 保存文档元数据
  const saveDocumentMeta = useCallback((title: string) => {
    const saveValue: IWorkDocValue[] = [{
      documentId: documentMeta.documentId,
      title: title || documentMeta.title || '',
    }];
    onSave?.(saveValue);
  }, [documentMeta, onSave]);

  // 标题编辑相关
  const handleTitleEdit = useCallback(() => {
    if (editable) {
      setIsEditingTitle(true);
    }
  }, [editable]);

  const handleTitleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTitle(e.target.value);
  }, []);

  const handleTitleSave = useCallback(() => {
    setIsEditingTitle(false);
    if (localTitle !== documentMeta.title) {
      saveDocumentMeta(localTitle);
    }
  }, [localTitle, documentMeta.title, saveDocumentMeta]);

  const handleTitleInputBlur = useCallback(() => {
    handleTitleSave();
  }, [handleTitleSave]);

  const handleTitleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  }, [handleTitleSave]);

  const handleClose = useCallback(() => {
    toggleEditing?.(false);
  }, [toggleEditing]);

  // 连接状态改变处理
  const handleConnectionChange = useCallback((connectionStatus: 'connecting' | 'connected' | 'disconnected') => {
    const statusMap = {
      connecting: Status.Connecting,
      connected: Status.Connected,
      disconnected: Status.Disconnected,
    };
    setStatus(statusMap[connectionStatus]);
  }, []);

  // 当前显示的标题
  const displayTitle = useMemo(() => {
    if (isEditingTitle) {
      return localTitle;
    }
    return documentMeta.title || '未命名文档';
  }, [isEditingTitle, localTitle, documentMeta.title]);

  // 用户颜色（根据用户ID生成）
  const userColor = useMemo(() => {
    if (!userInfo?.uuid) return '#' + Math.floor(Math.random() * 16777215).toString(16);
    // 根据用户ID生成固定颜色
    let hash = 0;
    for (let i = 0; i < userInfo.uuid.length; i++) {
      hash = userInfo.uuid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1) * 16777215);
    return '#' + color.toString(16).padStart(6, '0');
  }, [userInfo?.uuid]);

  if (!editing) {
    return null;
  }

  return (
    <Drawer
      open={editing}
      onClose={handleClose}
      width={800}
      placement="right"
      maskClosable={true}
      destroyOnClose={false}
      className={styles.workdoc}
      title={
        <div className={styles.header}>
          <div className={styles.status}>
            {status === Status.Connecting && (
              <span className={styles.connecting}>{t(Strings.workdoc_ws_connecting)}</span>
            )}
            {status === Status.Connected && (
              <span className={styles.connected}>{t(Strings.workdoc_ws_connected)}</span>
            )}
            {status === Status.Disconnected && (
              <span className={styles.disconnected}>{t(Strings.workdoc_ws_disconnected)}</span>
            )}
            {status === Status.Error && (
              <span className={styles.error}>{t(Strings.workdoc_ws_disconnected)}</span>
            )}
          </div>
          <div className={styles.titleSection}>
            {isEditingTitle ? (
              <Input
                ref={titleInputRef}
                value={displayTitle}
                onChange={handleTitleInputChange}
                onBlur={handleTitleInputBlur}
                onPressEnter={handleTitleInputKeyDown}
                className={styles.titleInput}
                maxLength={100}
              />
            ) : (
              <span className={styles.title} onClick={handleTitleEdit}>
                {displayTitle}
                {editable && <EditOutlined className={styles.editIcon} />}
              </span>
            )}
          </div>
        </div>
      }
      footer={null}
    >
      <div className={styles.editorContainer}>
        {userInfo?.uuid && recordId && (
          <PlateCollaborativeEditor
            documentId={documentMeta.documentId}
            userId={userInfo.uuid}
            userName={userInfo.nickName || userInfo.memberName || 'Anonymous'}
            userColor={userColor}
            resourceId={datasheetId}
            fieldId={fieldId}
            recordId={recordId}
            title={documentMeta.title || ''}
            readOnly={!editable}
            placeholder="开始编辑文档内容..."
            onConnectionChange={handleConnectionChange}
          />
        )}
      </div>
    </Drawer>
  );
};
