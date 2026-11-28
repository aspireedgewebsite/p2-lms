import type { Prisma } from '@prisma/client';

export const visibleLesson = { archivedAt: null, published: true } satisfies Prisma.LessonWhereInput;
export const lessonOrder = [{ position: 'asc' }, { id: 'asc' }] satisfies Prisma.LessonOrderByWithRelationInput[];
export const resourceOrder = [{ createdAt: 'asc' }, { id: 'asc' }] satisfies Prisma.LessonResourceOrderByWithRelationInput[];
