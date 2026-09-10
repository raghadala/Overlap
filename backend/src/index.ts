import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import pinRoutes from './routes/pins';
import connectionRoutes from './routes/connections';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/pins', pinRoutes);
app.use('/connections', connectionRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Overlap API listening on port ${port}`));
