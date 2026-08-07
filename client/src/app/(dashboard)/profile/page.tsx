import type { Metadata } from 'next';

import { ProfileView } from '@/features/profile/profile-view';
import { getServerAuthToken } from '@/lib/auth-server';
import { getProfile } from '@/services/profile.service';

export const metadata: Metadata = {
  title: 'Profile',
};

export default async function ProfilePage() {
  const token = await getServerAuthToken();
  const user = await getProfile(token);

  return (
    <div className="mx-auto max-w-4xl">
      <ProfileView user={user} />
    </div>
  );
}
