import { Router } from 'express';
import multer from 'multer';
import * as fileManager from '../services/file-manager.js';
import { ok } from '../util.js';
import config from '../config.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/:id/files', async (req, res, next) => {
  try {
    const dir = req.query.dir || '';
    const entries = await fileManager.listWorkspaceFiles(req.params.id, dir, config.WORKSPACES_DIR);
    res.json(ok({ path: dir || '/', entries }));
  } catch (e) { next(e); }
});

router.get('/:id/files/*', async (req, res, next) => {
  try {
    const filePath = req.params[0];
    const result = await fileManager.readWorkspaceFile(req.params.id, filePath, config.WORKSPACES_DIR);
    if (result.isText) {
      res.json(ok({ content: result.content, mime: result.mime }));
    } else {
      res.redirect(`/api/workspaces/${req.params.id}/raw/${filePath}`);
    }
  } catch (e) { next(e); }
});

router.put('/:id/files/*', async (req, res, next) => {
  try {
    const filePath = req.params[0];
    const { content } = req.body || {};
    if (typeof content !== 'string') {
      return res.status(400).json({ ok: false, error: 'content must be a string' });
    }
    const result = await fileManager.writeWorkspaceFile(req.params.id, filePath, content, config.WORKSPACES_DIR);
    res.json(ok(result));
  } catch (e) { next(e); }
});

router.delete('/:id/files/*', async (req, res, next) => {
  try {
    const filePath = req.params[0];
    const result = await fileManager.deleteWorkspaceFile(req.params.id, filePath, config.WORKSPACES_DIR);
    res.json(ok(result));
  } catch (e) { next(e); }
});

router.post('/:id/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }
    const result = await fileManager.uploadWorkspaceFile(
      req.params.id,
      req.file.originalname,
      req.file.buffer,
      config.WORKSPACES_DIR
    );
    res.status(201).json(ok(result));
  } catch (e) { next(e); }
});

export default router;
