import {
  createUser,
  getSystemOverview,
  getUserById,
  listUsers,
  getUserAuditEvents,
  updateUserRole,
  updateUserStatus
} from '../services/adminService.js';

export const listUsersController = async (req, res, next) => {
  try {
    const result = await listUsers({
      page: req.query.page,
      limit: req.query.limit,
      role: req.query.role,
      status: req.query.status,
      search: req.query.search
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createUserController = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const user = await createUser({
      name,
      email,
      password,
      role,
      actorId: req.user.id
    });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

export const getUserController = async (req, res, next) => {
  try {
    const user = await getUserById(req.params.userId);
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const getUserAuditTrailController = async (req, res, next) => {
  try {
    const events = await getUserAuditEvents({
      targetUserId: req.params.userId,
      limit: req.query.limit
    });
    res.json({ events });
  } catch (error) {
    next(error);
  }
};

export const updateUserRoleController = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!role) {
      return res.status(400).json({ message: 'New role is required.' });
    }

    const user = await updateUserRole({
      targetUserId: req.params.userId,
      role,
      actorId: req.user.id
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatusController = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ message: 'New status is required.' });
    }

    const user = await updateUserStatus({
      targetUserId: req.params.userId,
      status,
      actorId: req.user.id
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const getSystemOverviewController = async (req, res, next) => {
  try {
    const overview = await getSystemOverview();
    res.json(overview);
  } catch (error) {
    next(error);
  }
};


