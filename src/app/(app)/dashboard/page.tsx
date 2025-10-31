'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
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
          // This case should ideally be handled by the layout or login page
          // but as a fallback, we redirect to login.
          router.push('/login');
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
                title: "Error",
                description: e.message,
            });
            router.push('/login');
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
