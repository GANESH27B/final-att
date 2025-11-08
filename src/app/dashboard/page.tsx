'use client';

import { useUser, useFirestore } from '@/firebase';
import { User } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

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
                console.error("User document not found for UID:", user.uid);
                router.replace('/login');
            }
        }).catch(err => {
            console.error("Error fetching user document:", err);
            router.replace('/login');
        });
    }, [user, isUserLoading, firestore, router]);


    // Return a loading state while redirecting
    return (
        <div className="flex h-screen w-full items-center justify-center">
             <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">Loading your dashboard...</p>
            </div>
        </div>
    );
}
