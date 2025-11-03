'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

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
          // Redirect to the role-specific dashboard.
          if (role === 'admin') {
            router.replace('/dashboard/admin');
          } else if (role === 'faculty') {
            router.replace('/dashboard/faculty');
          } else if (role === 'student') {
            router.replace('/dashboard/student');
          } else {
             toast({
                variant: 'destructive',
                title: 'Unknown user role',
                description: 'Could not determine your dashboard.',
             });
             router.replace('/login');
          }
        } else {
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
       <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    </div>
  );
}
