import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/sqlite';
import { ActivityLogger } from '@/lib/activity-logger';
import { UserRole } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: userId } = await params;
    const body = await request.json();
    const { name, role } = body;

    // Validate role if provided
    if (role) {
      const validRoles: UserRole[] = ['admin', 'finance', 'trainer', 'viewer'];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role specified' },
          { status: 400 }
        );
      }
    }

    // Get existing user
    const existingUser = UserService.findById(userId);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent admin from changing their own role (to prevent lockout)
    if (userId === session.user.id && role && role !== existingUser.role) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await UserService.updateUser(userId, {
      name: name || existingUser.name,
      role: role || existingUser.role,
    });

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    // Log the activity
    const changes = [];
    if (name && name !== existingUser.name) changes.push(`name: ${existingUser.name} → ${name}`);
    if (role && role !== existingUser.role) changes.push(`role: ${existingUser.role} → ${role}`);
    
    await ActivityLogger.log(
      session.user.id,
      'update_user',
      null,
      `Admin updated user: ${existingUser.email} (${changes.join(', ')})`
    );

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: userId } = await params;

    // Prevent admin from deleting themselves
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Get existing user for logging
    const existingUser = UserService.findById(userId);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete user
    const success = await UserService.deleteUser(userId);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }

    // Log the activity
    await ActivityLogger.log(
      session.user.id,
      'delete_user',
      null,
      `Admin deleted user: ${existingUser.name} (${existingUser.email})`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
