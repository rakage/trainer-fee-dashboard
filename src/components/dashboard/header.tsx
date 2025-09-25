'use client';

import { signOut, useSession } from 'next-auth/react';
import { LogOut, Settings, BarChart3, Percent, Shield, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export function DashboardHeader() {
  const { data: session } = useSession();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSignOut = () => {
    signOut({
      callbackUrl: '/login',
    });
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    setPasswordMessage(null);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage({
        type: 'error',
        text: 'New password must be at least 6 characters long',
      });
      return;
    }

    setIsChangingPassword(true);
    setPasswordMessage(null);

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          setIsSettingsOpen(false);
          setPasswordMessage(null);
        }, 2000);
      } else {
        setPasswordMessage({ type: 'error', text: result.error || 'Failed to change password' });
      }
    } catch (error) {
      setPasswordMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'finance':
        return 'default';
      case 'trainer':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center px-4 md:px-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="Salsation Logo"
              width={32}
              height={32}
              className="object-contain"
              priority
              onError={(e) => {
                console.error('Logo failed to load:', e);
                // Hide the image if it fails to load
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h1 className="text-xl font-bold">Salsation Event Reports</h1>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-4 ml-6">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            {session?.user?.role === 'admin' && (
              <>
                <Link href="/dashboard/fee-params">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Fee Parameters
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Alejandro Reports
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/alejandro-report" className="w-full cursor-pointer">
                        Alejandro Instructor Trainer Fee
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/alejandro-events" className="w-full cursor-pointer">
                        Alejandro&apos;s Events
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="ml-auto flex items-center space-x-4">
          {session?.user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20"
                >
                  <span className="text-sm font-medium text-primary">
                    {getUserInitials(session.user.name || 'User')}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session.user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                    <Badge variant={getRoleBadgeVariant(session.user.role)} className="w-fit mt-1">
                      {getRoleLabel(session.user.role)}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSettingsClick}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Change your account password here.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                placeholder="Confirm new password"
              />
            </div>
            {passwordMessage && (
              <div
                className={`text-sm p-3 rounded ${
                  passwordMessage.type === 'success'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}
              >
                {passwordMessage.text}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSettingsOpen(false)}
              disabled={isChangingPassword}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={
                isChangingPassword ||
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
              }
            >
              {isChangingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
