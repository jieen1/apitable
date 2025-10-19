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

import { BaseEntity } from 'shared/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

/**
 * WorkDoc Document Entity
 * Stores Y.js document state for collaborative editing
 */
@Entity('workdoc_document')
export class WorkdocDocumentEntity extends BaseEntity {
  @Column({
    name: 'document_id',
    nullable: false,
    unique: true,
    comment: 'Document ID (same as documentId in datasheet cell)',
    length: 50,
  })
  documentId!: string;

  @Index()
  @Column({
    name: 'dst_id',
    nullable: false,
    comment: 'Datasheet ID',
    length: 50,
  })
  dstId!: string;

  @Index()
  @Column({
    name: 'field_id',
    nullable: false,
    comment: 'Field ID',
    length: 50,
  })
  fieldId!: string;

  @Index()
  @Column({
    name: 'record_id',
    nullable: false,
    comment: 'Record ID',
    length: 50,
  })
  recordId!: string;

  @Column({
    name: 'title',
    nullable: true,
    comment: 'Document title',
    length: 255,
  })
  title?: string;

  @Column({
    name: 'content',
    type: 'mediumblob',
    nullable: true,
    comment: 'Y.js document state (Uint8Array)',
  })
  content?: Buffer;
}

