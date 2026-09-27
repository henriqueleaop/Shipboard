export abstract class BaseEntity {
  protected constructor(
    readonly id: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly deletedAt: Date | null,
  ) {}
}
