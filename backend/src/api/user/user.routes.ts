import { Router } from 'express';
import { userService } from './user.service';

const router = Router();

router.get('/avatar', async (req, res) => {
    const avatar = await userService.getUserAvatar();
    // Return empty string if no avatar is set, frontend will handle default
    res.json({ avatar: avatar || '' });
});

router.post('/avatar', async (req, res) => {
    const { avatarUrl } = req.body;
    if (!avatarUrl) {
        return res.status(400).json({ message: 'Missing avatarUrl' });
    }

    const success = await userService.saveUserAvatar(avatarUrl);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(500).json({ message: 'Failed to save avatar' });
    }
});

export default router;
