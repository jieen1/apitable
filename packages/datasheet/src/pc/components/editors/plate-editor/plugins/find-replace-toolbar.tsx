import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { FindReplacePlugin } from '@udecode/plate-find-replace';
import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';

export function FindReplaceToolbar() {
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // 从编辑器状态获取当前搜索值
  const { editor, setOption } = useEditorPlugin(FindReplacePlugin);
  const search = usePluginOption(FindReplacePlugin, 'search');

  // 处理按键事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检测 Ctrl+F
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault(); // 阻止浏览器默认的搜索行为
        setIsVisible(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
      
      // 按ESC关闭搜索框
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
        // 清空搜索
        if (editor) {
          setOption('search', '');
          editor.api.redecorate();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, isVisible]);

  if (!isVisible) return null;

  // 设置搜索值的函数
  const setSearch = (value: string) => {
    if (editor) {
      setOption('search', value);
      editor.api.redecorate();
    }
  };

  return (
    <div className="absolute top-4 right-4 z-50 flex items-center bg-background border rounded-md shadow-md">
      <Input
        ref={inputRef}
        data-testid="EditorSearchInput"
        className="w-60 border-0 focus-visible:ring-0"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索文本..."
        type="search"
      />
    </div>
  );
} 