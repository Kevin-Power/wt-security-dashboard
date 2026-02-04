import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  registerUser,
  loginUser,
  getUserById,
  getAllUsers,
  updateUser,
  changePassword,
} from '../services/auth.js';
import { authenticate, authorize } from '../middleware/auth.js';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['admin', 'viewer']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['admin', 'viewer']).optional(),
  isActive: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/register - Register new user (admin only after initial setup)
  fastify.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      const result = await registerUser(body.email, body.password, body.name, body.role);
      
      reply.code(201).send({
        message: 'User registered successfully',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      reply.code(400).send({ error: 'Bad Request', message });
    }
  });

  // POST /auth/login - Login user
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      const result = await loginUser(body.email, body.password);
      
      reply.send({
        message: 'Login successful',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      reply.code(401).send({ error: 'Unauthorized', message });
    }
  });

  // GET /auth/me - Get current user
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const user = await getUserById(request.user!.userId);
      
      if (!user) {
        reply.code(404).send({ error: 'Not Found', message: 'User not found' });
        return;
      }

      reply.send({ user });
    } catch (error) {
      reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to get user' });
    }
  });

  // GET /auth/users - Get all users (admin only)
  fastify.get(
    '/users',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      try {
        const users = await getAllUsers();
        reply.send({ users });
      } catch (error) {
        reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to get users' });
      }
    }
  );

  // PUT /auth/users/:id - Update user (admin only)
  fastify.put<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const body = updateUserSchema.parse(request.body);
        
        const user = await updateUser(id, body);
        reply.send({ message: 'User updated successfully', user });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Update failed';
        reply.code(400).send({ error: 'Bad Request', message });
      }
    }
  );

  // POST /auth/change-password - Change own password
  fastify.post(
    '/change-password',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const body = changePasswordSchema.parse(request.body);
        
        await changePassword(
          request.user!.userId,
          body.currentPassword,
          body.newPassword
        );
        
        reply.send({ message: 'Password changed successfully' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Password change failed';
        reply.code(400).send({ error: 'Bad Request', message });
      }
    }
  );
}
