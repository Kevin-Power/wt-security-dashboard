import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, JwtPayload } from '../services/auth.js';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

// Authentication middleware - verifies JWT token
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    
    request.user = payload;
  } catch (error) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

// Authorization middleware - checks if user has required role
export function authorize(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      reply.code(403).send({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }
  };
}

// Optional authentication - doesn't fail if no token provided
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      request.user = payload;
    }
  } catch {
    // Ignore errors for optional auth
  }
}
