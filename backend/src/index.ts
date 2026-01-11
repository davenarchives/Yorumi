import express from 'express';
import cors from 'cors';
import jikanRoutes from './routes/jikan';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/jikan', jikanRoutes);

app.get('/', (req, res) => {
    res.send('Yorumi Backend is running');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
