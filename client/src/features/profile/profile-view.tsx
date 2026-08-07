'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PLAN_LIMITS, updateProfileSchema, type IUser, type UpdateProfileInput } from 'shared';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { updateProfile } from '@/services/profile.service';
import { formatDate, getInitials } from '@/utils/format';

function ProfileStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

export function ProfileView({ user }: { user: IUser }) {
  const [isEditing, setIsEditing] = useState(false);
  const { getToken } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      workspace: user.workspace,
      bio: user.bio,
    },
  });

  const startEditing = () => {
    reset({
      firstName: user.firstName,
      lastName: user.lastName,
      workspace: user.workspace,
      bio: user.bio,
    });
    setIsEditing(true);
  };

  const onSubmit = async (data: UpdateProfileInput) => {
    try {
      const token = await getToken();
      await updateProfile(data, token);
      toast.success('Profile updated');
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update profile');
    }
  };

  return (
    <Card className="glass-card">
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={user.avatarUrl} alt={user.firstName} />
              <AvatarFallback className="text-lg">
                {getInitials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          {!isEditing && (
            <Button variant="outline" onClick={startEditing}>
              <Pencil className="size-4" /> Edit Profile
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border-t border-border/60 pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" {...register('firstName')} />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...register('lastName')} />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workspace">Workspace name</Label>
              <Input id="workspace" {...register('workspace')} />
              {errors.workspace && (
                <p className="text-xs text-destructive">{errors.workspace.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={3} placeholder="Tell us about yourself" {...register('bio')} />
              {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-4 border-t border-border/60 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <ProfileStat label="Workspace" value={user.workspace} />
            <ProfileStat label="Plan" value={<Badge>{PLAN_LIMITS[user.plan].label}</Badge>} />
            <ProfileStat label="Joined" value={formatDate(user.createdAt)} />
            <ProfileStat label="Bio" value={user.bio || 'No bio yet'} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
