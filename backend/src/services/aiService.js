import axios from 'axios';

let client;

const AI_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS || 15_000);
const AI_RETRIES = Number(process.env.AI_SERVICE_RETRIES || 1);

const ensureConfigured = () => {
  if (!process.env.AI_SERVICE_URL) {
    throw new Error('AI_SERVICE_URL is not configured in backend/.env');
  }
};

const getClient = () => {
  ensureConfigured();

  if (!client) {
    client = axios.create({
      baseURL: process.env.AI_SERVICE_URL,
      timeout: AI_TIMEOUT_MS
    });
  }

  return client;
};

export const parseResume = async (payload) => {
  const { data } = await getClient().post('/ai/parse-resume', payload);
  return data;
};

export const parseJobDescription = async (payload) => {
  const { data } = await getClient().post('/ai/parse-jd', payload);
  return data;
};

export const matchResumeToJob = async (payload, options = {}) => {
  const { data } = await getClient().post('/ai/match', payload, options);
  return data;
};

export const getRecommendations = async (payload) => {
  const { data } = await getClient().post('/ai/recommend', payload);
  return data;
};

export const pingAIService = async () => {
  const { data } = await getClient().get('/health');
  return data;
};

const isTimeoutError = (error) => {
  return error?.code === 'ECONNABORTED' || error?.message?.toLowerCase?.().includes('timeout');
};

const atsScanBaseImpl = async (payload, { requestId } = {}) => {
  let attempt = 0;
  let lastError;
  while (attempt <= AI_RETRIES) {
    try {
      const { data } = await getClient().post('/ai/ats-scan', payload, {
        timeout: AI_TIMEOUT_MS,
        headers: requestId ? { 'x-request-id': requestId } : undefined
      });
      return data;
    } catch (error) {
      lastError = error;
      if (isTimeoutError(error) && attempt < AI_RETRIES) {
        attempt += 1;
        continue;
      }
      throw error;
    }
  }

  throw lastError;
};

let atsScanImpl = atsScanBaseImpl;

export const atsScan = (...args) => atsScanImpl(...args);
export const __setAtsScanImplForTest = (fn) => {
  atsScanImpl = fn || atsScanBaseImpl;
};

// Mutable wrapper for easier mocking in tests
export const aiClients = {
  parseResume,
  parseJobDescription,
  matchResumeToJob,
  getRecommendations,
  atsScan
};

