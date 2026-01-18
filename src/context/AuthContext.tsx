import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

interface AuthContextType {
    user: User | null;
    avatar: string | null;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    updateName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [avatar, setAvatar] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch random avatar from backend
    const fetchRandomAvatar = async () => {
        try {
            const response = await fetch(`${API_BASE}/avatars/random`);
            if (response.ok) {
                const data = await response.json();
                return data.url;
            }
        } catch (error) {
            console.error('Failed to fetch random avatar:', error);
        }
        return null;
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Check if we already have an avatar for this user in localStorage
                const storedAvatar = localStorage.getItem(`avatar_${currentUser.uid}`);
                if (storedAvatar) {
                    setAvatar(storedAvatar);
                } else {
                    // Fetch new random avatar
                    const newAvatar = await fetchRandomAvatar();
                    if (newAvatar) {
                        setAvatar(newAvatar);
                        localStorage.setItem(`avatar_${currentUser.uid}`, newAvatar);
                    }
                }
            } else {
                setAvatar(null);
            }

            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed", error);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setAvatar(null);
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const updateName = async (name: string) => {
        if (auth.currentUser) {
            try {
                await updateProfile(auth.currentUser, { displayName: name });
                setUser({ ...auth.currentUser, displayName: name });
            } catch (error) {
                console.error("Failed to update name", error);
                throw error;
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, avatar, isLoading, login, logout, updateName }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
