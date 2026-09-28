import { randomUUID } from 'node:crypto';
import { isReservedBoardSlug } from '@shipboard/contracts/board-slugs';

import { BaseEntity } from '../../../shared/domain/base-entity.js';

export interface BoardState {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Board extends BaseEntity {
  readonly ownerId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly version: number;

  constructor(state: BoardState) {
    super(state.id, state.createdAt, state.updatedAt, state.deletedAt);
    this.ownerId = state.ownerId;
    this.name = state.name;
    this.slug = state.slug;
    this.description = state.description;
    this.version = state.version;
  }

  static create(
    ownerId: string,
    metadata: { name: string; slug: string; description: string },
    now = new Date(),
  ): Board {
    if (
      !metadata.name.trim() ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug) ||
      isReservedBoardSlug(metadata.slug)
    ) {
      throw new Error('Invalid board metadata.');
    }
    return new Board({
      id: randomUUID(),
      ownerId,
      name: metadata.name.trim(),
      slug: metadata.slug,
      description: metadata.description,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  withMetadata(
    metadata: Partial<Pick<BoardState, 'name' | 'slug' | 'description'>>,
    now = new Date(),
  ): Board {
    if (
      (metadata.name !== undefined && !metadata.name.trim()) ||
      (metadata.slug !== undefined &&
        (isReservedBoardSlug(metadata.slug) ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug)))
    ) {
      throw new Error('Invalid board metadata.');
    }
    return new Board({
      id: this.id,
      ownerId: this.ownerId,
      name: metadata.name ?? this.name,
      slug: metadata.slug ?? this.slug,
      description: metadata.description ?? this.description,
      version: this.version + 1,
      createdAt: this.createdAt,
      updatedAt: now,
      deletedAt: this.deletedAt,
    });
  }

  removed(now = new Date()): Board {
    return new Board({
      id: this.id,
      ownerId: this.ownerId,
      name: this.name,
      slug: this.slug,
      description: this.description,
      version: this.version + 1,
      createdAt: this.createdAt,
      updatedAt: now,
      deletedAt: now,
    });
  }
}
