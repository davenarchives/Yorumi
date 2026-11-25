import './core/config/env';
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { avatarService } from './modules/avatar/avatar.service';
import { errorHandler } from './core/middleware/error-handler';
import { notFoundHandler } from './core/middleware/not-found';
import { sendSuccess } from './core/http/api-response';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api', routes);
app.use('/avatars', express.static(avatarService.directory));

app.get('/', (_req, res) => {
    return sendSuccess(res, { message: 'Yorumi Backend is running' });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
