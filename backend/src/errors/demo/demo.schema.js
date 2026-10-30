import { z } from 'zod';

export const declarationIdSchema = z.object({
  id: z.string().regex(/^decl-\d{3}$/, 'Invalid declaration ID'),
});

export const declarationSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  type: z.enum(['lost', 'found']),
  category: z.string().min(2).max(50),
});

