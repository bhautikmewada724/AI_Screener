import { Router } from 'express';

import {
  createUserController,
  getSystemOverviewController,
  getUserController,
  getUserAuditTrailController,
  listUsersController,
  updateUserRoleController,
  updateUserStatusController
} from '../controllers/adminController.js';
import {
  listOntology,
  listUnknown,
  normalizeSkillsController,
  promoteOntology
} from '../controllers/skillOntologyAdminController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { ROLES } from '../utils/roles.js';

const router = Router();
const adminGuard = [authenticate, authorizeRoles(ROLES.ADMIN)];

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List users with optional filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, hr, candidate]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, banned]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive name/email search.
 *     responses:
 *       200:
 *         description: Paginated user list.
 */
router.get('/users', adminGuard, listUsersController);
/**
 * @openapi
 * /admin/users:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Create a new user (HR/Admin/Candidate) as an admin-only action.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, hr, candidate]
 *                 description: Defaults to candidate when omitted.
 *     responses:
 *       201:
 *         description: User created successfully.
 */
router.post('/users', adminGuard, createUserController);

/**
 * @openapi
 * /admin/users/{userId}:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Fetch a single user profile.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User document.
 */
router.get('/users/:userId', adminGuard, getUserController);
router.get('/users/:userId/audit', adminGuard, getUserAuditTrailController);

/**
 * @openapi
 * /admin/users/{userId}/role:
 *   patch:
 *     tags:
 *       - Admin
 *     summary: Update a user's role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, hr, candidate]
 *     responses:
 *       200:
 *         description: Updated user.
 */
router.patch('/users/:userId/role', adminGuard, updateUserRoleController);

/**
 * @openapi
 * /admin/users/{userId}/status:
 *   patch:
 *     tags:
 *       - Admin
 *     summary: Activate, deactivate, or ban a user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, banned]
 *     responses:
 *       200:
 *         description: Updated user.
 */
router.patch('/users/:userId/status', adminGuard, updateUserStatusController);

/**
 * @openapi
 * /admin/stats/overview:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Platform-wide metrics for admins.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated statistics.
 */
router.get('/stats/overview', adminGuard, getSystemOverviewController);

router.get('/ontology', adminGuard, listOntology);
router.get('/unknown-skills', adminGuard, listUnknown);
router.post('/ontology/promote', adminGuard, promoteOntology);
router.post('/ontology/normalize', adminGuard, normalizeSkillsController);

export default router;


