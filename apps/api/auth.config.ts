import { readConfig } from './src/app/config.js';
import { createAuth } from './src/infrastructure/auth/create-auth.js';
import { createDatabase } from './src/infrastructure/database/client.js';

const config = readConfig();
const database = createDatabase(config.DATABASE_URL);

export default createAuth(config, database.db);
