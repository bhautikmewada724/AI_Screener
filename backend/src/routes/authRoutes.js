import { Router } from 'express';

import { adminOnlyPing, getCurrentUser, login, register } from '../controllers/authController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user.
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
 *                 description: Defaults to candidate if omitted.
 *     responses:
 *       201:
 *         description: User created successfully.
 *       400:
 *         description: Missing required fields.
 *       409:
 *         description: Email already registered.
 */
router.post('/register', register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Authenticate a user and receive a JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful login.
 *       401:
 *         description: Invalid credentials.
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Retrieve the authenticated user's profile.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns the authenticated user.
 *       401:
 *         description: Missing or invalid token.
 */
router.get('/me', authenticate, getCurrentUser);

/**
 * @openapi
 * /auth/admin-check:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Example admin-only route to validate RBAC.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin access confirmed.
 *       401:
 *         description: Missing or invalid token.
 *       403:
 *         description: User does not have the required role.
 */
router.get('/admin-check', authenticate, authorizeRoles(ROLES.ADMIN), adminOnlyPing);

export default router;

