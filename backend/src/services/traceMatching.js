export const ensureMatchResultPayload = ({ trace, traceEnabled }) => {
  if (traceEnabled && trace != null) {
    return { trace };
  }

  return {};
};

