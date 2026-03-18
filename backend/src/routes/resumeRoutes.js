import { Router } from 'express';

import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { uploadResume, getResumeById, getMyResumes, patchParsedData } from '../controllers/resumeController.js';
import { resumeUpload } from '../config/multer.js';
import { resumeUploadLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

/**
 * @openapi
 * /resume/upload:
 *   post:
 *     tags:
 *       - Resume
 *     summary: Upload a resume and trigger AI parsing.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF, DOC, or DOCX file.
 *     responses:
 *       201:
 *         description: Resume uploaded successfully.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Unauthorized.
 */
router.post(
  '/upload',
  resumeUploadLimiter,
  authenticate,
  authorizeRoles('candidate'),
  resumeUpload.single('file'),
  uploadResume
);

/**
 * @openapi
 * /resume/me:
 *   get:
 *     tags:
 *       - Resume
 *     summary: List resumes belonging to the authenticated candidate.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of resumes.
 *       401:
 *         description: Unauthorized.
 */
router.get('/me', authenticate, authorizeRoles('candidate'), getMyResumes);

/**
 * @openapi
 * /resume/{id}/parsedData:
 *   patch:
 *     tags:
 *       - Resume
 *     summary: Allow a candidate to submit corrections to parsed resume data.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               totalYearsExperience:
 *                 type: number
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Corrections saved.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Resume not found.
 */
router.patch('/:id/parsedData', authenticate, authorizeRoles('candidate'), patchParsedData);

/**
 * @openapi
 * /resume/{id}:
 *   get:
 *     tags:
 *       - Resume
 *     summary: Fetch a parsed resume by ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resume document.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Not found.
 */
router.get('/:id', authenticate, getResumeById);

export default router;

