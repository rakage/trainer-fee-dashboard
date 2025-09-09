import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { UserRole } from '@/types';
import { hasRole } from './auth';

export async function requireAuth(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });
    
    console.log('Token in requireAuth:', token); // Debug log
    
    if (!token || !token.sub) {
      console.log('No token or sub found'); // Debug log
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return { user: { id: token.sub, role: (token.role as UserRole) || 'viewer' } };
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function requireRole(request: NextRequest, allowedRoles: UserRole[]) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });
    
    console.log('Token in requireRole:', token); // Debug log
    
    if (!token || !token.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userRole = (token.role as UserRole) || 'viewer';
    
    if (!hasRole(userRole, allowedRoles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return { user: { id: token.sub, role: userRole } };
  } catch (error) {
    console.error('Role middleware error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }
  
  if (entry.count >= maxRequests) {
    return false;
  }
  
  entry.count++;
  return true;
}
