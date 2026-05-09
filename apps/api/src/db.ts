import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const now = () => new Date().toISOString();
