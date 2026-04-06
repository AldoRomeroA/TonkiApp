// src/models/User.ts
export interface User {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: Date;
} 