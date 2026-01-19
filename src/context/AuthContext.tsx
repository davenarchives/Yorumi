import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { getRandomAvatar } from '../utils/avatars';
import { syncStorage } from '../utils/storage';

interface AuthContextType {
    user: User | null;
    avatar: string | null;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    updateName: (name: string) => Promise<void>;
    updateAvatar: (path: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API URL - Assume localhost for dev or relative path in prod
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [avatar, setAvatar] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUserAvatar = async () => {
        try {
            const res = await fetch(`${API_URL}/user/avatar`);
            if (res.ok) {
                const data = await res.json();
                if (data.avatar) {
                    setAvatar(data.avatar);
                    return data.avatar;
                }
            }
        } catch (error) {
            console.error('Failed to fetch user avatar:', error);
        }
        return null;
    };

    const saveUserAvatar = async (newAvatar: string) => {
        try {
            await fetch(`${API_URL}/user/avatar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatarUrl: newAvatar })
            });
        } catch (error) {
            console.error('Failed to save user avatar:', error);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Sync data from cloud
                try {
                    await syncStorage.pullFromCloud();
                } catch (e) {
                    console.error("Failed to sync on login", e);
                }

                // 1. Try to get avatar from Backend (DB)
                const dbAvatar = await fetchUserAvatar();

                if (!dbAvatar) {
                    // 2. If no DB avatar, check legacy LocalStorage
                    const storedAvatar = localStorage.getItem(`avatar_${currentUser.uid}`);
                    if (storedAvatar) {
                        setAvatar(storedAvatar);
                        // Migrate to DB
                        saveUserAvatar(storedAvatar);
                    } else {
                        // 3. If nothing, generate random and save to DB
                        const newAvatar = getRandomAvatar();
                        setAvatar(newAvatar);
                        saveUserAvatar(newAvatar);
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

    const updateAvatar = async (newAvatarPath: string) => {
        setAvatar(newAvatarPath);
        // Save to DB
        await saveUserAvatar(newAvatarPath);

        // Keep legacy sync for now
        if (auth.currentUser) {
            localStorage.setItem(`avatar_${auth.currentUser.uid}`, newAvatarPath);
        }
    };

    return (
        <AuthContext.Provider value={{ user, avatar, isLoading, login, logout, updateName, updateAvatar }}>
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
