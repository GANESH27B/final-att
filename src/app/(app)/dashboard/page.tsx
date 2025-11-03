'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function DashboardRedirector() {
  const { user, isUserLoading: loading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user && firestore) {
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef).then((docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const role = userData.role as UserRole;
          router.replace(`/dashboard/${role}`);
        } else {
          // If user is authenticated but has no firestore doc, send to login to re-auth
          // which might create the user doc.
          toast({
            variant: 'destructive',
            title: 'User data not found',
            description: 'Please log in again.',
          });
          router.replace('/login');
        }
      }).catch(e => {
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                variant: "destructive",
                title: "Error fetching user role",
                description: e.message,
            });
            router.replace('/login');
        }
      });
    }
  }, [user, loading, firestore, router, toast]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p>Loading your dashboard...</p>
    </div>
  );
}
