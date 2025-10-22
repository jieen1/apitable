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
import { Editor } from '@tiptap/react';
import { Button, Divider } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  HighlightOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  PictureOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import styles from './tiptap_toolbar.module.less';

interface ITiptapToolbarProps {
  editor: Editor | null;
}

/**
 * Tiptap 编辑器工具栏
 */
export const TiptapToolbar: React.FC<ITiptapToolbarProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const handleHeading = (level: 1 | 2 | 3) => {
    editor.chain().focus().toggleHeading({ level }).run();
  };

  const handleBold = () => {
    editor.chain().focus().toggleBold().run();
  };

  const handleItalic = () => {
    editor.chain().focus().toggleItalic().run();
  };

  const handleUnderline = () => {
    editor.chain().focus().toggleUnderline().run();
  };

  const handleStrike = () => {
    editor.chain().focus().toggleStrike().run();
  };

  const handleCode = () => {
    editor.chain().focus().toggleCode().run();
  };

  const handleHighlight = () => {
    editor.chain().focus().toggleHighlight().run();
  };

  const handleBulletList = () => {
    editor.chain().focus().toggleBulletList().run();
  };

  const handleOrderedList = () => {
    editor.chain().focus().toggleOrderedList().run();
  };

  const handleBlockquote = () => {
    editor.chain().focus().toggleBlockquote().run();
  };

  const handleCodeBlock = () => {
    editor.chain().focus().toggleCodeBlock().run();
  };

  const handleLink = () => {
    const url = window.prompt('输入链接地址:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleImage = () => {
    const url = window.prompt('输入图片地址:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleUndo = () => {
    editor.chain().focus().undo().run();
  };

  const handleRedo = () => {
    editor.chain().focus().redo().run();
  };

  const handleHorizontalRule = () => {
    editor.chain().focus().setHorizontalRule().run();
  };

  return (
    <div className={styles.toolbar}>
      {/* 撤销/重做 */}
      <Button.Group>
        <Button
          size="small"
          icon={<UndoOutlined />}
          onClick={handleUndo}
          disabled={!editor.can().undo()}
          title="撤销"
        />
        <Button
          size="small"
          icon={<RedoOutlined />}
          onClick={handleRedo}
          disabled={!editor.can().redo()}
          title="重做"
        />
      </Button.Group>

      <Divider type="vertical" />

      {/* 标题 */}
      <Button.Group>
        <Button
          size="small"
          onClick={() => handleHeading(1)}
          className={editor.isActive('heading', { level: 1 }) ? styles.active : ''}
          title="标题 1"
        >
          H1
        </Button>
        <Button
          size="small"
          onClick={() => handleHeading(2)}
          className={editor.isActive('heading', { level: 2 }) ? styles.active : ''}
          title="标题 2"
        >
          H2
        </Button>
        <Button
          size="small"
          onClick={() => handleHeading(3)}
          className={editor.isActive('heading', { level: 3 }) ? styles.active : ''}
          title="标题 3"
        >
          H3
        </Button>
      </Button.Group>

      <Divider type="vertical" />

      {/* 文本格式 */}
      <Button.Group>
        <Button
          size="small"
          icon={<BoldOutlined />}
          onClick={handleBold}
          className={editor.isActive('bold') ? styles.active : ''}
          title="粗体"
        />
        <Button
          size="small"
          icon={<ItalicOutlined />}
          onClick={handleItalic}
          className={editor.isActive('italic') ? styles.active : ''}
          title="斜体"
        />
        <Button
          size="small"
          icon={<UnderlineOutlined />}
          onClick={handleUnderline}
          className={editor.isActive('underline') ? styles.active : ''}
          title="下划线"
        />
        <Button
          size="small"
          icon={<StrikethroughOutlined />}
          onClick={handleStrike}
          className={editor.isActive('strike') ? styles.active : ''}
          title="删除线"
        />
        <Button
          size="small"
          icon={<CodeOutlined />}
          onClick={handleCode}
          className={editor.isActive('code') ? styles.active : ''}
          title="行内代码"
        />
        <Button
          size="small"
          icon={<HighlightOutlined />}
          onClick={handleHighlight}
          className={editor.isActive('highlight') ? styles.active : ''}
          title="高亮"
        />
      </Button.Group>

      <Divider type="vertical" />

      {/* 列表 */}
      <Button.Group>
        <Button
          size="small"
          icon={<UnorderedListOutlined />}
          onClick={handleBulletList}
          className={editor.isActive('bulletList') ? styles.active : ''}
          title="无序列表"
        />
        <Button
          size="small"
          icon={<OrderedListOutlined />}
          onClick={handleOrderedList}
          className={editor.isActive('orderedList') ? styles.active : ''}
          title="有序列表"
        />
      </Button.Group>

      <Divider type="vertical" />

      {/* 插入 */}
      <Button.Group>
        <Button
          size="small"
          icon={<LinkOutlined />}
          onClick={handleLink}
          className={editor.isActive('link') ? styles.active : ''}
          title="插入链接"
        />
        <Button
          size="small"
          icon={<PictureOutlined />}
          onClick={handleImage}
          title="插入图片"
        />
      </Button.Group>

      <Divider type="vertical" />

      {/* 其他 */}
      <Button.Group>
        <Button
          size="small"
          onClick={handleBlockquote}
          className={editor.isActive('blockquote') ? styles.active : ''}
          title="引用块"
        >
          &quot;
        </Button>
        <Button
          size="small"
          onClick={handleCodeBlock}
          className={editor.isActive('codeBlock') ? styles.active : ''}
          title="代码块"
        >
          {'</>'}
        </Button>
        <Button
          size="small"
          onClick={handleHorizontalRule}
          title="水平分割线"
        >
          —
        </Button>
      </Button.Group>
    </div>
  );
};

