export const USER_STATUSES = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BANNED: 'banned'
});

export const ALLOWED_USER_STATUSES = Object.values(USER_STATUSES);

export const DEFAULT_USER_STATUS = USER_STATUSES.ACTIVE;

export const isValidUserStatus = (status) => ALLOWED_USER_STATUSES.includes(status);

