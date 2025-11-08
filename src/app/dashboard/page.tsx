
'use client';

import { useUser, useFirestore } from '@/firebase';
import { User } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page acts as a router to the correct dashboard based on the user's role.
export default function DashboardRedirectPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    useEffect(() => {
        if (isUserLoading || !firestore) {
            return; // Wait for user and firestore to be available
        }

        if (!user) {
            router.replace('/login');
            return;
        }

        const userDocRef = doc(firestore, 'users', user.uid);
        getDoc(userDocRef).then((docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data() as User;
                switch (userData.role) {
                    case 'admin':
                        router.replace('/dashboard/admin');
                        break;
                    case 'faculty':
                        router.replace('/dashboard/faculty');
                        break;
                    case 'student':
                        router.replace('/dashboard/student');
                        break;
                    default:
                        // Fallback to a generic profile page or login if role is unknown
                        router.replace('/dashboard/profile');
                        break;
                }
            } else {
                // If user document doesn't exist, they can't proceed
                router.replace('/login');
            }
        });
    }, [user, isUserLoading, firestore, router]);


    // Return a loading state while redirecting
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <p>Loading your dashboard...</p>
        </div>
    );
}
