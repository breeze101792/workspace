import { homedir } from 'os';
import { join } from 'path';

const DATA_ROOT = join(homedir(), '.config', 'workspace');
const WORKSPACES_DIR = join(DATA_ROOT, 'workspaces');
const CONFIG_FILE = join(DATA_ROOT, 'config.json');

export default {
  DATA_ROOT,
  WORKSPACES_DIR,
  CONFIG_FILE,
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '0.0.0.0',
};
