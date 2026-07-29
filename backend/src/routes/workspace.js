import { Router } from 'express';
import * as workspaceManager from '../services/workspace-manager.js';
import { ok } from '../util.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const workspaces = await workspaceManager.listWorkspaces();
    res.json(ok(workspaces));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const result = await workspaceManager.createWorkspace(name);
    res.status(201).json(ok(result));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ws = await workspaceManager.getWorkspace(req.params.id);
    res.json(ok(ws));
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const result = await workspaceManager.updateWorkspace(req.params.id, req.body || {});
    res.json(ok(result));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await workspaceManager.deleteWorkspace(req.params.id);
    res.json(ok(result));
  } catch (e) { next(e); }
});

export default router;
