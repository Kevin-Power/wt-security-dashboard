import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';
import { env } from '../config/index.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Compare password
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

// Verify JWT token
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

// Register new user
export async function registerUser(
  email: string,
  password: string,
  name: string,
  role: string = 'viewer'
): Promise<{ user: UserResponse; token: string }> {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password and create user
  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role,
    },
  });

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: formatUserResponse(user),
    token,
  };
}

// Login user
export async function loginUser(
  email: string,
  password: string
): Promise<{ user: UserResponse; token: string }> {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    throw new Error('Account is disabled');
  }

  // Check password
  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: formatUserResponse(user),
    token,
  };
}

// Get user by ID
export async function getUserById(userId: string): Promise<UserResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;
  return formatUserResponse(user);
}

// Get all users (admin only)
export async function getAllUsers(): Promise<UserResponse[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return users.map(formatUserResponse);
}

// Update user
export async function updateUser(
  userId: string,
  data: { name?: string; role?: string; isActive?: boolean }
): Promise<UserResponse> {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return formatUserResponse(user);
}

// Change password
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await comparePassword(currentPassword, user.password);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
}

// Format user response (exclude password)
function formatUserResponse(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  password?: string;
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

// Create initial admin user if not exists
export async function createInitialAdmin(): Promise<void> {
  const adminExists = await prisma.user.findFirst({
    where: { role: 'admin' },
  });

  if (!adminExists) {
    const hashedPassword = await hashPassword('admin123');
    await prisma.user.create({
      data: {
        email: 'admin@wt.com',
        password: hashedPassword,
        name: 'Administrator',
        role: 'admin',
      },
    });
    console.log('Initial admin user created: admin@wt.com / admin123');
  }
}
