const express = require('express');

const { requireAuth, requireRole } = require('../auth');
const { addTherapy, listTherapies } = require('../care');
const { asyncHandler } = require('../http');

const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ therapies: await listTherapies() });
  }),
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.status(201).json({ therapies: await addTherapy(req.body.name) });
  }),
);

module.exports = router;
