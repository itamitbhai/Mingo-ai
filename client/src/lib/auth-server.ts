import { auth } from '@clerk/nextjs/server';

export async function getServerAuthToken(): Promise<string | null> {
  const { getToken } = await auth();
  return getToken();
}
