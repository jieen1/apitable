'use client';

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ReactNode } from 'react';

import { Plate } from '@udecode/plate/react';

import { useCreateEditor } from '@/components/editor/use-create-editor';
import { Editor, EditorContainer } from '@/components/plate-ui/editor';
import { mentionPlugin } from './plugins/mention-plugin';
import { wikiLinkPlugin } from './plugins/wikilink-plugin';

interface PlateEditorProps {
  value: any[];
  onChange: (value: any) => void;
  readOnly: boolean;
  editor?: any;
  children?: ReactNode;
  className: string;
  setActiveItem: (item: string) => void;
}

export function PlateEditor({ value, onChange, readOnly, editor, children, className, setActiveItem }: PlateEditorProps) {
  if (!editor) {
    editor = useCreateEditor({
      value: value,
      override: {
        plugins: {
          'mention': mentionPlugin.extend({
            options: {
              setActiveItem: setActiveItem
            }
          }),
          'wikiLink': wikiLinkPlugin.extend({
            options: {
              setActiveItem: setActiveItem
            }
          })
        }
      }
    });
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <Plate editor={editor} onValueChange={onChange} >
        <div className="relative">
          <EditorContainer variant="default" className={className}>
            <Editor variant="default" readOnly={readOnly} className='min-h-200'/>
          </EditorContainer>
          {children}
        </div>
      </Plate>
    </DndProvider>
  );
}
