import dotenv from 'dotenv';
import path from 'node:path';

const cwd = process.cwd();

const envCandidates = [
    path.resolve(cwd, 'backend', '.env.local'),
    path.resolve(cwd, 'backend', '.env'),
    path.resolve(cwd, '.env.local'),
    path.resolve(cwd, '.env'),
    path.resolve(cwd, '..', '.env.local'),
    path.resolve(cwd, '..', '.env'),
];

for (const envPath of envCandidates) {
    dotenv.config({ path: envPath });
}
