import { redis } from '../mapping/mapper';

// Redis Key for User Data
// Since we don't have auth yet, we'll use a single global user key for now
// In the future, this would be `user:${userId}`
const USER_KEY = 'user:global';

export const userService = {
    getUserAvatar: async () => {
        try {
            const avatar = await redis.hget(USER_KEY, 'avatar');
            return (avatar as string) || null;
        } catch (error) {
            console.error('Error getting user avatar from Redis:', error);
            return null;
        }
    },

    saveUserAvatar: async (avatarUrl: string) => {
        try {
            await redis.hset(USER_KEY, { avatar: avatarUrl });
            return true;
        } catch (error) {
            console.error('Error saving user avatar to Redis:', error);
            return false;
        }
    }
};
