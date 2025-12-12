export const APPLICATION_STATUSES = Object.freeze([
  'applied',
  'in_review',
  'shortlisted',
  'rejected',
  'hired'
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  applied: ['in_review', 'rejected'],
  in_review: ['shortlisted', 'rejected'],
  shortlisted: ['hired', 'rejected'],
  rejected: [],
  hired: []
});

export const isValidStatus = (status) => APPLICATION_STATUSES.includes(status);

export const canTransition = (fromStatus, toStatus) => {
  if (!isValidStatus(fromStatus) || !isValidStatus(toStatus)) {
    return false;
  }
  if (fromStatus === toStatus) {
    return true; // no-op is allowed
  }
  return ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus) || false;
};

export const assertValidTransition = (fromStatus, toStatus) => {
  if (!isValidStatus(toStatus)) {
    const error = new Error('Invalid status provided.');
    error.status = 400;
    throw error;
  }

  if (!isValidStatus(fromStatus)) {
    const error = new Error('Invalid current status.');
    error.status = 400;
    throw error;
  }

  if (!canTransition(fromStatus, toStatus)) {
    const error = new Error(`Invalid status transition from ${fromStatus} to ${toStatus}.`);
    error.status = 400;
    throw error;
  }
};

