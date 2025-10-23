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
import { Toolbar, ToolbarGroup, ToolbarSeparator } from './primitives/toolbar';
import { Button } from './primitives/button';
import { Spacer } from './primitives/spacer';

interface ITiptapToolbarProps {
  editor: Editor | null;
}

/**
 * Tiptap 编辑器工具栏
 * 使用官方推荐的 Toolbar 架构
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
    <Toolbar variant="default">
      {/* 撤销/重做 */}
      <ToolbarGroup>
        <Button
          data-style="ghost"
          data-size="small"
          onClick={handleUndo}
          disabled={!editor.can().undo()}
          title="撤销"
        >
          <UndoOutlined />
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          onClick={handleRedo}
          disabled={!editor.can().redo()}
          title="重做"
        >
          <RedoOutlined />
        </Button>
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* 标题 */}
      <ToolbarGroup>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('heading', { level: 1 })}
          onClick={() => handleHeading(1)}
          title="标题 1"
        >
          H1
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('heading', { level: 2 })}
          onClick={() => handleHeading(2)}
          title="标题 2"
        >
          H2
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('heading', { level: 3 })}
          onClick={() => handleHeading(3)}
          title="标题 3"
        >
          H3
        </Button>
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* 文本格式 */}
      <ToolbarGroup>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('bold')}
          onClick={handleBold}
          title="粗体"
        >
          <BoldOutlined />
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('italic')}
          onClick={handleItalic}
          title="斜体"
        >
          <ItalicOutlined />
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('underline')}
          onClick={handleUnderline}
          title="下划线"
        >
          <UnderlineOutlined />
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('strike')}
          onClick={handleStrike}
          title="删除线"
        >
          <StrikethroughOutlined />
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('code')}
          onClick={handleCode}
          title="行内代码"
        >
          <CodeOutlined />
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('highlight')}
          onClick={handleHighlight}
          title="高亮"
        >
          <HighlightOutlined />
        </Button>
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* 列表 */}
      <ToolbarGroup>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('bulletList')}
          onClick={handleBulletList}
          title="无序列表"
        >
          <UnorderedListOutlined />
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('orderedList')}
          onClick={handleOrderedList}
          title="有序列表"
        >
          <OrderedListOutlined />
        </Button>
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* 插入 */}
      <ToolbarGroup>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('link')}
          onClick={handleLink}
          title="插入链接"
        >
          <LinkOutlined />
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          onClick={handleImage}
          title="插入图片"
        >
          <PictureOutlined />
        </Button>
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* 其他 */}
      <ToolbarGroup>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('blockquote')}
          onClick={handleBlockquote}
          title="引用块"
        >
          &quot;
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          data-active={editor.isActive('codeBlock')}
          onClick={handleCodeBlock}
          title="代码块"
        >
          {'</>'}
        </Button>
        <Button
          data-style="ghost"
          data-size="small"
          onClick={handleHorizontalRule}
          title="水平分割线"
        >
          —
        </Button>
      </ToolbarGroup>

      <Spacer />
    </Toolbar>
  );
};
