'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

// Simple Zod-like validation (can be replaced with actual Zod later if needed)
interface ValidationResult {
  success: boolean;
  data?: any;
  error?: { field?: string; message: string }[];
}

const validateRegistrationInput = (data: any): ValidationResult => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { success: false, error: [{ field: 'name', message: 'Name is required.' }] };
  }
  if (!data.email || typeof data.email !== 'string' || !/\S+@\S+\.\S+/.test(data.email)) {
    return { success: false, error: [{ field: 'email', message: 'Invalid email address.' }] };
  }
  if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
    return { success: false, error: [{ field: 'password', message: 'Password must be at least 6 characters long.' }] };
  }
  return { success: true, data };
};


export async function registerUser(formData: {
  name: string;
  email: string;
  password: string;
}) {
  const validation = validateRegistrationInput(formData);
  if (!validation.success || !validation.data) {
    return { error: validation.error?.map(e => e.message).join(', ') || 'Invalid input.' };
  }

  const { name, email, password } = validation.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: 'User with this email already exists.' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
      },
    });

    // TODO: Send verification email if email verification is implemented

    return { success: 'User registered successfully.' };
  } catch (error) {
    console.error('Registration Server Action Error:', error);
    // In a real app, log this error to a logging service
    return { error: 'Could not register user. Please try again later.' };
  }
}
